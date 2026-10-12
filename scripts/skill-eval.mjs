#!/usr/bin/env node
/**
 * skill-eval.mjs — deterministic scenario-eval harness for the wisdom-lens skills.
 *
 * The repo's pain: "no measured Δ" for whether the skills change agent
 * behavior. This harness is the first measured Δ — a deterministic proxy:
 * scripted scenarios (user prompts + transcript fragments) are checked
 * against each skill's own spec (SKILL.md trigger phrases, routing rules,
 * and checkable practices). No LLM calls, no network, node stdlib only.
 *
 * Two scenario kinds:
 *   routing — does the prompt route to the skill its spec claims?
 *             (argmax over the spec's quoted trigger phrases, then an
 *             IDF-weighted token fallback; the 21 routing goldens are the
 *             repo's own trigger-test samples, which only assert >=1 match)
 *   rule    — does a scripted transcript conform to / violate a checkable
 *             rule from the skill (VERIFY: lines, numerals in plans,
 *             ACCEPTANCE: criteria, six-stage order, three options,
 *             ROOT-CAUSE depth, HALT-LOOP tripwire, [known]/[inferred]/
 *             [guessed] tags, sycophancy signature, exception clauses)?
 *
 * Exit 0 when every scenario behaves per spec, non-zero with details
 * otherwise. `--json` prints a machine-readable summary.
 *
 * Honest scope: this measures spec-rule conformance on scripted scenarios.
 * A live-agent behavior Δ (does an agent using the skill actually behave
 * differently?) needs an instrumented LLM loop and is out of scope here.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSequence } from "./tripwire-check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = ["builder-protocol", "decision-engine", "new-lens"];

// ---------------------------------------------------------------------------
// Spec reading
// ---------------------------------------------------------------------------

/** Folded `description:` frontmatter scalar from a SKILL.md file. */
function readDescription(skill) {
  const text = readFileSync(join(root, "skills", skill, "SKILL.md"), "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
  const match = frontmatter.match(/^description:\s*(.*)$/m);
  if (!match) throw new Error(`skill '${skill}': no description in frontmatter`);
  let value = match[1].trim();
  if (value === ">" || value === "|") {
    const after = frontmatter.slice(match.index + match[0].length);
    const lines = after.match(/^(?:\r?\n[ \t]+[^\r\n]*)+/)?.[0] ?? "";
    value = lines.replace(/\r?\n[ \t]+/g, " ").trim();
  }
  return value;
}

/** Lowercase alphanumeric tokens of length >= 4. */
function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
}

/** Crude suffix stemmer so "loops"~"loop" and "failed"~"fail" match. */
function stem(token) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 5) return token.slice(0, -2);
  return token;
}

/**
 * Stemmed equality: morphological variants match ("loops" ~ "loop") but
 * accidental shared prefixes do not ("plants" !~ "plan" — different words).
 */
function tokensMatch(a, b) {
  return stem(a) === stem(b);
}

const SPECS = {};
for (const skill of SKILLS) {
  const description = readDescription(skill);
  SPECS[skill] = {
    tokens: [...new Set(tokenize(description))],
    phrases: [...description.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase()),
  };
}

// Inverse-document-frequency weight: a token quoted by all three skill
// descriptions ("should", "what") carries ~no routing signal; a token
// unique to one skill carries full signal.
const docFreq = {};
for (const skill of SKILLS) {
  for (const token of SPECS[skill].tokens) {
    docFreq[token] = docFreq[token] ?? new Set();
    docFreq[token].add(skill);
  }
}

/** Minimum token-fallback score for a skill to claim a prompt. */
const ROUTING_THRESHOLD = 1;

/**
 * Route a user prompt to a skill (or null).
 * 1. The spec's own quoted trigger phrases win on case-insensitive substring.
 *    On ambiguity the LONGEST matching phrase wins (most specific trigger).
 * 2. Otherwise IDF-weighted token overlap; the argmax must clear ROUTING_THRESHOLD.
 */
export function routePrompt(prompt) {
  const lowered = prompt.toLowerCase();
  const hits = [];
  for (const skill of SKILLS) {
    for (const phrase of SPECS[skill].phrases) {
      if (lowered.includes(phrase)) hits.push({ skill, phrase });
    }
  }
  if (hits.length > 0) {
    hits.sort((a, b) => b.phrase.length - a.phrase.length);
    return hits[0].skill;
  }
  const promptTokens = tokenize(prompt);
  const scored = SKILLS.map((skill) => ({
    skill,
    score: SPECS[skill].tokens
      .filter((token) => promptTokens.some((pt) => tokensMatch(token, pt)))
      .reduce((sum, token) => sum + 1 / docFreq[token].size, 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score >= ROUTING_THRESHOLD ? scored[0].skill : null;
}

// ---------------------------------------------------------------------------
// Rule checkers — each returns one of: "conforms" | "violation" | "flag" |
// "no-flag" | "trip" | "no-trip"
// ---------------------------------------------------------------------------

/** builder-protocol Rule 1: a done/shipped claim needs a preceding VERIFY: line. */
function bpVerify(transcript) {
  const claimsDone = /\b(done|shipped)\b/i.test(transcript);
  const verified = /^VERIFY:/m.test(transcript);
  return claimsDone && !verified ? "violation" : "conforms";
}

/** builder-protocol Rule 2: every plan block carries at least one numeral. */
function bpMeasure(plan) {
  return /\d+/.test(plan) ? "conforms" : "violation";
}

/** builder-protocol Rule 2: a >1h plan needs ACCEPTANCE: with >= 2 bullets. */
function bpAcceptance(plan) {
  const section = plan.match(/ACCEPTANCE:([\s\S]*?)(?:\n\s*\n|$)/i);
  if (!section) return "violation";
  const bullets = (section[1].match(/^\s*[-*•]\s+/gm) || []).length;
  return bullets >= 2 ? "conforms" : "violation";
}

/** builder-protocol Rule 7: a new file needs a preceding SEARCHED: line. */
function bpSearched(log) {
  const created = log.search(/new file|created file/i);
  if (created === -1) return "conforms";
  const searched = log.search(/^SEARCHED:/m);
  return searched !== -1 && searched < created ? "conforms" : "violation";
}

/** decision-engine: the six stages run in order; DECIDE never skips GENERATE. */
const STAGES = ["CLARIFY", "CLASSIFY", "DIAGNOSE", "GENERATE", "DECIDE", "ACT"];
function deStages(transcript) {
  const at = (stage) => {
    const m = transcript.match(new RegExp(`\\b${stage}\\b`));
    return m ? m.index : -1;
  };
  if (at("DECIDE") !== -1 && at("GENERATE") === -1) return "violation";
  if (at("DECIDE") !== -1 && at("GENERATE") > at("DECIDE")) return "violation";
  return STAGES.every((s) => at(s) !== -1) ? "conforms" : "violation";
}

/** decision-engine Stage 4: GENERATE forces three genuinely different options. */
function deOptions(transcript) {
  const section = transcript.match(/GENERATE:([\s\S]*?)(?:\bDECIDE\b|$)/);
  const scope = section ? section[1] : transcript;
  const count = (scope.match(/^\s*option\s+\d+\s*:/gim) || []).length;
  return count >= 3 ? "conforms" : "violation";
}

/** decision-engine Stage 3: ROOT-CAUSE: spans symptom → proximate → systemic. */
function deDiagnose(transcript) {
  const block = transcript.match(/ROOT-CAUSE:([\s\S]*?)(?:\n\s*\n|$)/i);
  const scope = block ? block[1] : transcript;
  const levels = ["symptom", "proximate cause", "systemic cause"].filter((level) =>
    new RegExp(`^\\s*${level}\\s*:`, "im").test(scope),
  ).length;
  return levels >= 3 ? "conforms" : "violation";
}

/**
 * decision-engine Below-Threshold Play: a sub-threshold JEV answer presented
 * as binding is a violation. Conformance requires a narrowing/review marker.
 */
function deBelowThreshold(log) {
  const verdict = log.match(/confidence\s*(?:of\s*)?0\.(\d+)/i);
  if (!verdict || Number(`0.${verdict[1]}`) >= 0.8) return "conforms";
  const plays = /narrow(?:ing)? the (?:question|state)|re-ask|reask|probe|rout(?:e|ing) to review|non-binding/i;
  return plays.test(log) ? "conforms" : "violation";
}

/**
 * decision-engine Decision Logging Rule: a chat narration of a JEV result
 * needs a preceding verbatim LOG: block. Memory-narration is the violation.
 */
function deDecisionLog(log) {
  const mentions = /jev/i.test(log) && /(said|chose|recommended|decided)/i.test(log);
  if (!mentions) return "conforms";
  return /^LOG:/m.test(log) ? "conforms" : "violation";
}

/**
 * builder-protocol Rule 1: rationalization-prevention. A rationalization
 * phrase from the table with no VERIFY: line is a flag.
 */
const RATIONALIZATIONS = [
  /i'?m confident (this is|it'?s) right/i,
  /change is (small|trivial)/i,
  /verified something like this/i,
  /(will|would) slow (me|us) down/i,
  /nobody will check/i,
  /(told|asked) me to just (do|ship|push) it/i,
];
function bpRationalization(transcript) {
  if (/^VERIFY:/m.test(transcript)) return "no-flag";
  return RATIONALIZATIONS.some((pattern) => pattern.test(transcript)) ? "flag" : "no-flag";
}

/** new-lens Ch.1: the repetition tripwire fires on 3 identical consecutive calls. */
function nlTripwire(events) {
  return scanSequence(events) ? "trip" : "no-trip";
}

/** new-lens Ch.6: every factual claim in a deliverable carries a tag. */
function nlTagging(deliverable) {
  const sentences = deliverable.split(/(?<=[.!?])\s+/);
  const untagged = sentences.filter(
    (s) =>
      /\b(is|are|was|were|has|have|causes?|shows?|proves?|returns?|contains?)\b/i.test(s) &&
      !/\[(known|inferred|guessed)\]/i.test(s) &&
      !/^\s*(if|should|let's|let us|we should|note:|plan:)/i.test(s),
  );
  return untagged.length > 0 ? "violation" : "conforms";
}

/** new-lens Ch.10: praise for the undone (no evidence behind it) is the sycophancy signature. */
function nlSycophancy(transcript) {
  const praise = /\b(great|brilliant|excellent|perfect|amazing|genius|definitely|100%)\b/i.test(transcript);
  if (!praise) return "no-flag";
  const evidence = /\b(test|tested|ran|verified|measured|checked|evidence|benchmark|result|green)\b/i.test(transcript);
  return evidence ? "no-flag" : "flag";
}

/** new-lens Ch.13: every autonomous plan carries an exception clause. */
function nlExceptionClause(plan) {
  return /\b(cap|budget|exit|stop condition|tripwire|kill criterion|rollback|fallback)\b/i.test(plan)
    ? "conforms"
    : "violation";
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const routingGoldens = [
  // The repo's own trigger-test samples, re-measured as argmax routing.
  ["builder-protocol", "Review this plan before I ship it"],
  ["builder-protocol", "Is this ready to merge? Give me a full review"],
  ["builder-protocol", "Spec this out with acceptance criteria"],
  ["builder-protocol", "Push it to production, the work is done"],
  ["builder-protocol", "How should I run this build-time workflow?"],
  ["builder-protocol", "I need operating rules for professional work with AI agents"],
  ["builder-protocol", "Ship it once the acceptance criteria pass"],
  ["decision-engine", "Should I take the new job or stay where I am?"],
  ["decision-engine", "Help me decide which option is best"],
  ["decision-engine", "Weigh the pros and cons of migrating to the cloud"],
  ["decision-engine", "Is it worth it to buy the annual plan?"],
  ["decision-engine", "Give me a risk assessment for this launch"],
  ["decision-engine", "I need a structured framework for a high-stakes negotiation"],
  ["decision-engine", "Make the call: go or no-go on Friday's release"],
  ["new-lens", "Why did the agent loop three times on the same step?"],
  ["new-lens", "Stuck in a loop — why did this fail?"],
  ["new-lens", "The AI agreed with everything I said, this output looks wrong"],
  ["new-lens", "Where did it go off track?"],
  ["new-lens", "What are the common AI failure modes for agents?"],
  ["new-lens", "How do I spot hallucination and sycophancy in outputs?"],
  ["new-lens", "Why is AI oversight needed for agent problems?"],
];

const CASES = [
  ...routingGoldens.map(([skill, prompt], i) => ({
    id: `RT-${String(i + 1).padStart(2, "0")}`,
    skill,
    kind: "routing",
    name: `routes to ${skill}`,
    run: () => routePrompt(prompt),
    expected: skill,
  })),
  {
    id: "RT-22", skill: null, kind: "routing", name: "non-skill prompt routes nowhere",
    run: () => routePrompt("What is the capital of France?"), expected: null,
  },
  {
    id: "RT-23", skill: null, kind: "routing", name: "reminder prompt routes nowhere",
    run: () => routePrompt("Remind me to water the plants at 6pm"), expected: null,
  },

  // builder-protocol rules
  {
    id: "BP-R1a", skill: "builder-protocol", kind: "rule", name: "done claim without VERIFY: is a violation",
    run: () => bpVerify("All 42 tests pass. Marking this done — shipped to production."), expected: "violation",
  },
  {
    id: "BP-R1b", skill: "builder-protocol", kind: "rule", name: "done claim with VERIFY: conforms",
    run: () => bpVerify("VERIFY: ran npm test — 42/42 green\nAll 42 tests pass. Marking this done."), expected: "conforms",
  },
  {
    id: "BP-R2a", skill: "builder-protocol", kind: "rule", name: "plan without a numeral is a violation",
    run: () => bpMeasure("Plan: make the dashboard better and faster."), expected: "violation",
  },
  {
    id: "BP-R2b", skill: "builder-protocol", kind: "rule", name: "plan with quantities conforms",
    run: () => bpMeasure("Plan: under 200 lines, zero new dependencies, ships Friday."), expected: "conforms",
  },
  {
    id: "BP-R2c", skill: "builder-protocol", kind: "rule", name: ">1h plan without ACCEPTANCE: is a violation",
    run: () => bpAcceptance("Plan (est. 3 hours):\n1. Refactor the auth module\n2. Update the docs"), expected: "violation",
  },
  {
    id: "BP-R2d", skill: "builder-protocol", kind: "rule", name: ">1h plan with ACCEPTANCE: criteria conforms",
    run: () => bpAcceptance("Plan (est. 3 hours):\nACCEPTANCE:\n- Auth tests green\n- Docs updated\n1. Refactor the auth module"), expected: "conforms",
  },
  {
    id: "BP-R7a", skill: "builder-protocol", kind: "rule", name: "new file without SEARCHED: is a violation",
    run: () => bpSearched("Wrote src/auth.mjs — new file with the login handlers."), expected: "violation",
  },
  {
    id: "BP-R7b", skill: "builder-protocol", kind: "rule", name: "SEARCHED: before a new file conforms",
    run: () => bpSearched("SEARCHED: repo for auth helpers — found lib/auth.js, reusing it.\nWrote src/auth.mjs — new file with the login handlers."), expected: "conforms",
  },
  {
    id: "BP-R8a", skill: "builder-protocol", kind: "rule", name: "rationalization without VERIFY: is a flag",
    run: () => bpRationalization("I'm confident this is right, skipping the check. Deploying now."), expected: "flag",
  },
  {
    id: "BP-R8b", skill: "builder-protocol", kind: "rule", name: "confidence language with VERIFY: is no flag",
    run: () => bpRationalization("I'm confident this is right.\nVERIFY: ran the full suite — 42/42 green."), expected: "no-flag",
  },

  // decision-engine rules
  {
    id: "DE-S1", skill: "decision-engine", kind: "rule", name: "six stages in order conform",
    run: () => deStages([
      "CLARIFY: which deploy target unblocks the launch?",
      "CLASSIFY: complicated — needs analysis.",
      "DIAGNOSE:",
      "ROOT-CAUSE:",
      "symptom: deploys fail on Fridays",
      "proximate cause: migration runs without a lock",
      "systemic cause: no deploy checklist",
      "GENERATE:",
      "Option 1: freeze Friday deploys",
      "Option 2: add a migration lock",
      "Option 3: canary deploys",
      "DECIDE: Option 2 — cheapest reversible fix.",
      "ACT: ship the lock today.",
    ].join("\n")), expected: "conforms",
  },
  {
    id: "DE-S2", skill: "decision-engine", kind: "rule", name: "DECIDE skipping GENERATE is a violation",
    run: () => deStages("CLARIFY: which option?\nDECIDE: go with option A, feels right."), expected: "violation",
  },
  {
    id: "DE-S3", skill: "decision-engine", kind: "rule", name: "GENERATE with three options conforms",
    run: () => deOptions("GENERATE:\nOption 1: stay\nOption 2: migrate\nOption 3: hybrid\nDECIDE: Option 3."), expected: "conforms",
  },
  {
    id: "DE-S4", skill: "decision-engine", kind: "rule", name: "GENERATE with one option is a violation",
    run: () => deOptions("GENERATE:\nOption 1: migrate now, the only sane choice\nDECIDE: Option 1."), expected: "violation",
  },
  {
    id: "DE-S5", skill: "decision-engine", kind: "rule", name: "ROOT-CAUSE with three levels conforms",
    run: () => deDiagnose("ROOT-CAUSE:\nsymptom: deploys fail\nproximate cause: no migration lock\nsystemic cause: no checklist"), expected: "conforms",
  },
  {
    id: "DE-S6", skill: "decision-engine", kind: "rule", name: "ROOT-CAUSE with one level is a violation",
    run: () => deDiagnose("ROOT-CAUSE:\nsymptom: deploys fail"), expected: "violation",
  },
  {
    id: "DE-S7", skill: "decision-engine", kind: "rule", name: "sub-threshold verdict presented as binding is a violation",
    run: () => deBelowThreshold("JEV confidence 0.35 (below minConfidence 0.8). Going with option A anyway — decision made."), expected: "violation",
  },
  {
    id: "DE-S8", skill: "decision-engine", kind: "rule", name: "sub-threshold verdict routed to review conforms",
    run: () => deBelowThreshold("JEV confidence 0.35 (below minConfidence 0.8). Non-binding — narrowing the state and re-asking; routing to review."), expected: "conforms",
  },
  {
    id: "DE-S9", skill: "decision-engine", kind: "rule", name: "JEV narration without a verbatim log is a violation",
    run: () => deDecisionLog("JEV said the staging probe is best, so let's merge."), expected: "violation",
  },
  {
    id: "DE-S10", skill: "decision-engine", kind: "rule", name: "JEV narration with a verbatim LOG: block conforms",
    run: () => deDecisionLog("LOG: q=option_0_benefit instructions='How much benefit is supported by the supplied evidence?' criteria=[level 0, level 1, level 2] response score=1.4 confidence=0.91 outcome=review\nJEV recommended the staging probe with review — proceeding to a probe."), expected: "conforms",
  },

  // new-lens rules
  {
    id: "NL-R1", skill: "new-lens", kind: "rule", name: "three identical consecutive calls trip the wire",
    run: () => nlTripwire([
      { tool: "grep", args: { pattern: "x" } },
      { tool: "grep", args: { pattern: "x" } },
      { tool: "grep", args: { pattern: "x" } },
    ]), expected: "trip",
  },
  {
    id: "NL-R2", skill: "new-lens", kind: "rule", name: "varied calls do not trip the wire",
    run: () => nlTripwire([
      { tool: "grep", args: { pattern: "x" } },
      { tool: "read", args: { path: "a" } },
      { tool: "grep", args: { pattern: "y" } },
    ]), expected: "no-trip",
  },
  {
    id: "NL-R3", skill: "new-lens", kind: "rule", name: "tagged factual claims conform",
    run: () => nlTagging("The endpoint returns 200 on success [known]. Latency should stay under 200ms [inferred]. We have no data on peak load [guessed]."), expected: "conforms",
  },
  {
    id: "NL-R4", skill: "new-lens", kind: "rule", name: "untagged factual claim is a violation",
    run: () => nlTagging("The endpoint returns 200 on success [known]. Latency is 40ms."), expected: "violation",
  },
  {
    id: "NL-R5", skill: "new-lens", kind: "rule", name: "praise for the undone raises the sycophancy flag",
    run: () => nlSycophancy("Brilliant idea! This will definitely work — ship it!"), expected: "flag",
  },
  {
    id: "NL-R6", skill: "new-lens", kind: "rule", name: "praise backed by evidence raises no flag",
    run: () => nlSycophancy("Excellent direction — the test suite passes, 42/42 green."), expected: "no-flag",
  },
  {
    id: "NL-R7", skill: "new-lens", kind: "rule", name: "plan without an exception clause is a violation",
    run: () => nlExceptionClause("Plan: rewrite the deploy pipeline overnight, full cutover at dawn."), expected: "violation",
  },
  {
    id: "NL-R8", skill: "new-lens", kind: "rule", name: "plan with caps and rollback conforms",
    run: () => nlExceptionClause("Plan: rewrite the deploy pipeline. Budget cap $200, rollback ready, stop if the error budget burns."), expected: "conforms",
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function main() {
  const asJson = process.argv.includes("--json");
  const failures = [];
  const perSkill = {};
  for (const skill of [...SKILLS, null]) perSkill[skill ?? "cross-skill"] = { pass: 0, total: 0 };

  for (const c of CASES) {
    let actual;
    try {
      actual = c.run();
    } catch (error) {
      actual = `ERROR: ${error.message}`;
    }
    const ok = actual === c.expected;
    const bucket = perSkill[c.skill ?? "cross-skill"];
    bucket.total++;
    if (ok) bucket.pass++;
    else failures.push({ id: c.id, skill: c.skill, name: c.name, expected: c.expected, actual });
    if (!asJson) {
      console.log(`${ok ? "ok  " : "FAIL"} [${c.id}] ${c.skill ?? "—"} · ${c.name}` +
        (ok ? "" : ` (expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(actual)})`));
    }
  }

  const total = CASES.length;
  const passed = total - failures.length;
  const summary = {
    passed,
    total,
    perSkill: Object.fromEntries(
      Object.entries(perSkill).map(([k, v]) => [k, `${v.pass}/${v.total}`]),
    ),
    failures,
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\nskill-eval: ${passed}/${total} scenarios behave per skill spec`);
    for (const [skill, v] of Object.entries(perSkill)) {
      console.log(`  ${skill}: ${v.pass}/${v.total}`);
    }
    console.log("scope: deterministic proxy — spec-rule conformance on scripted scenarios;");
    console.log("live-agent behavior Δ needs an instrumented LLM loop (out of scope).");
  }
  if (failures.length > 0) process.exit(1);
}

main();
