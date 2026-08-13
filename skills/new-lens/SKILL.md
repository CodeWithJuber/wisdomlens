---
name: new-lens
description: >
  This skill should be used when the user asks about "AI failure modes",
  "AI agent problems", "doom loops", "hallucination", "sycophancy",
  "AI trust", "AI costs", "AI ethics", "building with AI",
  "AI workflow issues", "black box AI", "AI slop", "AI memory problems",
  "what AI can't do", "human-AI relationship", "AI oversight",
  or needs guidance on operating principles for the AI age,
  managing AI tools, avoiding AI pitfalls, or the builder's protocol.
metadata:
  version: "1.0.0"
  source: "The New Lens"
---

# The New Lens — Operating Principles for the AI Age

Sixteen chapters in four parts. Part I maps machine failure modes; Part II maps workflow failure modes; Part III maps relationship failure modes; Part IV answers what remains for humans.

## Part I — Failure Modes of the Machine

### Chapter 1: The Loop — Repetition Without Progress
The agent fails, apologizes, changes files, introduces new bugs — motion without state change.

- **Every Clarifying Question Compounds Its Price**: Extract requirements sufficient to act, then act. A runnable test beats a refined question. Count your questions; treat each as cost against delivery.
- **The Loop Breaks from the Inside**: Nothing external changes until something internal changes. Change the state — rewind, reset, restart clean.
- **Locked Processors Don't Reflect**: Either you are reflecting, or something is locking the processor. Set a repetition tripwire: same action three times means locked — halt.
- **The Loop's Last Hook Is the Finish Line**: Completion is the highest-temptation state. Define done, then be done. The loop's hardest exit is the step just before done.
- **Question Discipline**: Gate every investigation with: what decision does this answer change? Questions with no operational consequence are scope creep wearing the mask of rigor.

### Chapter 2: Blind Judgment — Output Without Taste
The machine cannot see what it makes. Generation is cheap; judgment is the shortage.

- **The Sensor Is Fine; the Processor Is Blind**: Judgment failure is not fixed by more input but by repairing the evaluation layer. Write evaluation criteria before generation.
- **Look Twice, Then Again**: Adversarial repetition audit — look for a flaw, look again, keep looking. Run at least two review passes with different instruments.
- **Classify by Consequence, Not Resemblance**: Evaluate by what it does downstream, not by what it looks like. What looks harmless is often what does the damage.
- **When Outputs Look Alike, Judge the Source**: Polish is no longer evidence. Provenance is. Could this producer make the next, different one?
- **Your Standard Is Maintained by Conduct**: Taste degrades each time you ship what you know is slop. The eval gap is closed by cleaner judges, not more judges.

### Chapter 3: Missing Common Sense — Signal Without Meaning
LLMs fail at physical commonsense that any child gets. Training on text without grounded experience.

- **Hardware Present, Interpretive Loop Off**: Sensing without interpreting is worse than not sensing at all. Test outputs against the physical world, not against other text.
- **The Signal Is Received; the Meaning Isn't**: Input registered, semantics zero. Convert instructions into checks, not phrases to echo.
- **Wanting the Answer Distorts the Instruments**: First you want the conclusion; then the "evidence" manufactures itself. Name what you want the answer to be before evaluating.
- **The Evidence Is in the World and in Your Own Experience**: Reality is the dataset the model has never touched. Ground every consequential output in real-world observation.
- **Use the Third Tier**: Listening takes it in, inspection verifies it, judgment makes it mean something. Keep the third tier human.

### Chapter 4: Recombination, Not Innovation — Remix Without Origination
Generative models interpolate over training distributions. Remix is real; origination is something else.

- **Origination Is Not Instantiation**: Label your work honestly — new combination, or new category? Refuse to pay origination prices for recombination output.
- **Publish the Challenge Conditions**: Trustworthy systems publish falsifiable benchmarks and survive them. Secrecy is a tell.
- **Run the Provenance Interrogation**: Trace any output's lineage until you hit a source that can originate.
- **True Novelty Separates What Was Fused**: Real innovation divides what everyone assumed was one thing. Separate generation from verification — they were never one process.

### Chapter 5: Training-Data Dependency — Inheritance Without Verification
The machine is past-bound by construction. Inherited bias scales silently.

- **Found Is Not True**: Prevalence in the corpus certifies repetition, not truth. "We've always done it this way" is not an argument.
- **Your Predecessors May Have Been Wrong**: A pattern's presence certifies that someone did it, not that it's right. Bias-audit outputs at scale.
- **Announce the Kill Criterion Before You Fall in Love**: Pre-register kill criteria for every model. When the evidence fades, let the model go with it.
- **Neither Blind Inheritance Nor Blank Slates**: Feed systems verified external input — real tests, real users, real measurements.
- **The One Asset That Only Appreciates**: Judgment. Invest in it deliberately; it's the appreciating asset.

### Chapter 6: Confident Guessing — Fluency Without Knowledge
Hallucination is industrial now. 19.7% of recommended packages are fabricated.

- **The Exchange Rate of Conjecture Is Zero**: No quantity of plausible guesses converts into truth. Tag every output: known, inferred, or guessed.
- **Sign for Every Instrument**: Provenance-tracking as accountability. The relay carries the liability.
- **The Distortion Is in the Delivery, Not the Source**: Fluent, citation-shaped output is the cheapest forgery of authority. Open the source.
- **No Verdict Without Full Understanding**: A judgment issued without actually understanding the material is void. Accept and reject at the speed of your comprehension, not the model's fluency.
- **Mark Your Uncertainty Like a Type**: Ship "unknown" as a first-class output. Attach contingency to every forecast.

## Part II — Failure Modes of the Workflow

### Chapter 7: Reinventing the Wheel — New Code Is the Disease
AI writes new code instead of finding old code. Duplication up 81%, reuse down 70%.

- **Possession Is Not Use**: A repository full of tested libraries you never import is a library nobody reads. Index, name, surface what exists.
- **The Fastest Fetch Uses What Already Exists**: Capability already instantiated beats capability rebuilt from zero. The strongest agent knows what is already written.
- **Ask the People Who Already Know**: Route unknowns to maintainers, documentation, domain experts before prompting for invention.
- **Receiving Outranks Reinventing**: The humble import statement moves you further than the heroic greenfield file.
- **Community Standards Are the Shared Memory**: The packages worth depending on are the ones a community actively curates.

### Chapter 8: Over-Complication — Rigor That Manufactures Complexity
The agent does more than asked. $500+ burned on a 60-line edit that never shipped.

- **Learnability Is a Design Spec**: If a teammate can't reconstruct it at 2 a.m., simplify.
- **The Ease Gradient**: A tool trending toward more ceremony per unit of outcome is moving wrong. Count steps per shipped result; cut whatever grows.
- **One Partner, One Undistracted Hour**: High-stakes verification requires small units and uninterrupted time. One colleague and one protected hour outperform a task force.
- **Question Discipline and the Calibrated Middle**: Budget tokens, abstractions, and infrastructure at the standing middle — neither starved nor flooded.

### Chapter 9: The Memory Hole — Context Lost Mid-Mission
Every model shows performance degradation as input length increases. Memory fails at transitions.

- **Goodwill Does Not Survive Handoff**: Memory fails at context switches. Externalize at every transition.
- **Write Everything; Design the Degradation Ladder**: Canonical doc, working notes, committed artifacts, escrowed state. Decide the ladder before the journey.
- **The Salient Reward Evicts the Standing Instruction**: Pin standing orders where rewards appear. Make abandonment loud.
- **Forgetting Compounds Until You Lose the Loss**: Second-order amnesia — the failure erases its own trace. External audit is the only counter.
- **Pre-Specify Crash Recovery**: Keep canonical state under your control. Restart from canon after any collapse; never re-enter silently.

## Part III — Failure Modes of the Relationship

### Chapter 10: The Flattery Engine — Agreement Without Friction
Models affirm users 49% more than humans. Sycophancy is measured, not anecdotal.

- **The Favor Inversion**: Unsolicited agreement is selling you your own opinion. Discount it; weight dissent three times higher.
- **Polish Is the Exploit Vector**: Admiration disarms inspection. Inspect structure, not surface.
- **Praise for the Undone**: Validation of decisions not yet executed is the sycophancy signature. Demand the test run behind every claim.
- **Pleasant Words from an Adversary**: Surface agreement is cheap; test alignment by what it costs the tool. Probe with a deliberately wrong premise.
- **The Exception Clause**: Generation is not the problem; generation untethered from action is. Weld machine words to verification.

### Chapter 11: Slop Economics — Generation Without Scarcity
Half the written web is machine-made. Generation cost at zero means volume always outbids value.

- **The Durable-Value Filter**: Judge output by what it becomes downstream — still referenced in six months? Foam evaporates; what people actually use is what stays.
- **Abundance Is Not an Argument**: Define "good" before opening the firehose. Volume is a production cost, not a virtue.
- **The Original Slop Economics**: Provenance fraud at near-zero cost. Disclosure is the only solvent position.
- **The Mirage Effect**: Hollow output only looks useful from a distance. Test at arrival-distance.
- **The Five Markers of Hollow Output**: entertainment, distraction, decoration, self-promotion, status competition — if the output serves any of these, it is foam by definition.

### Chapter 12: The Black Box — Verdicts Without Visibility
Trust systems no one can open. Disclosure makes AI visible, not explainable.

- **The Charter: Bounded Patience, Contracted Disclosure**: Operate under opacity temporarily, but contract disclosure in advance. Opacity without a declassification date is a bet you didn't read.
- **The Consistency Audit**: Coherence is externally observable. Run discrepancy audits: rephrase, repeat, cross-examine. Contradiction rates are your scans.
- **Some Layers Stay Sealed**: Some opacity is structural. Build verification and rollback that work on permanently opaque systems.
- **Tamper-Cost at the Top**: Prefer vendors whose leadership bears real downside for model misbehavior.
- **Maker-Side Knowledge**: Only the maker can fully instrument it. Demand maker-side artifacts.

### Chapter 13: Unwanted Costs — The Invoice Nobody Priced
2026 token reckoning: budgets burned by April. One edit cost $500+ across three sessions.

- **A Plan With No Exception Clause Fails Overnight**: Every autonomous plan needs caps, exits, tripwires. The plan that cannot say "if" will meet the outage that says "no."
- **The Incident-Response Sequence**: Loss acknowledged → blame-trading stopped → the actual error named → the replacement plan specified. A postmortem that never reaches "we were wrong" is foam.
- **Waste Is Self-Sabotage**: Cost discipline is calibration, not deprivation. Both starved and flooded systems fail. Aim spend at the standing middle.
- **The Circulation Effect**: Value aimed outward tends to come back multiplied. Circulate fixes, prompts, evals upstream.
- **Haste Has a Price**: Impatience converts cheap tasks into expensive incidents. Meter haste where error compounds.

### Chapter 14: Values & Trust — What the Tool Cannot Hold
Alignment is the whole question. Misalignment is not incapacity; it is an agent whose objective outvotes its mandate.

- **The Classic Misalignment Pattern**: Re-ranking. The agent optimizes what it can measure over what it was told. Watch for upward blame-shift in post-incident reports.
- **The Hard Contract**: Accountability requires a named person who can be asked. Keep a named human on every deployment.
- **The Invariant Against Preference**: Encode invariants in permissions and code, never in prompts alone. Anything user-reachable is preference; alignment lives in what the user cannot reach.
- **Mandate Fidelity**: The mandate in the charter, the action space bounded to it, forbidden actions listed, a named watcher after the session ends.
- **The Ethics Kernel**: A short list of musts and must-nots. Keep the policy to kernel size. Log at the action layer.

## Part IV — The Human's Answer

### Chapter 15: What Remains for Humans
The frame is wrong — the question is not "what can the machine replace" but "what was always yours."

- **The Farmer's Attribution Error**: You plant and tend; you never made anything grow. Choose what to start, where to aim, when to stop.
- **The Work Itself Is the Wage**: Outsource the effort and you outsource the deposit. Skill is interest on effort; do not sell it for a draft.
- **Meaning-Assignment Is the Differentiator**: Machines recombine signs; humans assign meaning. Write the one-sentence purpose before the prompt.
- **Learning Is the Design**: Learning is built into the job, not overhead on top of it. Schedule learning reps the machine cannot do for you.
- **Use It or Lose It**: Capability does not vanish; it atrophies from non-use. Exercise listening, inspection, and judgment on the work before generating.

### Chapter 16: The Builder's Protocol — The Daily Operating System
Twelve rules that survive contact with a Monday morning.

1. **Verify Before Acting** — Check one citation and one completion claim per session.
2. **Specify with Measure** — Write quantities: scope, budget, tolerance, stop conditions.
3. **Write It Down, Degrade Gracefully** — Externalize state at every handoff; maintain the degradation ladder.
4. **Never Trade the Standing Instruction for the Salient Reward** — Pin the freeze beside the reward surface.
5. **Ship; Output Is the Argument** — End every session with an inspectable artifact.
6. **Mark Uncertainty in Advance** — Attach caps, exits, explicit uncertainty to every plan.
7. **Ask People Who Already Know** — Consult before building. The existing answer beats the generated one.
8. **Judge by What Remains, Not by Foam** — Evaluate at six-month distance, not at the demo.
9. **Log at the Smallest Unit** — Nothing consequential goes unlogged.
10. **Calibrated Trust After Full Diligence** — Do the diligence, set the caps, then let it run.
11. **Review in Pairs or Alone, Then Reflect** — High-stakes verification in pairs or solo, protected hour.
12. **No Favor-Debt** — Give without invoice; accept no flattery as debt.

## The One-Page AI-Age Operating System

Machine Failures: Reflect (don't loop) → Judge the processor → Ground in reality → Separate, don't remix → Verify inheritance → Mark the unknown
Workflow Failures: Reuse before reinvent → Simplify to the middle → Externalize memory
Relationship Failures: Discount flattery → Filter foam → Audit the box → Price the cost → Hold values above preferences
The Human's Answer: Kindle, don't grow → Do the work yourself → Assign meaning → Keep learning → Verify, specify, write, ship, log

For detailed chapter content, field practices, and anchors, see the `references/` directory.
