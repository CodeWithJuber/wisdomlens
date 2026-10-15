#!/usr/bin/env node
/**
 * tripwire-check.mjs — executable repetition tripwire (new-lens Ch.1).
 *
 * Rule: "same action three times means locked — halt." This module counts
 * consecutive identical tool calls (same tool name + same normalized
 * arguments); on the third consecutive identical call it returns a block
 * with the HALT-LOOP message instead of allowing another attempt.
 *
 * Usage:
 *   node scripts/tripwire-check.mjs --self-test        # run built-in unit tests
 *   node scripts/tripwire-check.mjs --hook             # PreToolUse hook: one hook payload on stdin
 *   node scripts/tripwire-check.mjs events.json        # scan a JSON array of {tool, args}
 *   cat events.json | node scripts/tripwire-check.mjs  # same, via stdin
 *
 * Sequence-scan mode exits 0 when no tripwire fires and 2 with the
 * HALT-LOOP message on stderr when one does.
 *
 * Hook mode (`--hook`) consumes a single Claude Code PreToolUse payload from
 * stdin and blocks (exit 2) only while the newest calls are a run of >= 3
 * identical calls; a different call ends the run. It stores a one-way hash
 * per call (never the raw tool input) in a per-session log (per subagent when
 * the payload carries an agent_id) under the plugin data dir
 * (CLAUDE_PLUGIN_DATA, else a per-user temp dir), never in the user's
 * project. Logs untouched for HOOK_MAX_AGE_DAYS are deleted when a new log
 * starts. Set WISDOM_LENS_TRIPWIRE=off to turn it off. Registered in
 * hooks/hooks.json so the tripwire actually runs before every tool call.
 *
 * Dependency-free (node stdlib only). Importing this module performs no I/O.
 */

import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HALT_LOOP_MESSAGE = "HALT-LOOP: same action three times — halt and change approach";
export const DEFAULT_LIMIT = 3;

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

/** Stable serialization so key order or whitespace never masks a repeat. */
export function normalizeArgs(args) {
  return JSON.stringify(sortKeys(args === undefined ? null : args));
}

/**
 * Counts consecutive identical tool calls. Identical means the same tool
 * name with the same normalized arguments. Any differing call resets the
 * counter. On the `limit`-th consecutive identical call (default 3) the
 * result is blocked.
 */
export class Tripwire {
  constructor(limit = DEFAULT_LIMIT) {
    if (!Number.isInteger(limit) || limit < 2) {
      throw new Error("Tripwire limit must be an integer of at least 2.");
    }
    this.limit = limit;
    this.lastKey = null;
    this.count = 0;
  }

  observe(tool, args) {
    const key = `${String(tool)}::${normalizeArgs(args)}`;
    this.count = key === this.lastKey ? this.count + 1 : 1;
    this.lastKey = key;
    if (this.count >= this.limit) {
      return { blocked: true, count: this.count, message: HALT_LOOP_MESSAGE };
    }
    return { blocked: false, count: this.count, message: null };
  }

  reset() {
    this.lastKey = null;
    this.count = 0;
  }
}

/**
 * Scans an ordered event list and reports the first tripwire firing.
 * Returns null when nothing trips.
 */
export function scanSequence(events, limit = DEFAULT_LIMIT) {
  const tripwire = new Tripwire(limit);
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const result = tripwire.observe(event.tool, event.args);
    if (result.blocked) {
      return { index, tool: event.tool, count: result.count, message: result.message };
    }
  }
  return null;
}

/** Hook state lives outside the user's repo: the plugin data dir, else a per-user temp dir. */
export const HOOK_STATE_DIRNAME = "tripwire";
/** A session log is compacted past HOOK_MAX_LINES; only the trailing run matters. */
export const HOOK_MAX_LINES = 200;
export const HOOK_KEEP_LINES = 20;
/** Session logs untouched this long are deleted when a new log starts. */
export const HOOK_MAX_AGE_DAYS = 7;
const OFF_VALUES = /^(0|false|off|no)$/i;

/** Keep session ids filename-safe (no path traversal); fall back to "default". */
export function sanitizeSessionId(sessionId) {
  const clean = String(sessionId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return clean || "default";
}

/** True when the user turned the tripwire off (env var or plugin option). */
export function tripwireDisabled(env = process.env) {
  return [env.WISDOM_LENS_TRIPWIRE, env.CLAUDE_PLUGIN_OPTION_TRIPWIRE].some((value) =>
    OFF_VALUES.test(String(value ?? "").trim()),
  );
}

export function hookStateDir(env = process.env) {
  const uid = typeof process.getuid === "function" ? process.getuid() : "user";
  const base = env.CLAUDE_PLUGIN_DATA || join(tmpdir(), `wisdom-lens-${uid}`);
  return join(base, HOOK_STATE_DIRNAME);
}

/**
 * One log per session, and one per subagent when the payload carries an
 * agent_id, so a subagent's calls never break or extend the parent's run.
 */
export function hookStateFile(sessionId, env = process.env, agentId = undefined) {
  const stream = agentId ? `${sanitizeSessionId(sessionId)}--${sanitizeSessionId(agentId)}` : sanitizeSessionId(sessionId);
  return join(hookStateDir(env), `${stream}.log`);
}

/**
 * Deletes session logs (and leftover compaction temp files) in `dir` that
 * were last written more than `maxAgeDays` ago. Best effort: a file another
 * hook already removed, or one we cannot stat, is skipped. Returns the names
 * it removed.
 */
export function pruneStaleLogs(dir, maxAgeDays = HOOK_MAX_AGE_DAYS, now = Date.now()) {
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!/^[A-Za-z0-9_-]+\.log(\.\d+\.tmp)?$/.test(name)) continue;
    try {
      const file = join(dir, name);
      if (statSync(file).mtimeMs < cutoff) {
        unlinkSync(file);
        removed.push(name);
      }
    } catch {
      // Raced with another hook or unreadable: leave it.
    }
  }
  return removed;
}

/**
 * The temp fallback sits in a directory other users can write to (e.g. /tmp).
 * Refuse a base dir that is a symlink or belongs to someone else, so another
 * local user cannot redirect or read the log. No-op where uids don't exist.
 */
function assertOwnDir(dir) {
  if (typeof process.getuid !== "function") return;
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.uid !== process.getuid()) {
    throw new Error(`${dir} is a symlink or not owned by this user`);
  }
}

/** One-way digest of a call: equality is all the tripwire needs, so raw inputs never touch disk. */
export function hookKey(tool, args) {
  return createHash("sha256").update(`${String(tool)}::${normalizeArgs(args)}`).digest("hex").slice(0, 32);
}

/** Length of the run of `key` at the END of the log; only a live repeat counts. */
export function trailingRun(lines, key) {
  let run = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i] === key; i--) run++;
  return run;
}

/**
 * --hook: consume one Claude Code PreToolUse payload from stdin.
 *
 * Appends a one-way hash of {tool, args} to an append-only per-session log
 * under the plugin data dir, and blocks (exit 2, HALT-LOOP on stderr) only
 * while the newest calls are a run of >= 3 identical calls. A different call
 * ends the run, so one trip never blocks unrelated calls. Raw tool input is
 * never written to disk. WISDOM_LENS_TRIPWIRE=off (or the plugin option)
 * turns the hook off. Fail-open: any malformed payload or state error allows
 * the tool call so a broken hook never bricks the agent session.
 */
export function hookMode() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    console.error("tripwire-check --hook: could not parse hook payload; allowing");
    process.exit(0);
  }
  // Checked after stdin is consumed, so the host never writes into a closed pipe.
  if (tripwireDisabled()) process.exit(0);
  if (payload === null || typeof payload !== "object") {
    console.error("tripwire-check --hook: hook payload is not an object; allowing");
    process.exit(0);
  }
  const tool = payload.tool_name;
  if (typeof tool !== "string" || tool.length === 0) {
    // Not a tool-call payload (or a future event shape) — nothing to count.
    process.exit(0);
  }
  let run = 0;
  try {
    const dir = hookStateDir();
    if (!process.env.CLAUDE_PLUGIN_DATA) {
      const base = dirname(dir);
      mkdirSync(base, { recursive: true, mode: 0o700 });
      assertOwnDir(base);
    }
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = hookStateFile(payload.session_id, process.env, payload.agent_id);
    // A new log means a new session or subagent: a cheap moment to drop old ones.
    if (!existsSync(file)) pruneStaleLogs(dir);
    const key = hookKey(tool, payload.tool_input ?? null);
    // O_APPEND: parallel tool calls never overwrite each other's records.
    appendFileSync(file, `${key}\n`, { mode: 0o600 });
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    run = trailingRun(lines, key);
    if (lines.length > HOOK_MAX_LINES) {
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, `${lines.slice(-HOOK_KEEP_LINES).join("\n")}\n`, { mode: 0o600 });
      renameSync(tmp, file);
    }
  } catch (error) {
    console.error(`tripwire-check --hook: cannot use state (${error.message}); allowing`);
    process.exit(0);
  }
  if (run >= DEFAULT_LIMIT) {
    console.error(
      `${HALT_LOOP_MESSAGE} (tool "${tool}" called ${run}x in a row with identical arguments). ` +
        "Read the last result and change the command, arguments, or hypothesis before retrying. " +
        "To turn the tripwire off, set WISDOM_LENS_TRIPWIRE=off.",
    );
    process.exit(2);
  }
  process.exit(0);
}

function assertSelfTest(condition, label) {
  if (!condition) {
    throw new Error(`self-test failure: ${label}`);
  }
  return label;
}

/** `node scripts/tripwire-check.mjs --self-test` — the check tests itself. */
export function selfTest() {
  const passed = [];

  // 1. Three consecutive identical calls trip the wire on the third.
  {
    const wire = new Tripwire();
    const args = { path: "src/index.ts", pattern: "TODO" };
    assertSelfTest(wire.observe("grep", args).blocked === false, "1st identical call is not blocked");
    assertSelfTest(wire.observe("grep", args).blocked === false, "2nd identical call is not blocked");
    const third = wire.observe("grep", args);
    assertSelfTest(third.blocked === true, "3rd identical call is blocked");
    assertSelfTest(third.count === 3, "block reports count 3");
    assertSelfTest(third.message === HALT_LOOP_MESSAGE, "block carries the exact HALT-LOOP message");
    passed.push("three identical consecutive calls block on the third");
  }

  // 2. Two identical calls followed by a different one reset the counter.
  {
    const wire = new Tripwire();
    const args = { q: "retry" };
    wire.observe("search", args);
    wire.observe("search", args);
    const different = wire.observe("read", args);
    assertSelfTest(different.blocked === false && different.count === 1, "a different tool resets the counter");
    wire.observe("search", args);
    assertSelfTest(wire.observe("search", args).blocked === false, "two repeats after a reset are still allowed");
    assertSelfTest(wire.observe("search", args).blocked === true, "the third repeat after a reset blocks");
    passed.push("two identical then different resets the tripwire");
  }

  // 3. Same args on different tools never trip.
  {
    const wire = new Tripwire();
    const args = { path: "x" };
    let blocked = false;
    for (const tool of ["read", "grep", "glob", "read", "grep"]) {
      blocked = wire.observe(tool, args).blocked || blocked;
    }
    assertSelfTest(blocked === false, "alternating tools never block");
    passed.push("different tools with identical args never block");
  }

  // 4. Same tool with different args never trips.
  {
    const wire = new Tripwire();
    let blocked = false;
    for (let i = 0; i < 5; i++) {
      blocked = wire.observe("fetch", { url: `https://example.com/${i}` }).blocked || blocked;
    }
    assertSelfTest(blocked === false, "varying arguments never block");
    passed.push("same tool with different args never blocks");
  }

  // 5. Argument normalization: key order and undefined vs null do not mask repeats.
  {
    const wire = new Tripwire();
    wire.observe("run", { b: 2, a: 1 });
    wire.observe("run", { a: 1, b: 2 });
    assertSelfTest(wire.observe("run", { b: 2, a: 1 }).blocked === true, "key order does not mask a repeat");
    const wire2 = new Tripwire();
    wire2.observe("run");
    wire2.observe("run", null);
    assertSelfTest(wire2.observe("run", undefined).blocked === true, "undefined args match null args");
    passed.push("argument normalization is order-insensitive");
  }

  // 6. Sequence scan finds the first trip and stays silent on clean sequences.
  {
    const trip = scanSequence([
      { tool: "read", args: { path: "a" } },
      { tool: "grep", args: { pattern: "x" } },
      { tool: "grep", args: { pattern: "x" } },
      { tool: "grep", args: { pattern: "x" } },
      { tool: "read", args: { path: "b" } },
    ]);
    assertSelfTest(trip !== null && trip.index === 3 && trip.tool === "grep", "scanSequence reports the trip at index 3");
    assertSelfTest(trip.message === HALT_LOOP_MESSAGE, "scanSequence carries the HALT-LOOP message");
    const clean = scanSequence([
      { tool: "grep", args: { pattern: "x" } },
      { tool: "grep", args: { pattern: "x" } },
      { tool: "read", args: { path: "a" } },
    ]);
    assertSelfTest(clean === null, "scanSequence returns null for a clean sequence");
    passed.push("sequence scanning finds trips and passes clean sequences");
  }

  // 7. A 4th identical call stays blocked (the lock persists until the approach changes).
  {
    const wire = new Tripwire();
    const args = { id: 7 };
    wire.observe("exec", args);
    wire.observe("exec", args);
    wire.observe("exec", args);
    assertSelfTest(wire.observe("exec", args).blocked === true, "the lock persists past the third repeat");
    passed.push("the block persists while repeats continue");
  }

  return passed;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/tripwire-check.mjs --self-test",
    "  node scripts/tripwire-check.mjs --hook   # PreToolUse hook: one hook payload on stdin",
    "  node scripts/tripwire-check.mjs <events.json>",
    "  cat <events.json> | node scripts/tripwire-check.mjs",
    "",
    "<events.json> is a JSON array of {tool, args} objects in call order.",
    "Exit 0: no tripwire fired. Exit 2: HALT-LOOP fired (message on stderr).",
  ].join("\n");
}

function main(argv) {
  if (argv.includes("--hook")) {
    hookMode();
    return;
  }
  if (argv.includes("--self-test")) {
    try {
      const passed = selfTest();
      console.log(`tripwire self-test: ${passed.length}/${passed.length} passed`);
      for (const label of passed) console.log(`  ok - ${label}`);
      process.exit(0);
    } catch (error) {
      console.error(`tripwire self-test FAILED: ${error.message}`);
      process.exit(1);
    }
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }

  let raw;
  try {
    const source = argv.find((arg) => !arg.startsWith("-"));
    raw = source ? readFileSync(source, "utf8") : readFileSync(0, "utf8");
  } catch (error) {
    console.error(`tripwire-check: cannot read events (${error.message})`);
    console.error(usage());
    process.exit(1);
  }
  let events;
  try {
    events = JSON.parse(raw);
  } catch {
    console.error("tripwire-check: events must be a JSON array of {tool, args} objects");
    process.exit(1);
  }
  if (!Array.isArray(events) || events.some((e) => e === null || typeof e !== "object" || typeof e.tool !== "string")) {
    console.error("tripwire-check: events must be a JSON array of {tool, args} objects");
    process.exit(1);
  }
  const trip = scanSequence(events);
  if (trip) {
    console.error(`${trip.message} (tool "${trip.tool}" repeated at event index ${trip.index})`);
    process.exit(2);
  }
  console.log(`tripwire-check: ok, scanned ${events.length} events, no repetition tripwire fired`);
  process.exit(0);
}

/** Compares real paths, so the CLI still runs when the plugin dir is reached through a symlink. */
function isMainModule() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main(process.argv.slice(2));
}
