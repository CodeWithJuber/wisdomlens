import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { sanitizeSessionId } from "../scripts/tripwire-check.mjs";

const cli = fileURLToPath(new URL("../scripts/tripwire-check.mjs", import.meta.url));

function hookRun(projectDir, payload, rawInput) {
  return spawnSync(process.execPath, [cli, "--hook"], {
    input: rawInput !== undefined ? rawInput : JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

function payload(sessionId, tool, args) {
  return {
    session_id: sessionId,
    hook_event_name: "PreToolUse",
    tool_name: tool,
    tool_input: args,
  };
}

function freshProject() {
  return mkdtempSync(join(tmpdir(), "tripwire-hook-"));
}

test("three consecutive identical hook calls block on the third", () => {
  const dir = freshProject();
  const event = payload("sess-a", "grep", { pattern: "x" });
  assert.equal(hookRun(dir, event).status, 0);
  assert.equal(hookRun(dir, event).status, 0);
  const third = hookRun(dir, event);
  assert.equal(third.status, 2, third.stderr);
  assert.ok(third.stderr.includes("HALT-LOOP"));
});

test("a different tool call resets the hook tripwire", () => {
  const dir = freshProject();
  const same = payload("sess-b", "grep", { pattern: "x" });
  hookRun(dir, same);
  hookRun(dir, same);
  assert.equal(hookRun(dir, payload("sess-b", "read", { path: "a" })).status, 0);
  assert.equal(hookRun(dir, same).status, 0);
  assert.equal(hookRun(dir, same).status, 0);
  const third = hookRun(dir, same);
  assert.equal(third.status, 2);
});

test("sessions are isolated from each other", () => {
  const dir = freshProject();
  const event = payload("sess-c", "grep", { pattern: "x" });
  hookRun(dir, event);
  hookRun(dir, event);
  assert.equal(hookRun(dir, payload("sess-d", "grep", { pattern: "x" })).status, 0);
  assert.equal(hookRun(dir, event).status, 2);
});

test("malformed payload fails open with exit 0", () => {
  const dir = freshProject();
  const bad = hookRun(dir, null, "this is not json");
  assert.equal(bad.status, 0);
  assert.ok(bad.stderr.includes("allowing"));
});

test("payload without tool_name fails open with exit 0", () => {
  const dir = freshProject();
  assert.equal(hookRun(dir, { session_id: "s" }).status, 0);
});

test("session id is sanitized so state cannot escape the state dir", () => {
  const dir = freshProject();
  assert.equal(sanitizeSessionId("../../evil"), "evil");
  assert.equal(sanitizeSessionId(""), "default");
  hookRun(dir, payload("../../../etc-x", "grep", {}));
  const stateDir = join(dir, ".wisdom-lens");
  const files = readdirSync(stateDir);
  assert.deepEqual(files, ["tripwire-etc-x.json"]);
  assert.ok(!existsSync(join(dir, "etc-x.json")));
});

test("state persists across invocations and stays bounded", () => {
  const dir = freshProject();
  const event = payload("sess-e", "exec", { id: 1 });
  for (let i = 0; i < 5; i++) hookRun(dir, event);
  const events = JSON.parse(
    readFileSync(join(dir, ".wisdom-lens", "tripwire-sess-e.json"), "utf8"),
  );
  assert.equal(events.length, 5);
  assert.deepEqual(events[0], { tool: "exec", args: { id: 1 } });
});
