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

// What the harness submits by itself goes through UserPromptSubmit too. These are reports,
// not the user's request, so trigger words inside them must not load a skill. The first shape
// is a real subagent hand-back captured from Claude Code 2.1.323.
const HARNESS_MESSAGES = [
  '<agent-message from="aed8ce7ba9eb938ef">\n[Subagent hand-back] The text below is the final report of a subagent this session delegated to. The report follows:\n  Should we deploy now? The agent keeps failing.\n</agent-message>',
  "<task-notification>\n<status>completed</status>\n<result>Should we deploy now? The agent keeps failing.</result>\n</task-notification>",
  "[SYSTEM NOTIFICATION - NOT USER INPUT]\nShould we deploy now? The agent keeps failing.",
  '\n  <agent-message from="x">Is this ready to merge?</agent-message>',
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

test("messages the harness submits by itself route nowhere", () => {
  for (const prompt of HARNESS_MESSAGES) {
    assert.deepEqual(route(prompt), [], prompt);
    assert.equal(routeContext(prompt), "", prompt);
    const result = runHook(JSON.stringify({ prompt }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "", prompt);
  }
  // A person who pastes markup still gets routed: only the harness's own wrappers are skipped.
  assert.deepEqual(
    route("<div>pricing table</div> should we keep this layout?").map((hit) => hit.skill),
    ["decision-engine"],
  );
});

test("the routing line tells the model to load the skill, in one line", () => {
  const one = routeContext("Help me decide between two vendors");
  assert.equal(one, "Wisdom Lens: before you answer, load with the Skill tool: decision-engine (decision or tradeoff)");
  const many = routeContext("Should we deploy now? The agent keeps failing");
  assert.match(many, /^Wisdom Lens: before you answer, load with the Skill tool: /);
  for (const skill of ["builder-protocol", "decision-engine", "new-lens"]) assert.ok(many.includes(`${skill} (`), skill);
  assert.ok(!many.includes("\n"), "one line");
  assert.ok(many.length <= 240, `the longest routing line is ${many.length} characters`);
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
  assert.match(result.stdout, /^Wisdom Lens: before you answer, load with the Skill tool: /);
  assert.match(result.stdout, /decision-engine \(/);
  assert.equal(result.stdout.trim().split("\n").length, 1, "one line keeps the per-prompt cost small");
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
