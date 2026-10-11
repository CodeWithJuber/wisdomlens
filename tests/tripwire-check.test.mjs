import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  HALT_LOOP_MESSAGE, Tripwire, normalizeArgs, scanSequence, selfTest,
} from "../scripts/tripwire-check.mjs";

const cli = fileURLToPath(new URL("../scripts/tripwire-check.mjs", import.meta.url));

test("three consecutive identical tool calls block with the HALT-LOOP message", () => {
  const wire = new Tripwire();
  const args = { path: "src/index.ts", pattern: "TODO" };
  assert.equal(wire.observe("grep", args).blocked, false);
  assert.equal(wire.observe("grep", args).blocked, false);
  const third = wire.observe("grep", args);
  assert.equal(third.blocked, true);
  assert.equal(third.message, HALT_LOOP_MESSAGE);
});

test("two identical calls followed by a different one reset the tripwire", () => {
  const wire = new Tripwire();
  wire.observe("search", { q: "retry" });
  wire.observe("search", { q: "retry" });
  const different = wire.observe("read", { q: "retry" });
  assert.equal(different.blocked, false);
  assert.equal(different.count, 1);
});

test("different tools with identical args never block", () => {
  const wire = new Tripwire();
  for (const tool of ["read", "grep", "glob", "read"]) {
    assert.equal(wire.observe(tool, { path: "x" }).blocked, false);
  }
});

test("argument key order does not mask a repeat", () => {
  assert.equal(normalizeArgs({ b: 2, a: 1 }), normalizeArgs({ a: 1, b: 2 }));
});

test("scanSequence reports the first trip and stays silent on clean sequences", () => {
  const trip = scanSequence([
    { tool: "read", args: { path: "a" } },
    { tool: "grep", args: { pattern: "x" } },
    { tool: "grep", args: { pattern: "x" } },
    { tool: "grep", args: { pattern: "x" } },
  ]);
  assert.ok(trip && trip.index === 3 && trip.message === HALT_LOOP_MESSAGE);
  assert.equal(scanSequence([{ tool: "a", args: {} }, { tool: "b", args: {} }]), null);
});

test("the check tests itself: --self-test exits 0", () => {
  const child = spawnSync(process.execPath, [cli, "--self-test"], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /7\/7 passed/);
  assert.deepEqual(selfTest().length, 7);
});

test("CLI scan mode exits 2 on a trip and 0 on a clean sequence", () => {
  const tripped = spawnSync(process.execPath, [cli],
    { input: JSON.stringify([{ tool: "g", args: {} }, { tool: "g", args: {} }, { tool: "g", args: {} }]), encoding: "utf8" });
  assert.equal(tripped.status, 2);
  assert.ok(tripped.stderr.includes("HALT-LOOP"));
  const clean = spawnSync(process.execPath, [cli],
    { input: JSON.stringify([{ tool: "g", args: {} }, { tool: "h", args: {} }]), encoding: "utf8" });
  assert.equal(clean.status, 0);
});
