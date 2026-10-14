---
name: builder-protocol
description: >
  This skill should be used when the user says things like "done", "push it",
  "ship it", "review this plan", "how should I run this", "spec this out",
  "is this ready to merge", or needs a compact set of operating rules,
  acceptance criteria, or a build-time workflow for professional work with
  AI agents. Do not use when the user is asking why an AI output went wrong
  (route to new-lens) or is weighing a choice between options
  (route to decision-engine).
license: MIT
metadata:
  version: "1.0.0"
  last_verified: "2026-10-12"
---

## When NOT to Use

- Do NOT use for one-shot trivial questions — a quick answer is not a build.
- Do NOT use as a substitute for domain expertise — this is a process protocol, not knowledge.
- Do NOT use to override the user's explicit instruction to keep it casual.
- If the task completes in under ~10 minutes, apply the rules lightly: ship the artifact, skip the ceremony.

# The Builder's Protocol — Daily Operating System

Twelve rules for builders. Each one has survived contact with real-world failures.

## The Twelve Rules

### Rule 1 — Verify Before Acting
Acting on unverified information causes avoidable harm, and the bill arrives as regret.

**Practice**: Every citation and every "done"/test-result claim must carry a `VERIFY:` line in the session log quoting the check performed and its outcome (e.g. `VERIFY: citation [x] — opened source, matches`). A "done" or "shipped" statement is a violation if no `VERIFY:` line for that claim precedes it in the transcript. At least one `VERIFY:` line must appear per session.

**Red flags** — halt when any of these appear in the transcript:

| Signal | What it means |
|---|---|
| "Done", "shipped", "all tests pass" with no check output shown | The claim outran the evidence |
| The plan changed after the evidence arrived, but the verification didn't re-run | Stale verification masquerading as current |
| "I'll verify after I push / in the next session" | Verification scheduled after the irreversible act |
| Confidence language ("I'm sure", "obviously", "should be fine") where a command belongs | Confidence standing in for evidence |
| A retry of the same fix for the third time | Loop — escalate, don't repeat (see new-lens tripwire) |

**Rationalization-prevention** — the excuse, and the answer:

| Rationalization | Answer |
|---|---|
| "I'm confident this is right" | Confidence ≠ evidence. Run the check. |
| "The change is small / trivial" | Small changes have caused the largest outages. Size is not verification. |
| "I verified something like this before" | That was then. Fresh claims need fresh evidence. |
| "Verifying will slow me down" | Unverified rework is slower. Verify once, correctly. |
| "Nobody will check" | The Stop hook checks. The log checks. Future-you checks. |
| "The user told me to just do it" | Pressure is the exact condition this rule exists for. Verify anyway. |

The pressure cases are the real test: "just push it", "deadline in 10 minutes",
"we're 3 hours in, ship it". Under pressure the agent rationalizes the shortcut;
the table above names the rationalization in advance so it cannot pass unnoticed.

### Rule 2 — Specify with Measure
Write quantities before any significant work: scope, budget, tolerance, stop conditions. "Make it better" is not a spec. "Under 200 lines, zero new dependencies, ships Friday" is.

**Practice**: Every plan block must contain at least one numeral (regex `/\d+/` on the plan text). Every plan for a task the agent estimates at >1 hour must include an `ACCEPTANCE:` section with ≥2 bullet criteria, written before the first implementation step in the transcript.

### Rule 3 — Write It Down, Degrade Gracefully
Externalize state at every handoff. Design the degradation ladder: canonical doc → working notes → committed artifacts → escrowed state. Memory fails at transitions, not in storage.

**Practice**: Keep the canonical doc in your control; agents work on copies. Send a written recap after every agreement, same day.

### Rule 4 — Never Trade the Standing Instruction for the Salient Reward
The instruction most likely to be dropped is the one standing between you and a visible payoff: the code freeze before the demo, the review before the merge.

**Practice**: Name your standing instruction before the sprint starts. Pin it beside the reward surface. Make leaving it loud, not silent.

### Rule 5 — Ship; Output Is the Argument
Plans, prompts, and intentions are foam until shipped. End every session with an artifact someone can inspect, or the session was conversation. Measure the week in shipped units, not generated ones.

**Practice**: Replace one progress meeting per week with a shipped artifact. Work as if every deliverable gets a surprise review.

### Rule 6 — Mark Uncertainty in Advance
Attach the exception clause to every plan and forecast: caps, exits, explicit uncertainty. The plan that cannot say "if" will meet the outage that says "no."

**Practice**: Say the if-clause out loud in every estimate you give. Pre-decide your adaptation trigger: what signal tells you to revise the plan?

### Rule 7 — Ask People Who Already Know
Before building, consult what exists — maintainers, documentation, community standards, the human expert one message away. Reinvention is the default failure; reuse is the protocol.

**Practice**: Before writing a new module, file, or >50-line change, the log must show one `SEARCHED:` line naming what was consulted (repo path, docs URL, or "no existing implementation found"). A greenfield file without a preceding `SEARCHED:` line is a violation. Keep a specialist roster per domain and refresh it yearly.

### Rule 8 — Judge by What Remains, Not by Foam
Evaluate tools, outputs, and content at arrival-distance and after time: still used in six months, still true under rephrasing, still standing without the demo. Volume and polish are foam signals.

**Practice**: Drop tools and content that only survive the glance. Run the recipient drill: hand the artifact to a colleague cold and time the path to bedrock.

### Rule 9 — Log at the Smallest Unit
Nothing consequential goes unlogged — prompts, decisions, agent actions, overrides. The log is the only team member that never forgets and never flatters.

**Practice**: Review the log before the agent's account of itself. Log at the action layer — every consequential action gets a recorded observer.

### Rule 10 — Calibrated Trust After Full Diligence
Do the diligence, set the caps — then stop anxious re-checking and let the system run. Trust is what remains after preparation, never a substitute for it.

**Practice**: Separate preparation from anxiety; only the first is work. Enumerate everything in your control and do all of it. Then carry nothing.

### Rule 11 — Review in Pairs or Alone, Then Reflect
Schedule reflection in small units: one colleague or none, one undistracted hour. High-stakes verification dies in crowds and in fragments.

**Practice**: Book the reflection hour before the review meeting, not after it. Verify in pairs or solo inside a protected hour — never in a crowd.

### Rule 12 — No Favor-Debt
Give the fix, the prompt, the review without attaching an invoice. Accept no tool's flattery as a debt you owe. Generosity priced is extraction; agreement priced is sycophancy.

**Practice**: Circulate what works — fixes, prompts, evals — and track what returns. Give without invoice; receive without obligation.

## The AI Oversight Equation

**Net AI Value** = Production time saved − (Verification cost + Repair cost + Recurrence cost + Learning loss + Trust degradation)

Most organizations count only the first term. Count all six.

## Quick Diagnostics

### Is This a Loop?
- Same action three times? → Locked. Halt the session.
- More questions than actions? → Hesitation dressed as diligence. Act.
- Nearing done but adding one more pass? → The loop's last hook. Define done. Be done.

### Is This Slop?
- Does it survive arrival-distance? → Hand it to someone cold; time the path to bedrock.
- Would it be referenced in six months? → If not, it's foam.
- Which of the five hollow markers does it serve? → Entertainment, distraction, decoration, self-promotion, status competition? Then it's foam.

### Is This Sycophancy?
- Did it agree before you finished? → Discount.
- Did it praise what isn't done yet? → Red flag.
- Does it cost the tool anything to agree? → If not, the agreement is free and worth exactly that.

## The Anxiety Protocol

When overwhelmed:
1. Write two columns — fear (future) and grief (past)
2. Write one line: the right thing to do in the next hour
3. Do that thing
4. Repeat

When the squeeze comes:
1. Hold your standards — that's exactly when the hidden-option rule applies
2. List visible exits, then write: "this list is incomplete"
3. Keep one reputation-clean option alive, even at cost
4. Prepare everything in your control; release everything outside it

## Anchors Worth Memorizing

- Verify, specify, write, ship, log
- The foam always outvolumes the substance — and the substance always outlasts the foam
- Flattery is agreement with an invoice attached
- The machines will keep improving at recombination; your job was always kindling
- Stability is a schedule, not a mood
- The plan that cannot say "if" meets the outage that says "no"
- Twelve rules, one terminal window

## References

- [Pressure tests](references/pressure-tests.md) — five adversarial scenarios with worked correct behavior. Run one per week as a self-check.
- [Adopting this skill](references/adopting-this-skill.md) — keep/bind/rewrite/drop decision table for teams, plus `assumes:` frontmatter guidance.
- [Changelog](CHANGELOG.md) — version history. Before changing this skill, read the repo README's "Update contract" section.
