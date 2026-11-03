#!/usr/bin/env node
/**
 * prompt-router.mjs — UserPromptSubmit hook: names the Wisdom Lens skill(s)
 * whose trigger a prompt matches, so the right skill loads for this turn.
 *
 * SessionStart loads every trigger once (scripts/session-context.mjs). By the
 * tenth prompt that list sits far back in the context. This hook adds one
 * short line next to the prompt that needs it, and stays silent otherwise.
 * The patterns are narrow on purpose: a routing line on every coding prompt
 * would be noise, so "merge these two functions" or "fix the for loop" match
 * nothing (tests/prompt-router.test.mjs).
 *
 * Output is plain text, which Claude Code adds to the context next to the
 * prompt. The hook never blocks: it exits 0 on any input, including a
 * malformed payload.
 *
 * Usage:
 *   node scripts/prompt-router.mjs   # hook mode, reads the hook JSON on stdin
 *
 * Set WISDOM_LENS_ROUTER=off to print nothing.
 *
 * Dependency-free (node stdlib only). Importing this module performs no I/O.
 */

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** [skill, pattern, why]. Each skill must also carry a SessionStart trigger. */
export const ROUTES = [
  [
    "builder-protocol",
    /\b(ship (it|this)|ready to (merge|ship)|merge (the |this )?(pr|pull request|branch)|deploy\w*|to (production|prod)|acceptance criteria|spec (this|it) out|review (this|my|the) (plan|pr|diff)|the work is done|mark (it|this) (as )?done|definition of done)\b/i,
    "shipping or done: show evidence",
  ],
  [
    "decision-engine",
    /\b(should (i|we)|decid\w*|decision|which (option|one) is (best|better)|pros and cons|trade-?offs?|worth it|risk assessment|negotiat\w*|go or no-go|make the call|faisla|kaunsa)\b/i,
    "decision or tradeoff",
  ],
  [
    "new-lens",
    /\b(hallucinat\w*|sycophan\w*|doom loop|stuck in a loop|loop(ed)? (three|3|again)|keeps? (failing|repeating|looping)|going in circles|off track|agreed with everything|ai failure modes?|slop)\b/i,
    "AI failure mode: diagnose before retrying",
  ],
];

/** The skills whose route a prompt matches, in ROUTES order. */
export function route(prompt) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.trimStart().startsWith("/")) return [];
  return ROUTES.filter(([, pattern]) => pattern.test(prompt)).map(([skill, , why]) => ({ skill, why }));
}

/** The context text for a prompt, or "" when no route matches. */
export function routeContext(prompt) {
  const hits = route(prompt);
  if (hits.length === 0) return "";
  // One line: this lands next to the prompt on every match, so every word costs tokens.
  return `Wisdom Lens skill hint: ${hits.map(({ skill, why }) => `${skill} (${why})`).join("; ")}`;
}

const OFF_VALUES = /^(0|false|off|no)$/i;

/** True when the user turned prompt routing off. */
export function routerDisabled(env = process.env) {
  return OFF_VALUES.test(String(env.WISDOM_LENS_ROUTER ?? "").trim());
}

/** The prompt from a UserPromptSubmit payload; "" for anything malformed. */
export function promptFromPayload(raw) {
  try {
    const payload = JSON.parse(raw);
    return payload && typeof payload.prompt === "string" ? payload.prompt : "";
  } catch {
    return "";
  }
}

/** Compares real paths, so the hook still runs when the plugin dir is reached through a symlink. */
function isMainModule() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule() && !routerDisabled()) {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    raw = "";
  }
  const text = routeContext(promptFromPayload(raw));
  if (text) process.stdout.write(`${text}\n`);
}
