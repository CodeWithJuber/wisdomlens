import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { HOOK_MAX_AGE_DAYS, pruneStaleLogs, sanitizeSessionId } from "../scripts/tripwire-check.mjs";

const cli = fileURLToPath(new URL("../scripts/tripwire-check.mjs", import.meta.url));

function hookRun(projectDir, payload, rawInput, extraEnv = {}, script = cli) {
  return spawnSync(process.execPath, [script, "--hook"], {
    input: rawInput !== undefined ? rawInput : JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: projectDir,
      WISDOM_LENS_TRIPWIRE: "",
      CLAUDE_PLUGIN_OPTION_TRIPWIRE: "",
      ...extraEnv,
    },
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

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), "tripwire-hook-"));
  tempDirs.push(dir);
  return dir;
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
  const stateDir = join(dir, "tripwire");
  const files = readdirSync(stateDir);
  assert.deepEqual(files, ["etc-x.log"]);
  assert.ok(!existsSync(join(dir, "etc-x.json")));
});

test("state persists across invocations and stays bounded", () => {
  const dir = freshProject();
  const event = payload("sess-e", "exec", { id: 1 });
  for (let i = 0; i < 5; i++) hookRun(dir, event);
  const lines = readFileSync(join(dir, "tripwire", "sess-e.log"), "utf8").trim().split("\n");
  assert.equal(lines.length, 5);
  for (const line of lines) assert.match(line, /^[0-9a-f]{32}$/);
});

test("a different call after a trip is allowed; only a live repeat blocks", () => {
  const dir = freshProject();
  const a = payload("sess-f", "Bash", { command: "npm test" });
  assert.equal(hookRun(dir, a).status, 0);
  assert.equal(hookRun(dir, a).status, 0);
  assert.equal(hookRun(dir, a).status, 2);
  assert.equal(hookRun(dir, payload("sess-f", "Read", { file_path: "a.js" })).status, 0);
  assert.equal(hookRun(dir, payload("sess-f", "Edit", { file_path: "a.js" })).status, 0);
  assert.equal(hookRun(dir, a).status, 0);
  assert.equal(hookRun(dir, a).status, 0);
  const again = hookRun(dir, a);
  assert.equal(again.status, 2, again.stderr);
  assert.ok(again.stderr.includes("WISDOM_LENS_TRIPWIRE=off"), "the block names the off switch");
});

test("raw tool input never reaches disk and nothing is written to the project", () => {
  const data = freshProject();
  const project = freshProject();
  const secret = "sk-live-DO-NOT-STORE";
  const event = payload("sess-g", "Write", { file_path: ".env", content: `KEY=${secret}` });
  const result = hookRun(data, event, undefined, { CLAUDE_PROJECT_DIR: project });
  assert.equal(result.status, 0, result.stderr);
  const files = readdirSync(join(data, "tripwire"));
  assert.ok(files.length > 0, "the hook kept state");
  for (const name of files) {
    assert.ok(!readFileSync(join(data, "tripwire", name), "utf8").includes(secret), name);
  }
  assert.deepEqual(readdirSync(project), []);
});

test("WISDOM_LENS_TRIPWIRE=off disables the hook", () => {
  const dir = freshProject();
  const event = payload("sess-h", "grep", { pattern: "x" });
  for (let i = 0; i < 3; i++) {
    assert.equal(hookRun(dir, event, undefined, { WISDOM_LENS_TRIPWIRE: "off" }).status, 0);
  }
  assert.ok(!existsSync(join(dir, "tripwire")));
});

test("the hook still runs when the plugin path goes through a symlink", { skip: process.platform === "win32" }, () => {
  const dir = freshProject();
  const link = join(freshProject(), "plugin");
  symlinkSync(fileURLToPath(new URL("..", import.meta.url)), link, "dir");
  const viaLink = join(link, "scripts", "tripwire-check.mjs");
  const event = payload("sess-i", "grep", { pattern: "x" });
  assert.equal(hookRun(dir, event, undefined, {}, viaLink).status, 0);
  assert.equal(hookRun(dir, event, undefined, {}, viaLink).status, 0);
  const third = hookRun(dir, event, undefined, {}, viaLink);
  assert.equal(third.status, 2, third.stderr);
});

const posixOnly = { skip: process.platform === "win32" || typeof process.getuid !== "function" };

test("without CLAUDE_PLUGIN_DATA the hook keeps state in a per-user temp dir", posixOnly, () => {
  const tmp = freshProject();
  const env = { TMPDIR: tmp, TMP: tmp, TEMP: tmp };
  const event = payload("sess-j", "grep", { pattern: "x" });
  assert.equal(hookRun("", event, undefined, env).status, 0);
  assert.equal(hookRun("", event, undefined, env).status, 0);
  assert.equal(hookRun("", event, undefined, env).status, 2);
  assert.ok(existsSync(join(tmp, `wisdom-lens-${process.getuid()}`, "tripwire", "sess-j.log")));
});

test("the temp fallback refuses a symlinked state dir and fails open", posixOnly, () => {
  const tmp = freshProject();
  const elsewhere = freshProject();
  symlinkSync(elsewhere, join(tmp, `wisdom-lens-${process.getuid()}`), "dir");
  const env = { TMPDIR: tmp, TMP: tmp, TEMP: tmp };
  const event = payload("sess-k", "grep", { pattern: "x" });
  for (let i = 0; i < 3; i++) {
    const result = hookRun("", event, undefined, env);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stderr.includes("allowing"), result.stderr);
  }
  assert.deepEqual(readdirSync(elsewhere), []);
});

test("parallel hook calls never drop each other's records", async () => {
  const dir = freshProject();
  const runs = Array.from({ length: 20 }, (_, i) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, "--hook"], {
        env: { ...process.env, CLAUDE_PLUGIN_DATA: dir, WISDOM_LENS_TRIPWIRE: "", CLAUDE_PLUGIN_OPTION_TRIPWIRE: "" },
        stdio: ["pipe", "ignore", "ignore"],
      });
      child.on("error", reject);
      child.on("exit", resolve);
      child.stdin.end(JSON.stringify(payload("race", "Read", { file_path: `f${i}.js` })));
    }),
  );
  assert.deepEqual(await Promise.all(runs), Array(20).fill(0));
  const lines = readFileSync(join(dir, "tripwire", "race.log"), "utf8").trim().split("\n");
  assert.equal(lines.length, 20);
});

test("a subagent's calls are counted apart from its parent session", () => {
  const dir = freshProject();
  const parent = payload("sess-l", "grep", { pattern: "x" });
  const sub = { ...payload("sess-l", "grep", { pattern: "x" }), agent_id: "agent-1" };
  assert.equal(hookRun(dir, parent).status, 0);
  assert.equal(hookRun(dir, sub).status, 0, "the subagent's first call is its own first call");
  assert.equal(hookRun(dir, { ...sub, tool_name: "Read" }).status, 0);
  assert.equal(hookRun(dir, parent).status, 0);
  const third = hookRun(dir, parent);
  assert.equal(third.status, 2, "subagent calls neither reset nor extend the parent's run");
  assert.deepEqual(readdirSync(join(dir, "tripwire")).sort(), ["sess-l--agent-1.log", "sess-l.log"]);
});

test("a new session deletes tripwire logs untouched for longer than the max age", () => {
  const dir = freshProject();
  const stateDir = join(dir, "tripwire");
  mkdirSync(stateDir);
  const old = (Date.now() - (HOOK_MAX_AGE_DAYS + 1) * 86_400_000) / 1000;
  for (const name of ["old.log", "old.log.123.tmp", "keep.txt"]) {
    writeFileSync(join(stateDir, name), "x\n");
    utimesSync(join(stateDir, name), old, old);
  }
  writeFileSync(join(stateDir, "recent.log"), "x\n");
  assert.equal(hookRun(dir, payload("sess-m", "grep", {})).status, 0);
  assert.deepEqual(readdirSync(stateDir).sort(), ["keep.txt", "recent.log", "sess-m.log"]);
  assert.deepEqual(pruneStaleLogs(stateDir), [], "nothing else is stale");
});
