#!/usr/bin/env node
/**
 * rot-check.mjs — skill-rot audit for the dated statistics cited by new-lens.
 *
 * The failure mode: a working skill drifts. The world around it changes, the
 * file doesn't, and the output still looks fine. The cited statistics in
 * skills/new-lens/references/ai-failure-diagnostics.md are exactly that kind
 * of content — each source S1–S8 carries a `reverify-by:` date, and the
 * SKILL.md chapter lines point at them with [S#] cite markers.
 *
 * Checks (node stdlib only; network optional):
 *  1. Every source S1–S8 in the "## Sources" section has a `reverify-by:`
 *     date in YYYY-MM-DD form, and none is past today. A past date means the
 *     stat is stale until a human re-verifies the source — FAIL.
 *  2. Every `[S#]` cite marker in skills/new-lens/SKILL.md resolves to a
 *     "## Sources" entry. A dangling cite is a broken promise — FAIL.
 *  3. External URLs in the Sources section respond. Uses curl with a timeout;
 *     HTTP >= 400 fails. A transport error (no network, DNS, proxy) prints a
 *     warning and does NOT fail — a sandbox without egress must not red the
 *     build; the reverify-by dates are the hard rot gate.
 *
 * Exit 0 when all checks pass, non-zero with details otherwise.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

const today = new Date().toISOString().slice(0, 10);

const diagPath = join(
  root,
  "skills",
  "new-lens",
  "references",
  "ai-failure-diagnostics.md",
);
const diag = readFileSync(diagPath, "utf8");
const skill = readFileSync(
  join(root, "skills", "new-lens", "SKILL.md"),
  "utf8",
);

// --- Check 1: every source has a future reverify-by date -------------------
const sourcesSection = diag.split("## Sources")[1] ?? "";
// Split the section into blocks, one per "Sn. " header line.
const sourceBlocks = [];
let current = null;
for (const line of sourcesSection.split("\n")) {
  const header = line.match(/^(S[1-9]\d?)\. /);
  if (header) {
    if (current) sourceBlocks.push(current);
    current = { id: header[1], text: line };
  } else if (current) {
    current.text += `\n${line}`;
  }
}
if (current) sourceBlocks.push(current);
const seen = new Set();
for (const block of sourceBlocks) {
  const id = block.id;
  seen.add(id);
  const match = block.text.match(/reverify-by:\s*(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    fail(
      `${id}: missing reverify-by: date — the stat is unguarded against rot`,
    );
    continue;
  }
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
  ) {
    fail(`${id}: reverify-by date "${date}" is not a valid calendar date`);
    continue;
  }
  if (date < today) {
    fail(
      `${id}: reverify-by ${date} is past (today is ${today}) — re-verify the source before release`,
    );
  }
}
if (seen.size === 0)
  fail("## Sources section: no S#. entries parsed — expected S1–S8");

// --- Check 2: [S#] cites in SKILL.md resolve --------------------------------
const cites = [
  ...new Set([...skill.matchAll(/\[S([1-9]\d?)\]/g)].map((m) => `S${m[1]}`)),
];
for (const id of cites) {
  if (!seen.has(id)) {
    fail(
      `${id}: cited in skills/new-lens/SKILL.md but missing from ## Sources`,
    );
  }
}

// --- Check 3: external URLs in the Sources section --------------------------
const urls = [
  ...new Set(
    [...sourcesSection.matchAll(/https:\/\/[^\s)>"']+/g)].map((m) => m[0]),
  ),
];
for (const url of urls) {
  try {
    const out = execFileSync(
      "curl",
      [
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "-L",
        "--max-time",
        "15",
        url,
      ],
      { encoding: "utf8", timeout: 20000 },
    ).trim();
    const code = Number(out);
    if (!Number.isFinite(code) || code >= 400) {
      fail(`${url}: dead link (HTTP ${out}) — rot signal`);
    }
  } catch (error) {
    warn(
      `${url}: could not reach (${error.code ?? error.message}) — skipped, not failed`,
    );
  }
}

// --- Report -----------------------------------------------------------------
for (const message of warnings) console.warn(`warn: ${message}`);
if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log(
  `rot-check: ${seen.size} sources dated and future-dated, ${cites.length} cites resolved, ${urls.length} URLs probed (${warnings.length} network warnings).`,
);
