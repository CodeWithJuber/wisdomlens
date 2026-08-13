# AI Failure Mode Diagnostics

Quick-reference diagnostic trees for identifying and fixing common AI failure modes.

## Diagnostic 1: Is It Looping?

```
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

```
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

```
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

```
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

```
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

```
Net AI Value = Production Time Saved
             - Verification Cost
             - Repair Cost
             - Recurrence Cost
             - Learning Loss
             - Trust Degradation
```

Most organizations count only the first term. Count all six.

## Key Statistics (2025-2026)

- 19.7% of AI-recommended packages are hallucinated (USENIX Security, 2025)
- 1,598 court decisions involving hallucinated AI citations (Charlotin, 2026)
- AI-assisted developers 19% slower while believing themselves 20% faster (METR, 2025)
- Models affirm users 49% more than humans do (Science, 2026)
- AI duplication up 81%, reuse down 70% across 623M code changes (GitClear, 2026)
- All 18 tested models show performance degradation as input length increases (Chroma, 2025)
- 40% of desk workers received "workslop" — costing ~$186/employee/month (BetterUp/Stanford, 2025)
- Endoscopists' unassisted detection rate fell from 28.4% to 22.4% after regular AI use (Lancet, 2025)
