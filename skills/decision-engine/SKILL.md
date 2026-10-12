---
name: decision-engine
description: >
  This skill should be used when the user says things like "should I",
  "help me decide", "which option", "what would you pick", "trade-off",
  "is it worth it", "weigh the pros and cons", "go or no-go",
  "make the call", "risk assessment", or needs a structured framework for
  a decision, negotiation, or high-stakes situation. Includes an optional
  JEV scoring adapter for typed scoring and decision gates. Do not use for
  trivial reversible picks (just pick and move on), and never use the JEV
  adapter for production, data, or money decisions without the user's
  explicit authorization.
license: MIT
metadata:
  version: "1.1.0"
  last_verified: "2026-10-12"
---

## When NOT to Use

- Do NOT use for trivial reversible decisions — pick and move on.
- Do NOT use for decisions under active time pressure where the six stages cost more than they save.
- Do NOT use when fewer than two real options exist — that's a go/no-go; use the Stage 1 gate ("what decision does this answer change?") only.
- The JEV adapter is never used for production, data, or money decisions without the user's explicit authorization per session.

# Decision Engine — Structured Decision Frameworks

Apply these frameworks when helping users navigate decisions, evaluate options, or handle high-stakes situations.

## The Six-Stage Decision Loop

Run every significant decision through these stages:

### Stage 1: CLARIFY
- Verify inputs independently before acting. Weight every report by source credibility.
- Clarify requirements once in writing, then stop interrogating and start executing.
- Set a deadline on clarification; clarity has a cost curve.
- Gate: "What decision does this answer change?" — if none, stop asking.

### Stage 2: CLASSIFY
Name the problem class before solving:
- **Clear**: Known answer → apply the standard
- **Complicated**: Needs analysis → study it or consult an expert
- **Complex**: Won't hold still → run small probes, watch what happens
- **Chaotic**: Needs stabilization → act to stop the bleeding, reassess

### Stage 3: DIAGNOSE
- In the DIAGNOSE stage, write a `ROOT-CAUSE:` block listing at least one cause at each of three levels (symptom → proximate cause → systemic cause). A DIAGNOSE section with fewer than three levels is incomplete.
- Test for contradictions — a reading that generates them is wrong
- Blame the process before the person; scapegoats protect broken systems

### Stage 4: GENERATE
- Force three genuinely different options onto one page
- Collect input before revealing your own position
- Include the option you dislike — dislike is not disqualification
- Consult domain experts: the routing rule under ignorance is consultation, never improvisation

### Stage 5: DECIDE
- Weigh costs, second-order effects, and who bears the risk — same scale for every option
- Screen through two gates: **Fairness** (is it fair to everyone affected?) and **Commitments** (does it honor what we already promised?)
- Give your own authored option no handicap
- Preference is one column, not the table

### Stage 6: ACT & SUSTAIN
- Take every precaution first, then release the outcome
- Execute with full presence — better than the spec
- Sustain with strategic patience — impatience kills more solutions than wrong answers
- Loop: if results keep missing, the diagnosis was wrong — return without shame

## The Probe Protocol

Before irreversible commitments:
1. Design one low-cost, reversible test
2. Read the response as the price list for the large move
3. Prefer reversible commitments while information is still arriving
4. Resist the aggressive option while the probe is in transit

## Below-Threshold Play (JEV confidence under minConfidence)

A JEV answer below the policy's `minConfidence` (default 0.8) is **non-binding**.
It is a signal to narrow the question, not a verdict to narrate. Never present
a sub-threshold result as the decision; never let a low-confidence answer
authorize an action. Run this play instead:

1. **Name the blocker.** Which question came back uncertain — the class, the
   benefit, the cost, the risk, or a fairness/commitments standard? State it.
2. **Check whether it's even a decision.** If fewer than two real options
   remain, this is a go/no-go, not a framework problem — answer the Stage 1
   gate ("what decision does this answer change?") and stop.
3. **Narrow the state.** An uncertain answer usually means the state was too
   broad. Restate the question against one concrete field (`state.key`) instead
   of the whole situation.
4. **Run a cheap probe.** If the uncertainty is about the world, not the
   question, gather one piece of real evidence and re-ask. Uncertainty
   resolved by evidence is the point of the framework.
5. **Re-ask with tighter criteria.** If the uncertainty is about the question,
   sharpen the instructions or add a level to the score rubric, then re-ask.
6. **Only then decide.** If confidence is still under threshold after one
   narrowing pass and one probe, route to review (a human or a second agent),
   not to yourself narrating a "probably". Non-binding means non-binding.

A below-threshold `recommend` is a `review` — the adapter already encodes this;
this section tells you what to do in the review.

## Conflict Resolution Framework

### Level 1: Answer One Level Above
Respond with something better than the provocation. Turning an adversary around outperforms retaliation as strategy.

### Level 2: Strategic Pardon
Price both options — what retaliation costs in time/trust vs. what pardon unlocks. Pardon explicitly and reconcile actively.

### Level 3: Amnesty from Strength
When you hold the leverage, open with amnesty. Strength used to pardon purchases loyalty; strength used to humiliate purchases only obedience.

### Level 4: Escalate to Shared Principles
Route deadlocks to the common standard both sides accept. Agree on the arbiter before the dispute starts.

## Risk Management Checklist

- [ ] Map single points of failure: one client, one income, one supplier, one key person
- [ ] Cap the downside before counting the upside
- [ ] Split exposure deliberately across separate gates
- [ ] Forecast the downturn while the good years last
- [ ] Store reserves in formats that don't decay
- [ ] Build capability before the crisis — readiness seen is conflict skipped
- [ ] Write the kill criterion in advance
- [ ] Add the exception clause: caps, exits, tripwires

## The Attribution Audit (Post-Decision)

After every significant outcome:
1. List what you controlled vs. what you rode
2. Credit contributors, conditions, and luck publicly
3. If the outcome was a win: treat it as a prompt to credit contributors, not a victory lap
4. If the outcome was a loss: refuse despair, rebuild the record — acknowledge, redirect, produce

## Optional JEV / TypeSafe Adapter

Use the bundled adapter only when JEV use is requested or already authorized for
the selected data. Read [JEV integration](references/jev-integration.md) before
calling it. The ordinary six-stage framework works without an API key or network.

- Verify evidence with tools and generate the options before asking JEV to judge.
- Supply explicit fairness and commitments standards, three distinct options,
  and deterministic check results from actual verification.
- Run `scripts/jev-decide.mjs` with a JSON input, or import the functions from
  `scripts/jev-adapter.mjs` in the surrounding application.
- Start with `--dry-run` and the synthetic `assets/jev-example.json` to inspect
  the request without a network call. Store live credentials in `TYPESAFE_API_KEY`.
- Treat `recommend` as advice for the selected option. Treat `review`, `blocked`,
  and errors as reasons to gather evidence, run a probe, or consult a reviewer.
- Keep execution in authorized tools or application code. Model confidence cannot
  override failed checks, authorize actions, or establish factual correctness.
- Preserve the six-stage loop: this adapter assists CLASSIFY and DECIDE; it does
  not independently verify sources, prove causes, create options, or act.

## Decision Logging Rule

Log the JEV call **verbatim** before narrating it in chat. The log entry is
the record; the chat reply is the summary. Narrating from memory is how a
judgment gets mischaracterized after the fact.

Write, in order, before any chat summary:

1. The exact question text (`instructions`) sent for each question id.
2. The exact criteria sent (option keys for choice; levels for score).
3. The state summary supplied — what evidence the model actually saw.
4. The exact response: scores, probabilities, confidence, per question id.
5. The policy outcome applied (`recommend` / `review` / `blocked`) and which
   threshold or gate produced it.

The chat reply then reports what changed as a result — never substitutes for
the log. Rule: if a claim about "what JEV said" appears in chat without a
matching verbatim log entry, it is unverified foam under builder-protocol
Rule 1.

## Quick-Reference Anchors

- One option is a trap; three is a decision
- Consult like you're wrong, decide like you're right, release like it's done
- Your likes are a column, not the table
- Send a small, cheap probe before you commit real resources
- A consistent standard ends more debates than a loud voice
- The past is data, the future is unwritten — pay taxes to neither
- Hold the mission, turn the heading
- The lever you control is the only lever that moves the system
