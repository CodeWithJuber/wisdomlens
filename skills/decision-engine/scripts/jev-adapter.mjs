import { setTimeout as delay } from "node:timers/promises";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-1.13.0";
const own = (value, key) => Object.hasOwn(value, key);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const unit = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

export class JevError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "JevError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

function requireInput(condition, message) {
  if (!condition) throw new JevError("invalid_request", message);
}

function requireResponse(condition) {
  if (!condition) throw new JevError("invalid_response", "JEV returned an invalid or incomplete response.");
}

function jsonCopy(value) {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (["undefined", "function", "symbol", "bigint"].includes(typeof item) ||
          (typeof item === "number" && !Number.isFinite(item))) throw new Error();
      return item;
    }));
  } catch {
    throw new JevError("invalid_request", "The request must contain only serializable JSON values.");
  }
}

function validateRequest(request) {
  requireInput(text(request.model), "A model ID is required.");
  requireInput(typeof request.state === "string" || record(request.state) || Array.isArray(request.state),
    "State must be text, an object, or an array.");
  requireInput(record(request.questions) && Object.keys(request.questions).length > 0,
    "At least one typed question is required.");
  for (const question of Object.values(request.questions)) {
    requireInput(record(question) && ["choice", "score", "noul"].includes(question.type),
      "Questions must use choice, score, or noul.");
    requireInput(text(question.instructions) || record(question.instructions) || Array.isArray(question.instructions),
      "Each question needs instructions; its ID is not sent to the model.");
    if (question.type === "choice") {
      requireInput(record(question.criteria) && Object.keys(question.criteria).length >= 2 &&
        Object.keys(question.criteria).length <= 255, "Choice needs 2–255 named criteria.");
    } else if (question.type === "score") {
      requireInput(Array.isArray(question.criteria) && question.criteria.length >= 2 &&
        question.criteria.length <= 10, "Score needs 2–10 ordered criteria.");
    } else if (own(question, "criteria")) {
      requireInput(record(question.criteria) && own(question.criteria, "true") && own(question.criteria, "false"),
        "Noul criteria must describe true and false.");
    }
  }
}

function validateDistribution(probabilities, keys) {
  requireResponse(record(probabilities) && Object.keys(probabilities).length === keys.length);
  requireResponse(keys.every((key) => own(probabilities, key) && unit(probabilities[key])));
  requireResponse(Math.abs(Object.values(probabilities).reduce((sum, p) => sum + p, 0) - 1) <= 0.001);
}

export function validateJevResponse(request, response) {
  requireResponse(record(response) && text(response.model) && record(response.answers));
  if (!["jev-latest", "jev-preview"].includes(request.model)) {
    requireResponse(response.model === request.model);
  }
  const ids = Object.keys(request.questions);
  requireResponse(Object.keys(response.answers).length === ids.length);
  for (const id of ids) {
    const question = request.questions[id];
    requireResponse(own(response.answers, id));
    const answer = response.answers[id];
    requireResponse(record(answer) && answer.type === question.type);
    if (question.type === "noul") {
      requireResponse(unit(answer.noul));
      continue;
    }
    const keys = question.type === "choice" ? Object.keys(question.criteria) : question.criteria.map((_c, i) => String(i));
    validateDistribution(answer.probabilities, keys);
    requireResponse(unit(answer.confidence));
    const probabilities = keys.map((key) => answer.probabilities[key]);
    let expectedConfidence;
    if (question.type === "choice") {
      requireResponse(text(answer.choice) && own(question.criteria, answer.choice));
      requireResponse(answer.probabilities[answer.choice] + 0.001 >= Math.max(...Object.values(answer.probabilities)));
      expectedConfidence = (Math.max(...probabilities) - 1 / keys.length) / (1 - 1 / keys.length);
    } else {
      const expected = keys.reduce((sum, key) => sum + Number(key) * answer.probabilities[key], 0);
      requireResponse(Number.isFinite(answer.score) && answer.score >= 0 && answer.score <= keys.length - 1);
      requireResponse(Math.abs(answer.score - expected) <= 0.01);
      requireResponse(record(answer.legend) && Object.keys(answer.legend).length === keys.length &&
        keys.every((key) => own(answer.legend, key)));
      requireResponse(keys.every((key) => typeof question.criteria[Number(key)] !== "string" ||
        answer.legend[key] === question.criteria[Number(key)]));
      const mode = probabilities.indexOf(Math.max(...probabilities));
      const spread = probabilities.reduce((sum, p, i) => sum + p * Math.abs(i - mode), 0);
      const uniformSpread = keys.reduce((sum, _key, i) => sum + Math.abs(i - (keys.length - 1) / 2), 0) / keys.length;
      expectedConfidence = Math.max(0, 1 - spread / uniformSpread);
    }
    // Allow documented rounded examples, but reject confidence contradicting the distribution.
    requireResponse(Math.abs(answer.confidence - expectedConfidence) <= 0.02);
  }
  return response;
}

/** Explicitly created only for JEV use; importing this module performs no I/O. */
export function createJevAdapter({
  apiKey = process.env.TYPESAFE_API_KEY,
  model = process.env.JEV_MODEL || DEFAULT_MODEL,
  timeoutMs = 10_000,
  maxRetries = 2,
  fetchImpl = globalThis.fetch,
  sleepImpl = delay,
} = {}) {
  requireInput(text(apiKey) && !/[\r\n]/.test(apiKey), "Set TYPESAFE_API_KEY before making a live JEV request.");
  requireInput(text(model), "A model ID is required.");
  requireInput(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000, "Timeout must be 1–60000 ms.");
  requireInput(Number.isInteger(maxRetries) && maxRetries >= 0 && maxRetries <= 3, "Retries must be 0–3.");
  requireInput(typeof fetchImpl === "function" && typeof sleepImpl === "function", "Fetch and delay must be functions.");

  return {
    async evaluate({ state, questions }) {
      const request = jsonCopy({ state, model, questions });
      validateRequest(request);
      const body = JSON.stringify(request);
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let response;
        let parsed;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await fetchImpl(ENDPOINT, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body,
            redirect: "error",
            signal: controller.signal,
          });
          if (response.ok) {
            const responseText = await response.text();
            requireResponse(Buffer.byteLength(responseText) <= 1_048_576);
            try { parsed = JSON.parse(responseText); } catch { requireResponse(false); }
          } else {
            // Never expose provider error bodies, which may echo state or credentials.
            await response.body?.cancel();
          }
        } catch (error) {
          if (error instanceof JevError) throw error;
          if (controller.signal.aborted) throw new JevError("timeout", "The JEV request timed out; no decision was returned.");
          throw new JevError("transport_error", "The JEV request failed; no decision was returned.");
        } finally {
          clearTimeout(timer);
        }
        if (response.ok) return validateJevResponse(request, parsed);
        if (response.status === 401 || response.status === 403) {
          throw new JevError("authentication_failed", "JEV authentication failed. Check TYPESAFE_API_KEY.", response.status);
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxRetries) {
          throw new JevError(response.status === 429 ? "rate_limited" : "http_error",
            `JEV returned HTTP ${response.status}; no decision was returned.`, response.status);
        }
        const header = response.headers.get("retry-after");
        const seconds = header === null ? NaN : Number(header);
        const retryAfter = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - Date.now();
        const waitMs = Math.max(0, Number.isFinite(retryAfter) ? retryAfter : 250 * 2 ** attempt);
        if (waitMs > 10_000) {
          throw new JevError("retry_later", "JEV requested a longer retry delay. Try again later; no decision was returned.", response.status);
        }
        await sleepImpl(waitMs);
      }
    },
  };
}

const BENEFIT = ["No demonstrated benefit", "Useful improvement supported by evidence", "Substantial benefit supported by evidence"];
const COST = ["Small resource cost", "Material but affordable resource cost", "Large or unaffordable resource cost"];
const RISK = ["Limited downside with a tested recovery path", "Material downside with a plausible recovery path", "Severe downside or no credible recovery path"];

function normalizeDecision(input) {
  const result = jsonCopy(input);
  requireInput(record(result), "A decision must be an object.");
  requireInput(typeof result.state === "string" || record(result.state) || Array.isArray(result.state), "Decision state is required.");
  requireInput(record(result.standards) && text(result.standards.fairness) && text(result.standards.commitments),
    "Explicit fairness and commitments standards are required.");
  requireInput(Array.isArray(result.options) && result.options.length >= 3 && result.options.length <= 20,
    "Supply 3–20 different options, including a reversible probe where practical.");
  const ids = new Set();
  for (const option of result.options) {
    requireInput(record(option) && text(option.id) && text(option.description) && typeof option.reversible === "boolean",
      "Each option needs an ID, description, and explicit reversible boolean.");
    requireInput(!ids.has(option.id), "Option IDs must be unique.");
    ids.add(option.id);
    requireInput(option.checks === undefined || record(option.checks), "Option checks must be an object.");
    option.checks ??= {};
  }
  requireInput(result.policy === undefined || record(result.policy), "Policy must be an object.");
  const provided = result.policy ?? {};
  const allowed = ["minConfidence", "minGateProbability", "minMargin", "maxRiskScore", "maxCostScore", "allowIrreversible", "requiredChecks", "weights"];
  requireInput(Object.keys(provided).every((key) => allowed.includes(key)), "Unknown decision policy field.");
  result.policy = {
    minConfidence: 0.8,
    minGateProbability: 0.95,
    minMargin: 0.05,
    maxRiskScore: 1,
    maxCostScore: 1,
    allowIrreversible: false,
    requiredChecks: ["evidence_verified"],
    weights: { benefit: 0.4, cost: 0.2, risk: 0.4 },
    ...provided,
  };
  const policy = result.policy;
  requireInput(unit(policy.minConfidence) && policy.minConfidence > 0 && unit(policy.minGateProbability) &&
    policy.minGateProbability > 0.5 && unit(policy.minMargin) && policy.minMargin > 0,
    "Confidence and margin must be above 0 and at most 1; gate probability must be above 0.5 and at most 1.");
  requireInput(typeof policy.allowIrreversible === "boolean", "allowIrreversible must be boolean.");
  requireInput([policy.maxRiskScore, policy.maxCostScore].every((value) => Number.isFinite(value) && value >= 0 && value <= 2),
    "Risk and cost caps must be numbers between 0 and 2.");
  requireInput(Array.isArray(policy.requiredChecks) && policy.requiredChecks.length > 0 &&
    policy.requiredChecks.every(text) && new Set(policy.requiredChecks).size === policy.requiredChecks.length,
    "At least one uniquely named deterministic check is required.");
  requireInput(record(policy.weights) && Object.keys(policy.weights).length === 3 &&
    ["benefit", "cost", "risk"].every((key) => own(policy.weights, key) && unit(policy.weights[key])) &&
    Math.abs(Object.values(policy.weights).reduce((sum, weight) => sum + weight, 0) - 1) < 0.000001,
    "Weights must contain benefit, cost, and risk, be nonnegative, and sum to 1.");
  return result;
}

export function buildDecisionRequest(input) {
  const decision = normalizeDecision(input);
  const questions = {
    problem_class: {
      type: "choice",
      instructions: "Classify the decision described in state. Choose unknown when the evidence is insufficient.",
      criteria: {
        clear: "An established standard gives a known response",
        complicated: "Analysis or domain expertise is needed",
        complex: "Effects are uncertain; small reversible probes are needed",
        chaotic: "Immediate stabilization is needed before analysis",
        unknown: "Insufficient evidence to classify",
      },
    },
  };
  decision.options.forEach((option, index) => {
    const instructions = (question) => ({ question, option: { id: option.id, description: option.description } });
    questions[`option_${index}_benefit`] = { type: "score", instructions: instructions("How much benefit is supported by the supplied evidence?"), criteria: BENEFIT };
    questions[`option_${index}_cost`] = { type: "score", instructions: instructions("How large is the resource cost relative to the supplied budget and constraints?"), criteria: COST };
    questions[`option_${index}_risk`] = { type: "score", instructions: instructions("How severe is the downside, considering second-order effects and who bears the risk?"), criteria: RISK };
    for (const gate of ["fairness", "commitments"]) {
      questions[`option_${index}_${gate}`] = {
        type: "noul",
        instructions: instructions(`Does this option satisfy the supplied ${gate} standard?`),
        criteria: {
          true: { standard: decision.standards[gate], evidence: "Supplied evidence establishes compliance with the standard" },
          false: "Violates the standard, or supplied evidence does not establish compliance",
        },
      };
    }
  });
  return {
    state: {
      context: decision.state,
      standards: decision.standards,
      options: decision.options.map(({ id, description, reversible }) => ({ id, description, reversible })),
    },
    questions,
  };
}

/** Code gates recommendations; a probability can never override a failed tool check. */
export function applyDecisionPolicy(input, response) {
  const decision = normalizeDecision(input);
  const request = buildDecisionRequest(decision);
  validateJevResponse({ ...request, model: response?.model }, response);
  const { policy } = decision;
  const candidates = decision.options.map((option, index) => {
    const scores = Object.fromEntries(["benefit", "cost", "risk"].map((key) => [key, response.answers[`option_${index}_${key}`]]));
    const gates = Object.fromEntries(["fairness", "commitments"].map((key) => [key, response.answers[`option_${index}_${key}`].noul]));
    const blocked = [];
    const uncertain = [];
    for (const check of policy.requiredChecks) {
      if (!own(option.checks, check) || option.checks[check] !== true) blocked.push(`Required check not verified: ${check}`);
    }
    if (!option.reversible && !policy.allowIrreversible) blocked.push("Irreversible commitment requires a probe or an explicit policy change.");
    for (const [gate, probability] of Object.entries(gates)) {
      if (probability <= 1 - policy.minGateProbability) blocked.push(`${gate} standard is not satisfied by the model assessment.`);
      else if (probability < policy.minGateProbability) uncertain.push(`${gate} compliance is uncertain.`);
    }
    for (const [dimension, answer] of Object.entries(scores)) {
      if (answer.confidence < policy.minConfidence) uncertain.push(`${dimension} score has low confidence.`);
    }
    if (scores.risk.confidence >= policy.minConfidence && scores.risk.score > policy.maxRiskScore) {
      blocked.push("Assessed downside exceeds the risk cap.");
    }
    if (scores.cost.confidence >= policy.minConfidence && scores.cost.score > policy.maxCostScore) {
      blocked.push("Assessed resource cost exceeds the cost cap.");
    }
    const utility = (policy.weights.benefit * scores.benefit.score - policy.weights.cost * scores.cost.score - policy.weights.risk * scores.risk.score) / 2;
    return {
      id: option.id,
      status: blocked.length ? "blocked" : uncertain.length ? "review" : "eligible",
      utility,
      reasons: [...blocked, ...uncertain],
      scores,
      gates,
    };
  }).sort((a, b) => b.utility - a.utility);
  const problemClass = response.answers.problem_class;
  const eligible = candidates.filter((candidate) => candidate.status === "eligible");
  const uncertain = candidates.filter((candidate) => candidate.status === "review");
  let status = "recommend";
  const reasons = [];
  if (eligible.length === 0) {
    status = uncertain.length ? "review" : "blocked";
    reasons.push("No option passed every decision gate.");
  } else {
    if (problemClass.choice === "unknown" || problemClass.confidence < policy.minConfidence) reasons.push("Problem classification needs review.");
    if (eligible[1] && eligible[0].utility - eligible[1].utility < policy.minMargin) reasons.push("Leading eligible options are too close to distinguish.");
    if (uncertain.length) reasons.push("An unblocked option still has an uncertain assessment.");
    if (reasons.length) status = "review";
  }
  return {
    status,
    selectedOption: status === "recommend" ? eligible[0].id : null,
    reasons,
    model: response.model,
    problemClass,
    policy,
    candidates,
    ...(response.usage ? { usage: response.usage } : {}),
  };
}

export async function assessDecision(input, adapter) {
  const decision = normalizeDecision(input);
  requireInput(typeof adapter?.evaluate === "function", "Provide a decision adapter with an evaluate method.");
  const response = await adapter.evaluate(buildDecisionRequest(decision));
  return applyDecisionPolicy(decision, response);
}
