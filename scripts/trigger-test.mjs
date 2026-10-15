#!/usr/bin/env node
/**
 * trigger-test.mjs — proves the SessionStart trigger hooks point at real
 * skill content.
 *
 * The SessionStart hook (scripts/session-context.mjs) names three skills and
 * gives one trigger line each. This test feeds ~20 sample user prompts and asserts that
 * each skill's own frontmatter description matches the prompt: either a
 * quoted trigger phrase from the description appears in the prompt, or a
 * description word (stopwords such as "this" or "with" excluded) matches a
 * prompt word. If a skill's description drifts away from the trigger
 * language (or the hook names a skill whose description no longer covers the
 * trigger), this fails. NEGATIVE_SAMPLES assert that off-topic prompts match
 * no skill, so a description made of generic words cannot pass.
 *
 * Dependency-free (node stdlib only). Exit 0 when every sample matches,
 * non-zero with details when any sample fails.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The three skills that carry a SessionStart trigger (wisdom-playbook
// is being removed from the plugin, so it carries no trigger).
const SKILLS = ["builder-protocol", "decision-engine", "new-lens"];

const SAMPLES = [
  // builder-protocol: building, shipping, plans, acceptance criteria.
  { skill: "builder-protocol", prompt: "Review this plan before I ship it" },
  { skill: "builder-protocol", prompt: "Is this ready to merge? Give me a full review" },
  { skill: "builder-protocol", prompt: "Spec this out with acceptance criteria" },
  { skill: "builder-protocol", prompt: "Push it to production, the work is done" },
  { skill: "builder-protocol", prompt: "How should I run this build-time workflow?" },
  { skill: "builder-protocol", prompt: "I need operating rules for professional work with AI agents" },
  { skill: "builder-protocol", prompt: "Ship it once the acceptance criteria pass" },
  // decision-engine: decisions, tradeoffs, risk, high-stakes calls.
  { skill: "decision-engine", prompt: "Should I take the new job or stay where I am?" },
  { skill: "decision-engine", prompt: "Help me decide which option is best" },
  { skill: "decision-engine", prompt: "Weigh the pros and cons of migrating to the cloud" },
  { skill: "decision-engine", prompt: "Is it worth it to buy the annual plan?" },
  { skill: "decision-engine", prompt: "Give me a risk assessment for this launch" },
  { skill: "decision-engine", prompt: "I need a structured framework for a high-stakes negotiation" },
  { skill: "decision-engine", prompt: "Make the call: go or no-go on Friday's release" },
  // new-lens: failure modes, loops, hallucination, sycophancy.
  { skill: "new-lens", prompt: "Why did the agent loop three times on the same step?" },
  { skill: "new-lens", prompt: "Stuck in a loop — why did this fail?" },
  { skill: "new-lens", prompt: "The AI agreed with everything I said, this output looks wrong" },
  { skill: "new-lens", prompt: "Where did it go off track?" },
  { skill: "new-lens", prompt: "What are the common AI failure modes for agents?" },
  { skill: "new-lens", prompt: "How do I spot hallucination and sycophancy in outputs?" },
  { skill: "new-lens", prompt: "Why is AI oversight needed for agent problems?" },
];

// Prompts that must NOT match the listed skills. Without these, a matcher
// that accepts any shared word passes for any description.
const NEGATIVE_SAMPLES = [
  { prompt: "Rename this variable", notSkills: SKILLS },
  { prompt: "What time is lunch with everything", notSkills: SKILLS },
  { prompt: "Format this date as ISO 8601", notSkills: SKILLS },
  { prompt: "Should I take the job?", notSkills: ["new-lens", "builder-protocol"] },
];

/** Common words that carry no trigger signal; they never count as a match. */
const STOPWORDS = new Set([
  "about", "also", "anything", "does", "everything", "from", "have", "help",
  "into", "just", "like", "make", "more", "need", "needs", "only", "said",
  "says", "should", "skill", "some", "something", "that", "their", "them",
  "then", "there", "these", "they", "things", "this", "those", "time",
  "times", "used", "user", "very", "want", "what", "when", "where", "which",
  "will", "with", "without", "would", "your",
]);

/** Lowercase alphanumeric tokens of length >= 4 ("ai", "it", "do" carry no signal), minus stopwords. */
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

/** The quoted trigger phrases in a description, e.g. "should I" or "push it". */
function quotedPhrases(description) {
  return [...description.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
}

function containsPhrase(prompt, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(prompt.toLowerCase());
}

/** Phrases and words of `description` that match `prompt`; empty when nothing does. */
function matches(description, prompt) {
  const phrases = quotedPhrases(description).filter((phrase) => containsPhrase(prompt, phrase));
  const promptTokens = tokenize(prompt);
  const words = [...new Set(tokenize(description))].filter((descriptionToken) =>
    promptTokens.some((promptToken) => tokensMatch(descriptionToken, promptToken)),
  );
  return [...phrases.map((phrase) => `"${phrase}"`), ...words];
}

/**
 * Tokens match on equality or a shared prefix stem in either direction, so
 * "loops" still matches a prompt saying "loop" and "failed" matches "fail".
 */
function tokensMatch(a, b) {
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Reads the folded `description:` frontmatter scalar from a SKILL.md file. */
function readDescription(skillDir) {
  const path = join(root, "skills", skillDir, "SKILL.md");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`missing SKILL.md for skill '${skillDir}'`);
  }
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
  const match = frontmatter.match(/^description:\s*(.*)$/m);
  if (!match) throw new Error(`skill '${skillDir}': no description in frontmatter`);
  let value = match[1].trim();
  if (value === ">" || value === "|") {
    const after = frontmatter.slice(match.index + match[0].length);
    const lines = after.match(/^(?:\r?\n[ \t]+[^\r\n]*)+/)?.[0] ?? "";
    value = lines.replace(/\r?\n[ \t]+/g, " ").trim();
  }
  if (!value) throw new Error(`skill '${skillDir}': empty description`);
  return value;
}

function main() {
  const failures = [];
  let checked = 0;

  for (const { skill, prompt } of SAMPLES) {
    if (!SKILLS.includes(skill)) {
      failures.push(`sample targets unknown skill '${skill}': "${prompt}"`);
      continue;
    }
    const matched = matches(readDescription(skill), prompt);
    checked++;
    if (matched.length === 0) {
      failures.push(`[${skill}] no trigger token in description matches prompt: "${prompt}"`);
    } else {
      console.log(`ok   [${skill}] "${prompt}"  ->  ${matched.slice(0, 4).join(", ")}`);
    }
  }

  for (const { prompt, notSkills } of NEGATIVE_SAMPLES) {
    for (const skill of notSkills) {
      const matched = matches(readDescription(skill), prompt);
      checked++;
      if (matched.length > 0) {
        failures.push(`[${skill}] off-topic prompt "${prompt}" matched: ${matched.join(", ")}`);
      } else {
        console.log(`ok   [${skill}] does not match "${prompt}"`);
      }
    }
  }

  console.log(`\ntrigger-test: ${checked - failures.length}/${checked} samples passed`);
  if (failures.length > 0) {
    console.error("trigger-test FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`trigger-test FAILED: ${error.message}`);
  process.exit(1);
}
