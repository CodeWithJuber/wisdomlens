import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ROUTES, promptFromPayload, route, routeContext, routerDisabled } from "../scripts/prompt-router.mjs";
import { TRIGGERS } from "../scripts/session-context.mjs";

const routerScript = fileURLToPath(new URL("../scripts/prompt-router.mjs", import.meta.url));
const hooks = JSON.parse(readFileSync(new URL("../hooks/hooks.json", import.meta.url), "utf8")).hooks;

function runHook(input, env = {}) {
  return spawnSync(process.execPath, [routerScript], {
    input,
    encoding: "utf8",
    env: { ...process.env, WISDOM_LENS_ROUTER: "", ...env },
  });
}

const ROUTED = [
  ["Should I take the new job or stay where I am?", ["decision-engine"]],
  ["Weigh the pros and cons of migrating to the cloud", ["decision-engine"]],
  ["Make the call: go or no-go on Friday", ["decision-engine"]],
  ["mujhe faisla karna hai, kaunsa better hai", ["decision-engine"]],
  ["Is this ready to merge?", ["builder-protocol"]],
  ["Spec this out with acceptance criteria", ["builder-protocol"]],
  ["Push it to production, the work is done", ["builder-protocol"]],
  ["Why did the agent loop three times on the same step?", ["new-lens"]],
  ["The AI agreed with everything I said", ["new-lens"]],
  ["How do I spot hallucination and sycophancy?", ["new-lens"]],
  ["Should we deploy now? The agent keeps failing", ["builder-protocol", "decision-engine", "new-lens"]],
];

// Off-topic prompts, including the trigger-test negatives and everyday coding
// requests that share a word with a route, must route nowhere.
const SILENT = [
  "Rename this variable",
  "What time is lunch with everything",
  "Format this date as ISO 8601",
  "Fix the for loop in parser.js",
  "Merge these two functions into one",
  "/review",
  "",
];

test("each prompt routes to exactly the expected skills", () => {
  for (const [prompt, skills] of ROUTED) {
    assert.deepEqual(route(prompt).map((hit) => hit.skill), skills, prompt);
  }
});

test("off-topic prompts route nowhere", () => {
  for (const prompt of SILENT) {
    assert.deepEqual(route(prompt), [], prompt);
    assert.equal(routeContext(prompt), "", prompt);
  }
});

test("every routed skill carries a SessionStart trigger", () => {
  const triggered = TRIGGERS.map(([skill]) => skill);
  for (const [skill] of ROUTES) assert.ok(triggered.includes(skill), skill);
});

test("UserPromptSubmit runs the router as a command hook", () => {
  const commands = (hooks.UserPromptSubmit ?? []).flatMap((group) => group.hooks);
  assert.ok(
    commands.some((hook) => hook.type === "command" && hook.command.includes("scripts/prompt-router.mjs")),
    "UserPromptSubmit must run scripts/prompt-router.mjs",
  );
  for (const hook of commands) assert.ok((hook.timeout ?? 30) <= 10, "a prompt hook must stay fast");
});

test("the hook prints plain-text routing for a matching prompt", () => {
  const result = runHook(JSON.stringify({ prompt: "Help me decide between two vendors" }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Wisdom Lens routing for this prompt/);
  assert.match(result.stdout, /- Load the decision-engine skill: /);
  assert.ok(!result.stdout.trimStart().startsWith("{"), "plain text, so Claude Code adds it as context");
});

test("the hook prints nothing and exits 0 for malformed or off-topic input", () => {
  for (const input of ["", "not json", "[1]", "null", '{"prompt": 5}', JSON.stringify({ prompt: "Rename this variable" })]) {
    const result = runHook(input);
    assert.equal(result.status, 0, `${input}: ${result.stderr}`);
    assert.equal(result.stdout, "", input);
  }
});

test("WISDOM_LENS_ROUTER turns the router off", () => {
  for (const value of ["off", "OFF", "0", "false", "no"]) {
    assert.ok(routerDisabled({ WISDOM_LENS_ROUTER: value }), value);
    const result = runHook(JSON.stringify({ prompt: "Should I decide now?" }), { WISDOM_LENS_ROUTER: value });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "", value);
  }
  assert.ok(!routerDisabled({}));
});

test("promptFromPayload tolerates anything", () => {
  assert.equal(promptFromPayload('{"prompt":"hi"}'), "hi");
  for (const raw of ["", "x", "null", "[]", '{"prompt":{}}']) assert.equal(promptFromPayload(raw), "", raw);
});
