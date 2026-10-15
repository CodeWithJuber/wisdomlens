# Skill Routing — When to Use Which (and When Not)

The three skills overlap at their edges. This page is the conflict matrix and
the selection rule. Pick the **minimum useful skills — usually two** — and name
the decision before selecting skills. Stacking frameworks for decoration is
the failure this page prevents.

## Exclusive trigger zones

| Trigger                                                                     | Skill                | Why                         |
| --------------------------------------------------------------------------- | -------------------- | --------------------------- |
| Building, shipping, plans, acceptance criteria, "done"/"push it"/"merge it" | **builder-protocol** | Build-time operating rules  |
| Choosing between options, trade-offs, risk, go/no-go, irreversibility       | **decision-engine**  | Decision loop + typed gates |
| "Why did this fail", loops, sycophancy, slop, hallucinating, memory loss    | **new-lens**         | Failure diagnosis           |

## Conflict matrix

| Pair                               | Overlap                                                                   | Precedence                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| builder-protocol × decision-engine | "verify" appears in both (Rule 1 vs Stage 1 gate).                        | **builder-protocol wins** for verification procedure (VERIFY: lines, acceptance criteria); decision-engine keeps the "what decision does this answer change?" gate. |
| builder-protocol × new-lens        | Rule 1 "verify" vs Ch. 2 "blind judgment" (don't trust the model's word). | **Complementary, not conflicting**: new-lens says _why_ the model's word is insufficient; builder-protocol says _what to do about it_ (independent check).          |
| decision-engine × new-lens         | Both can fire on "something went wrong and now we must choose".           | **new-lens first** (diagnose the failure), **decision-engine second** (decide the response). Name the decision before loading both.                                 |
| Any skill × any skill              | Duplicate guidance loaded twice costs tokens and dilutes both.            | Two-skill maximum per task; if you reach for a third, you haven't named the decision yet.                                                                           |

## SessionStart order

The SessionStart hook names one line per skill. Load in this order when
ambiguous: builder-protocol (frame the work) → decision-engine (structure the
choice) → new-lens (diagnose on failure). new-lens never plans; builder-protocol
never diagnoses; decision-engine never executes.

## Anti-patterns

- **Framework stacking:** loading all three "just in case". If you can't name
  the decision, you don't need decision-engine.
- **Diagnosis as verdict:** new-lens identifies the failure mode; it does not
  authorize skipping the repair step. "It's sycophancy" is a diagnosis, not a fix.
- **Verification as theatre:** builder-protocol's VERIFY: line must quote the
  check performed. "I verified" with no check is foam (see the Sycophancy
  diagnostics for the signature).
