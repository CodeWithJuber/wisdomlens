#!/usr/bin/env node
/**
 * token-audit.mjs — installed token-cost audit for the wisdom-lens skills.
 *
 * The failure mode: a skill grows one reference file at a time, and nobody
 * notices the installed cost until the context window is gone. Every file
 * added to skills/ is a tax on every session that loads the skill. This
 * script makes the tax visible and gates it.
 *
 * What it measures: for each skill directory under skills/, the total bytes
 * of SKILL.md + references/ + scripts/ + assets/ (everything the host loads
 * or the skill references), converted to a rough token estimate at 4
 * characters per token. This is an estimate, not a tokenizer run — the
 * point is trend and budget, not precision.
 *
 * Checks (node stdlib only, no network):
 *  1. Every skill directory has a SKILL.md. Missing = FAIL.
 *  2. No skill exceeds its token budget (see BUDGETS). Over = FAIL.
 *     Budgets are generous ceilings, not targets — a skill at 95% of
 *     budget is a smell even if it passes.
 *
 * Exit 0 when all checks pass, non-zero with details otherwise.
 * `--json` prints a machine-readable summary.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHARS_PER_TOKEN = 4;

// Budgets in estimated tokens. Set with headroom above current measured
// cost (2026-10-14); raise deliberately, never silently.
const BUDGETS = {
  "builder-protocol": 8000,
  "decision-engine": 18000,
  "new-lens": 14000,
};

const failures = [];
const rows = [];

function fail(message) {
  failures.push(message);
}

function bytesUnder(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += bytesUnder(child);
    } else if (entry.isFile()) {
      total += statSync(child).size;
    }
  }
  return total;
}

const skillsDir = join(root, "skills");
const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (skillNames.length === 0) fail("skills/: no skill directories found");

for (const name of skillNames) {
  const dir = join(skillsDir, name);
  const skillFile = join(dir, "SKILL.md");
  if (!existsSync(skillFile)) {
    fail(`skills/${name}: missing SKILL.md`);
    continue;
  }
  const bytes = bytesUnder(dir);
  const tokens = Math.ceil(bytes / CHARS_PER_TOKEN);
  const budget = BUDGETS[name];
  if (budget === undefined) {
    fail(`skills/${name}: no token budget defined in BUDGETS — add one deliberately`);
    continue;
  }
  const status = tokens > budget ? "OVER" : "ok";
  if (tokens > budget) {
    fail(
      `skills/${name}: ~${tokens.toLocaleString()} tokens exceeds budget of ${budget.toLocaleString()}`,
    );
  }
  rows.push({ name, bytes, tokens, budget, status });
}

const asJson = process.argv.includes("--json");
if (asJson) {
  console.log(JSON.stringify({ skills: rows, failures }, null, 2));
} else {
  const nameW = Math.max(16, ...rows.map((r) => r.name.length));
  console.log(
    `${"skill".padEnd(nameW)}  ${"bytes".padStart(9)}  ${"~tokens".padStart(9)}  ${"budget".padStart(9)}  status`,
  );
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(nameW)}  ${r.bytes.toLocaleString().padStart(9)}  ${r.tokens.toLocaleString().padStart(9)}  ${r.budget.toLocaleString().padStart(9)}  ${r.status}`,
    );
  }
  const total = rows.reduce((s, r) => s + r.tokens, 0);
  console.log(`\nTotal installed cost: ~${total.toLocaleString()} tokens (estimate, ${CHARS_PER_TOKEN} chars/token)`);
}

if (failures.length) {
  console.error(`\n${failures.map((f) => `- ${f}`).join("\n")}`);
  process.exit(1);
}
