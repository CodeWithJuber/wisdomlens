import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CHECKS, TRIGGERS } from "../scripts/session-context.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const hooks = JSON.parse(readFileSync(new URL("../hooks/hooks.json", import.meta.url), "utf8")).hooks;
const contextScript = fileURLToPath(new URL("../scripts/session-context.mjs", import.meta.url));

function handlers(event) {
  return (hooks[event] ?? []).flatMap((group) => group.hooks);
}

// https://code.claude.com/docs/en/hooks#prompt-based-hooks — SessionStart runs
// only command and mcp_tool hooks; a prompt hook there is silently skipped.
test("SessionStart uses only hook types that run on SessionStart", () => {
  const types = handlers("SessionStart").map((hook) => hook.type);
  assert.ok(types.length > 0);
  for (const type of types) assert.ok(["command", "mcp_tool"].includes(type), `unsupported type '${type}'`);
});

// A Stop prompt hook that never returns ok keeps Claude revising until Claude
// Code's block cap ends the turn. Each one must let the stop through once a
// stop hook has already blocked (stop_hook_active), and must see that field.
test("every Stop prompt hook allows the stop when stop_hook_active is true", () => {
  for (const event of ["Stop", "SubagentStop"]) {
    for (const hook of handlers(event).filter((h) => h.type === "prompt" || h.type === "agent")) {
      assert.match(hook.prompt, /\$ARGUMENTS/, `${event} prompt must include the hook input`);
      assert.match(hook.prompt, /stop_hook_active[^\n]*\{"ok": true\}/, `${event} prompt must not loop`);
    }
  }
});

test("Stop has at most one blocking prompt hook", () => {
  assert.ok(handlers("Stop").filter((hook) => hook.type === "prompt").length <= 1);
});

test("every node script a hook runs exists", () => {
  for (const hook of Object.keys(hooks).flatMap(handlers).filter((h) => h.type === "command")) {
    const script = hook.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/)?.[1];
    assert.ok(script, `command does not resolve a plugin script: ${hook.command}`);
    assert.ok(existsSync(join(root, script)), `missing ${script}`);
  }
});

test("session-context prints every skill trigger and quality check", () => {
  const result = spawnSync(process.execPath, [contextScript], {
    encoding: "utf8",
    env: { ...process.env, WISDOM_LENS_CONTEXT: "", CLAUDE_PLUGIN_OPTION_SESSION_CONTEXT: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  for (const [skill] of TRIGGERS) assert.ok(result.stdout.includes(`${skill} skill`), skill);
  for (const check of CHECKS) assert.ok(result.stdout.includes(check), check);
  assert.ok(!result.stdout.trimStart().startsWith("{"), "plain text, so Claude Code adds it as context");
});

test("session-context names the skills trigger-test covers", () => {
  const triggerTest = readFileSync(new URL("../scripts/trigger-test.mjs", import.meta.url), "utf8");
  const listed = JSON.parse(triggerTest.match(/const SKILLS = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(TRIGGERS.map(([skill]) => skill), listed);
});

test("session-context prints nothing when turned off", () => {
  for (const env of [{ WISDOM_LENS_CONTEXT: "off" }, { CLAUDE_PLUGIN_OPTION_SESSION_CONTEXT: "false" }]) {
    const result = spawnSync(process.execPath, [contextScript], { encoding: "utf8", env: { ...process.env, ...env } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "", JSON.stringify(env));
  }
});

test("session-context still prints when the plugin path goes through a symlink", { skip: process.platform === "win32" }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), "hooks-config-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const link = join(dir, "plugin");
  symlinkSync(root, link, "dir");
  const result = spawnSync(process.execPath, [join(link, "scripts", "session-context.mjs")], {
    encoding: "utf8",
    env: { ...process.env, WISDOM_LENS_CONTEXT: "", CLAUDE_PLUGIN_OPTION_SESSION_CONTEXT: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("Wisdom Lens skills are installed."), "no context printed via the symlink");
});
