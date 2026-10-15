#!/usr/bin/env node
/**
 * session-context.mjs — SessionStart hook: loads the Wisdom Lens skill
 * triggers and the per-response quality checks into Claude's context.
 *
 * SessionStart accepts only command and mcp_tool hooks, so prompt hooks on
 * that event never run. This command prints plain text, which Claude Code
 * adds to the context at session start and again after /clear or compaction.
 *
 * The quality checks live here, as guidance Claude applies while writing,
 * rather than in a Stop prompt hook: a Stop prompt hook that blocks on
 * judgement calls such as "is this foam?" never converges, and keeps Claude
 * in a revise loop until Claude Code's block cap ends the turn.
 *
 * Usage:
 *   node scripts/session-context.mjs   # print the context (hook mode)
 *
 * Set WISDOM_LENS_CONTEXT=off (or the session_context plugin option to false)
 * to print nothing.
 *
 * Dependency-free (node stdlib only). Importing this module performs no I/O.
 */

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Skills that carry a SessionStart trigger, in load order when ambiguous. */
export const TRIGGERS = [
  [
    "builder-protocol",
    "before writing, changing, or shipping any code, or before declaring any work done — trigger: building, coding, verifying, or shipping",
  ],
  [
    "decision-engine",
    "when the user faces a decision, tradeoff, or irreversible commitment — trigger: deciding, choosing, risk assessment, or high-stakes planning",
  ],
  [
    "new-lens",
    "when the agent is stuck in a repetition loop, hallucinating, being sycophantic, or producing disposable slop — trigger: doom loops, repeated failures, AI failure modes",
  ],
];

/** The Builder's Protocol quick checks, applied while a response is written. */
export const CHECKS = [
  "VERIFY: check at least one factual claim or citation in the response.",
  "SPECIFY: include quantities, criteria, or measurable outcomes where relevant.",
  "FOAM CHECK: would this response still be useful in six months, or is it foam?",
  "UNCERTAINTY: mark what is known vs. inferred vs. guessed.",
  "ATTRIBUTION: give honest credit where due.",
];

export const TONE =
  "Straight speech: direct, checkable, no weaponized ambiguity. Answer one level above any hostility in the conversation. Match content and depth to the actual listener. If the user is under pressure, acknowledge the capacity guarantee (they were built to handle this) and offer the two-channel protocol (strategic patience + daily reset).";

export function sessionContext() {
  return [
    "Wisdom Lens skills are installed.",
    "",
    "Skill triggers:",
    ...TRIGGERS.map(([skill, when]) => `- Load the ${skill} skill ${when}.`),
    "",
    "Builder's Protocol quick checks — apply them while writing each response, not after:",
    ...CHECKS.map((check, index) => `${index + 1}. ${check}`),
    "",
    `Tone check: ${TONE}`,
    "",
    "The Stop hook blocks a response only for a concrete defect: a claim that work is done or verified with no evidence shown, a citation or statistic stated as certain with no source, or a hostile or evasive reply. It blocks at most once per turn.",
  ].join("\n");
}

const OFF_VALUES = /^(0|false|off|no)$/i;

/** True when the user turned the session checklist off (env var or plugin option). */
export function contextDisabled(env = process.env) {
  return [env.WISDOM_LENS_CONTEXT, env.CLAUDE_PLUGIN_OPTION_SESSION_CONTEXT].some((value) =>
    OFF_VALUES.test(String(value ?? "").trim()),
  );
}

/** Compares real paths, so the hook still runs when the plugin dir is reached through a symlink. */
function isMainModule() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule() && !contextDisabled()) {
  process.stdout.write(`${sessionContext()}\n`);
}
