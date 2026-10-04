import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyDecisionPolicy, assessDecision, buildDecisionRequest, createJevAdapter,
} from "../skills/decision-engine/scripts/jev-adapter.mjs";

const exampleUrl = new URL("../skills/decision-engine/assets/jev-example.json", import.meta.url);
const cli = fileURLToPath(new URL("../skills/decision-engine/scripts/jev-decide.mjs", import.meta.url));
const input = () => JSON.parse(readFileSync(exampleUrl, "utf8"));
const request = () => ({ model: "jev-1.13.0", ...buildDecisionRequest(input()) });
const jsonResponse = (value) => new Response(JSON.stringify(value), { status: 200 });

function score(question, level) {
  return {
    type: "score", score: level, confidence: 1,
    legend: Object.fromEntries(question.criteria.map((description, i) => [String(i), description])),
    probabilities: Object.fromEntries(question.criteria.map((_description, i) => [String(i), i === level ? 1 : 0])),
  };
}

function responseFor(req = request()) {
  return {
    model: "jev-1.13.0",
    answers: Object.fromEntries(Object.entries(req.questions).map(([id, question]) => {
      if (question.type === "choice") {
        return [id, { type: "choice", choice: "complex", confidence: 1,
          probabilities: Object.fromEntries(Object.keys(question.criteria).map((key) => [key, key === "complex" ? 1 : 0])) }];
      }
      if (question.type === "noul") return [id, { type: "noul", noul: 1 }];
      const level = id.startsWith("option_1") ? 1 : id.endsWith("benefit") ? 2 : 0;
      return [id, score(question, level)];
    })),
    usage: { input_tokens: 500, output_tokens: 80 },
  };
}

test("a real HTTP-shaped assessment uses the official endpoint and all three primitives", async () => {
  let captured;
  const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async (url, options) => {
    captured = { url, ...options };
    return jsonResponse(responseFor(JSON.parse(options.body)));
  } });
  const result = await assessDecision(input(), adapter);
  assert.equal(captured.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(captured.method, "POST");
  assert.equal(captured.redirect, "error");
  assert.equal(captured.headers.Authorization, "Bearer test-key");
  const sent = JSON.parse(captured.body);
  assert.equal(sent.model, "jev-1.13.0");
  assert.equal(Object.keys(sent.questions).length, 16);
  assert.deepEqual(new Set(Object.values(sent.questions).map((q) => q.type)), new Set(["choice", "score", "noul"]));
  assert.ok(Object.values(sent.questions).every((q) => q.instructions));
  assert.equal(result.status, "recommend");
  assert.equal(result.selectedOption, "staging_probe");
  assert.equal(result.model, "jev-1.13.0");
  assert.equal(result.candidates.find((c) => c.id === "migrate_everything").status, "blocked");
  assert.equal(result.candidates[0].gates.fairness, 1);
  assert.ok(!own(result, "state"));
  assert.ok(!captured.body.includes("rollback_verified"));
});

const own = (value, key) => Object.hasOwn(value, key);

test("request building and policy evaluation leave caller input unchanged", () => {
  const decision = input();
  delete decision.policy;
  const before = structuredClone(decision);
  const req = buildDecisionRequest(decision);
  applyDecisionPolicy(decision, responseFor({ ...req, model: "jev-1.13.0" }));
  assert.deepEqual(decision, before);
});

test("retries 429 and 529 with bounded Retry-After delays", async () => {
  const statuses = [429, 529, 200];
  const waits = [];
  let calls = 0;
  const adapter = createJevAdapter({ apiKey: "test-key", sleepImpl: async (ms) => waits.push(ms),
    fetchImpl: async () => {
      const status = statuses[calls++];
      return status === 200 ? jsonResponse(responseFor()) : new Response("private provider error", { status, headers: { "retry-after": "2" } });
    } });
  await adapter.evaluate(request());
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);
});

test("rate-limit retries stop at the configured budget", async () => {
  let calls = 0;
  const adapter = createJevAdapter({ apiKey: "test-key", maxRetries: 1, sleepImpl: async () => {},
    fetchImpl: async () => { calls++; return new Response("secret", { status: 429 }); } });
  await assert.rejects(adapter.evaluate(request()), { code: "rate_limited", status: 429 });
  assert.equal(calls, 2);
});

for (const status of [401, 403, 422]) {
  test(`HTTP ${status} is not retried and does not expose a provider error body`, async () => {
    let calls = 0;
    const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async () => {
      calls++;
      return new Response("secret-state-and-key", { status });
    } });
    await assert.rejects(adapter.evaluate(request()), (error) => error.status === status && !error.message.includes("secret"));
    assert.equal(calls, 1);
  });
}

test("transport failures are sanitized and never become recommendations", async () => {
  const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async () => { throw new Error("secret-key-and-state"); } });
  await assert.rejects(assessDecision(input(), adapter), (error) => error.code === "transport_error" && !error.message.includes("secret"));
});

test("a stalled request is aborted", async () => {
  let aborted = false;
  const adapter = createJevAdapter({ apiKey: "test-key", timeoutMs: 10, fetchImpl: async (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true })) });
  await assert.rejects(adapter.evaluate(request()), { code: "timeout" });
  assert.equal(aborted, true);
});

const corruptions = {
  "missing answer": (r) => { delete r.answers.option_0_fairness; },
  "unexpected answer": (r) => { r.answers.extra = { type: "noul", noul: 1 }; },
  "wrong answer type": (r) => { r.answers.option_0_fairness.type = "choice"; },
  "unknown choice": (r) => { r.answers.problem_class.choice = "invented"; },
  "choice not at the probability maximum": (r) => { r.answers.problem_class.choice = "clear"; },
  "missing probability": (r) => { delete r.answers.problem_class.probabilities.clear; },
  "probabilities do not sum to one": (r) => { r.answers.problem_class.probabilities.clear = 0.2; },
  "out-of-range probability": (r) => { r.answers.option_0_fairness.noul = 1.1; },
  "non-numeric probability": (r) => { r.answers.option_0_fairness.noul = "0.99"; },
  "score disagrees with probabilities": (r) => { r.answers.option_0_benefit.score = 0; },
  "score outside its rubric": (r) => { r.answers.option_0_benefit.score = 10; },
  "confidence outside range": (r) => { r.answers.option_0_benefit.confidence = -1; },
  "missing score legend level": (r) => { delete r.answers.option_0_benefit.legend["1"]; },
  "score legend changed the rubric": (r) => { r.answers.option_0_benefit.legend["1"] = "different standard"; },
  "confidence contradicts the distribution": (r) => { r.answers.problem_class.confidence = 0.1; },
  "unexpected pinned model": (r) => { r.model = "another-model"; },
};
for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`rejects ${name}`, async () => {
    const response = responseFor();
    corrupt(response);
    const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async () => jsonResponse(response) });
    await assert.rejects(adapter.evaluate(request()), { code: "invalid_response" });
  });
}

test("malformed JSON responses fail closed", async () => {
  const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async () => new Response("{broken") });
  await assert.rejects(adapter.evaluate(request()), { code: "invalid_response" });
});

test("explicit aliases accept and preserve the resolved model ID", async () => {
  const adapter = createJevAdapter({ apiKey: "test-key", model: "jev-latest", fetchImpl: async () => jsonResponse(responseFor()) });
  assert.equal((await adapter.evaluate(request())).model, "jev-1.13.0");
});

test("credentials and invalid requests are rejected before any network call", async () => {
  assert.throws(() => createJevAdapter({ apiKey: "" }), { code: "invalid_request" });
  assert.throws(() => createJevAdapter({ apiKey: "key\nheader" }), { code: "invalid_request" });
  let calls = 0;
  const adapter = createJevAdapter({ apiKey: "test-key", fetchImpl: async () => { calls++; } });
  await assert.rejects(adapter.evaluate({ state: { bad: NaN }, questions: request().questions }), { code: "invalid_request" });
  await assert.rejects(adapter.evaluate({ state: "text", questions: { q: { type: "noul" } } }), { code: "invalid_request" });
  await assert.rejects(adapter.evaluate({ state: "text", questions: { q: { type: "score", instructions: "test", criteria: ["only one"] } } }), { code: "invalid_request" });
  assert.equal(calls, 0);
});

test("high model confidence cannot override failed or missing deterministic checks", () => {
  for (const value of [false, "true", null, undefined]) {
    const decision = input();
    if (value === undefined) delete decision.options[0].checks.evidence_verified;
    else decision.options[0].checks.evidence_verified = value;
    const result = applyDecisionPolicy(decision, responseFor());
    assert.equal(result.candidates.find((c) => c.id === "staging_probe").status, "blocked");
    assert.notEqual(result.selectedOption, "staging_probe");
  }
});

test("an irreversible option remains blocked even when all scores and checks pass", () => {
  const decision = input();
  decision.options[0].reversible = false;
  const result = applyDecisionPolicy(decision, responseFor());
  assert.equal(result.candidates.find((c) => c.id === "staging_probe").status, "blocked");
  assert.notEqual(result.selectedOption, "staging_probe");
  decision.policy.allowIrreversible = true;
  assert.equal(applyDecisionPolicy(decision, responseFor()).selectedOption, "staging_probe");
});

test("a fairness failure cannot be outweighed by utility", () => {
  const response = responseFor();
  response.answers.option_0_fairness.noul = 0.01;
  const result = applyDecisionPolicy(input(), response);
  assert.equal(result.candidates.find((c) => c.id === "staging_probe").status, "blocked");
  assert.equal(result.selectedOption, "scheduled_canary");
});

for (const dimension of ["risk", "cost"]) {
  test(`a confident ${dimension} score above its cap cannot be outweighed by benefit`, () => {
    const decision = input();
    decision.policy.weights = { benefit: 1, cost: 0, risk: 0 };
    const response = responseFor();
    response.answers[`option_0_${dimension}`] = score(request().questions[`option_0_${dimension}`], 2);
    const result = applyDecisionPolicy(decision, response);
    assert.equal(result.candidates.find((c) => c.id === "staging_probe").status, "blocked");
    assert.notEqual(result.selectedOption, "staging_probe");
  });
}

test("uncertain fairness on a competitive option requires review", () => {
  const response = responseFor();
  response.answers.option_0_fairness.noul = 0.5;
  const result = applyDecisionPolicy(input(), response);
  assert.equal(result.status, "review");
  assert.equal(result.selectedOption, null);
});

test("low score confidence on a competitive option requires review", () => {
  const response = responseFor();
  response.answers.option_0_risk.probabilities = { "0": 0.6, "1": 0.4, "2": 0 };
  response.answers.option_0_risk.score = 0.4;
  response.answers.option_0_risk.confidence = 0.4;
  assert.equal(applyDecisionPolicy(input(), response).status, "review");
});

test("unknown or low-confidence classification requires review", () => {
  const response = responseFor();
  response.answers.problem_class.probabilities = { clear: 0.2, complicated: 0.2, complex: 0.4, chaotic: 0.1, unknown: 0.1 };
  response.answers.problem_class.confidence = 0.25;
  assert.equal(applyDecisionPolicy(input(), response).status, "review");
  response.answers.problem_class = { type: "choice", choice: "unknown", confidence: 1,
    probabilities: { clear: 0, complicated: 0, complex: 0, chaotic: 0, unknown: 1 } };
  assert.equal(applyDecisionPolicy(input(), response).status, "review");
});

test("tied eligible options require review rather than an arbitrary winner", () => {
  const response = responseFor();
  const req = request();
  for (const dimension of ["benefit", "cost", "risk"]) {
    response.answers[`option_1_${dimension}`] = score(req.questions[`option_1_${dimension}`], dimension === "benefit" ? 2 : 0);
  }
  const result = applyDecisionPolicy(input(), response);
  assert.equal(result.status, "review");
  assert.equal(result.selectedOption, null);
});

test("all failed checks produce a blocked assessment", () => {
  const decision = input();
  decision.options.forEach((option) => { option.checks.evidence_verified = false; });
  const result = applyDecisionPolicy(decision, responseFor());
  assert.equal(result.status, "blocked");
  assert.equal(result.selectedOption, null);
});

test("an uncertain unblocked alternative prevents a recommendation even with low point utility", () => {
  const response = responseFor();
  response.answers.option_1_risk = {
    ...response.answers.option_1_risk,
    probabilities: { "0": 0.3, "1": 0, "2": 0.7 }, score: 1.4, confidence: 0.1,
  };
  assert.equal(applyDecisionPolicy(input(), response).status, "review");
});

test("a long Retry-After is not shortened or ignored", async () => {
  let calls = 0;
  let waited = false;
  const adapter = createJevAdapter({ apiKey: "test-key", sleepImpl: async () => { waited = true; },
    fetchImpl: async () => { calls++; return new Response("secret", { status: 429, headers: { "retry-after": "120" } }); } });
  await assert.rejects(adapter.evaluate(request()), { code: "retry_later" });
  assert.equal(calls, 1);
  assert.equal(waited, false);
});

test("invalid decision policy, missing standards, and duplicate options are rejected", () => {
  for (const modify of [
    (d) => { d.policy.minGateProbability = 0.5; },
    (d) => { d.policy.minMargin = 0; },
    (d) => { d.policy.requiredChecks = []; },
    (d) => { d.policy.minConfidnce = 0.8; },
    (d) => { d.policy.weights.risk = 0.1; },
    (d) => { d.policy.maxRiskScore = 3; },
    (d) => { delete d.standards.fairness; },
    (d) => { d.options[1].id = d.options[0].id; },
    (d) => { delete d.options[0].reversible; },
    (d) => { d.options.pop(); },
  ]) {
    const decision = input();
    modify(decision);
    assert.throws(() => buildDecisionRequest(decision), { code: "invalid_request" });
  }
});

test("CLI dry-run works without credentials and makes no API call", () => {
  const child = spawnSync(process.execPath, [cli, "--input", fileURLToPath(exampleUrl), "--dry-run"],
    { encoding: "utf8", env: { ...process.env, TYPESAFE_API_KEY: "", JEV_MODEL: "jev-1.13.0" } });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.dryRun, true);
  assert.equal(Object.keys(result.request.questions).length, 16);
  assert.equal(child.stderr, "");
});

test("CLI accepts stdin and rejects malformed JSON without echoing it", () => {
  const child = spawnSync(process.execPath, [cli, "--input", "-", "--dry-run"], { input: JSON.stringify(input()), encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).dryRun, true);
  const broken = spawnSync(process.execPath, [cli, "--input", "-"], { input: "secret-malformed-json", encoding: "utf8" });
  assert.equal(broken.status, 1);
  assert.equal(JSON.parse(broken.stderr).code, "invalid_request");
  assert.ok(!broken.stderr.includes("secret"));
});

test("CLI live invocation without a key reports an error, never a recommendation", () => {
  const child = spawnSync(process.execPath, [cli, "--input", fileURLToPath(exampleUrl)],
    { encoding: "utf8", env: { ...process.env, TYPESAFE_API_KEY: "" } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  assert.equal(JSON.parse(child.stderr).status, "error");
});
