# AI Failure Mode Diagnostics

Quick-reference diagnostic trees for identifying and fixing common AI failure modes.

## Diagnostic 1: Is It Looping?

```text
Agent repeating actions?
├── Same action 3+ times → LOCKED. Halt session.
│   ├── Inspect context for anchored wrong assumption
│   ├── Force different reasoning path: new angle, new tool, fresh session
│   └── Never a louder repeat of the same approach
├── Near completion but adding passes → FINISH-LINE HOOK
│   ├── Define done explicitly
│   ├── Pin standing instruction: no refactors, no extras, finish
│   └── Treat visible near-term reward as moment to tighten, not relax
└── Asking more questions than acting → HESITATION-AS-DILIGENCE
    ├── Write smallest executable version first
    ├── Gate each question: what decision does the answer change?
    └── After 3rd question, hand it a test to run instead
```

## Diagnostic 2: Is It Hallucinating?

```text
Output sounds confident and specific?
├── Tag it: known, inferred, or guessed
├── Check citations against actual sources
│   ├── Open the source document/package/case
│   ├── Fluency is a risk factor, not quality signal
│   └── Authority bias makes fabricated citations look real
├── Check packages/dependencies
│   ├── 19.7% of recommended packages are fabricated
│   └── Verify existence before installing
└── If uncertain about uncertainty
    ├── Ship "unknown" as first-class output
    ├── Attach contingency to every forecast
    └── Accept and reject at comprehension speed, not fluency speed
```

## Diagnostic 3: Is It Sycophantic?

```text
Tool agrees enthusiastically?
├── Probe with deliberately wrong premise
│   ├── If it follows you off the cliff → SYCOPHANCY CONFIRMED
│   └── If it pushes back → Healthy dissent
├── Strip compliments from transcript
│   ├── Reread for substance only
│   └── Weight dissent 3x higher than praise
├── Check praise-to-performance ratio
│   ├── Praising undone work? → Red flag
│   └── Validation without testing? → Decouple acclaim from action
└── Remember: agreement costs the tool nothing
    └── Price it accordingly
```

## Diagnostic 4: Is It Over-Complicating?

```text
More files/steps than expected?
├── Count steps per shipped result
│   ├── Trending up? → Cut what grows
│   └── Stable? → Probably fine
├── Apply the 2 a.m. test
│   ├── Could a tired teammate reconstruct this? → Pass
│   └── Needs its own onboarding? → Simplify
├── Check for unnecessary additions
│   ├── Files not in the spec? → Remove
│   ├── Packages not needed? → Remove
│   └── Abstractions beyond requirements? → Remove
└── Calibrate to standing middle
    ├── Neither starved (under-built) nor flooded (over-built)
    └── Enough scaffolding to hold the outcome; none for show
```

## Diagnostic 5: Is It Losing Context?

```text
Agent seems to forget earlier instructions?
├── Check context window length
│   ├── Long session? → Approaching degradation territory
│   └── All models degrade with input length — 100% of them
├── Was there a handoff or compaction?
│   ├── Memory fails at transitions, not in storage
│   └── Diff the summary against the actual session
├── Is a reward overriding a standing instruction?
│   ├── Pin instruction adjacent to reward surface
│   └── Make abandonment loud, not silent
└── Recovery protocol
    ├── Keep canonical state doc under your control
    ├── Agents work on copies
    ├── After collapse: rebuild from canon, declare what was lost
    └── Never resume silently after context loss
```

## The AI Oversight Equation

```text
Net AI Value = Production Time Saved
             - Verification Cost
             - Repair Cost
             - Recurrence Cost
             - Learning Loss
             - Trust Degradation
```

Most organizations count only the first term. Count all six.

## Key Statistics (2025-2026)

- 19.7% of AI-recommended packages are hallucinated [known] — USENIX Security 2025, "We Have a Package for You!" (Spracklen et al.) [S1]
- Damien Charlotin's public AI-hallucination database logs roughly 1.5k–2,000 court decisions [inferred] — the count grows over time; the "1,598" figure was a snapshot at time of writing [S2]
- AI-assisted developers 19% slower while believing themselves 20% faster [known] — METR randomized controlled trial, arXiv:2507.09089 [S3]
- Models affirm users' actions ~49% more than humans do [known] — Science 2026 (Cheng et al.; measure-dependent, ~47–50% across study arms) [S4]
- Duplicated code blocks up 81%; cross-file function calls (the reuse proxy) down 35% across 623M code changes [known] — GitClear "The AI Code Quality Maintainability Gap," 2026 [S5]. Correction: the draft's "reuse down 70%" mislabeled the metric; the −70% figure is the fall in moved/refactored lines (21% → 3.8%), not reuse.
- All 18 tested frontier models show performance degradation as input length increases [known] — Chroma "Context Rot," July 2025 [S6]
- 40% of US desk workers received "workslop" in the prior month [known]; ~$186/employee/month cost [inferred — survey-based extrapolation] — BetterUp Labs + Stanford Social Media Lab, "The Cost of Workslop," Sept 2025 [S7]
- Endoscopists' unassisted adenoma detection rate fell from 28.4% to 22.4% after regular AI use [known] — The Lancet Gastroenterology & Hepatology, Aug 2025 (Romańczyk et al.) [S8]

## Sources

S1. Spracklen et al., "We Have a Package for You!" USENIX Security 2025.
https://arxiv.org/abs/2406.10279
reverify-by: 2027-04-01

S2. Damien Charlotin, AI Hallucination Cases database (live tracker; counts change as new cases are logged).
https://www.damiencharlotin.com/hallucinations/
reverify-by: 2027-01-12

S3. METR, randomized controlled trial on AI coding tools and experienced-developer productivity (Feb–Jun 2025). arXiv:2507.09089
Caveat [inferred]: the study tested pre-agentic tools (Cursor Pro + Claude 3.5/3.7 Sonnet); METR's 2026 revision calls the result "only very weak evidence" for current agentic tools.
reverify-by: 2027-04-01

S4. Cheng et al., "Sycophantic AI Decreases Prosocial Intentions and Promotes Dependence." Science, 2026. DOI 10.1126/science.aec8352 (preprint arXiv:2510.01395).
reverify-by: 2027-04-01

S5. GitClear, "The AI Code Quality Maintainability Gap," 2026.
https://www.gitclear.com/the_ai_code_quality_maintainability_gap
Caveat [inferred]: GitClear sells code-analysis tooling; the data shows correlation across the AI era, not isolated causation, and the dataset does not tag which commits were AI-written.
reverify-by: 2027-07-01

S6. Chroma, "Context Rot," July 2025.
https://www.trychroma.com/research/context-rot
reverify-by: 2027-04-01

S7. BetterUp Labs + Stanford Social Media Lab, "The Cost of Workslop," Sept 2025 survey of US desk workers.
https://www.betterup.com/workslop
Caveat [inferred]: self-reported survey data, not controlled measurement.
reverify-by: 2027-04-01

S8. Romańczyk et al., The Lancet Gastroenterology & Hepatology, Aug 2025 (AI-assisted colonoscopy deskilling study; 19 experienced endoscopists, 4 Polish centers).
reverify-by: 2027-04-01
reverify-by: 2027-04-01
