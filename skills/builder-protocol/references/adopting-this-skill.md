# Adopting builder-protocol — keep / bind / rewrite / drop

This skill was written for one author's workflow. Yours is different. Don't
adopt it whole and don't reject it whole — decide per rule what survives
contact with your team.

## The decision table

For each of the twelve rules, pick one:

| Decision | Meaning | When to pick it |
|---|---|---|
| **keep** | Use as written | The rule fits your workflow unchanged |
| **bind** | Keep, but enforce mechanically | The rule matters and your team will drift without a hook, check, or CI gate enforcing it |
| **rewrite** | Keep the intent, change the practice | The rule's *why* is right but its *how* doesn't fit your stack (different tools, different ceremony level) |
| **drop** | Don't adopt | The rule solves a problem you don't have, or conflicts with a stronger local norm |

Work through the rules in order. A suggested starting pass for a typical
small team shipping with AI agents:

| Rule | Suggested | Notes |
|---|---|---|
| 1 — Verify Before Acting | **bind** | The `VERIFY:` line practice is the highest-value item in the skill. Bind it with the Stop hook check; without the hook, teams drift within weeks. |
| 2 — Specify with Measure | **keep** | Cheap to keep; the numeral-in-plan practice needs no tooling. |
| 3 — Write It Down, Degrade Gracefully | **rewrite** | The degradation ladder assumes a docs culture. If your team lives in chat, rewrite the practice around your actual handoff surface. |
| 4 — Standing Instruction vs Salient Reward | **keep** | Universal. The only change most teams need is writing down *their* standing instructions. |
| 5 — Ship; Output Is the Argument | **keep** | If your team already ships weekly, this is confirmation. If not, it's the intervention. |
| 6 — Mark Uncertainty in Advance | **bind** | Pairs with Rule 1's verification. The `[known]/[inferred]/[guessed]` tags are on the session-start checklist; the Stop hook blocks the worst case, a citation or statistic stated as certain with no source. |
| 7 — Ask People Who Already Know | **rewrite** | The `SEARCHED:` line practice is sound; the "specialist roster" assumes an org with specialists. Solo builders: rewrite as "check docs + one community source". |
| 8 — Judge by What Remains | **keep** | A review lens, not a process. No enforcement needed. |
| 9 — Log at the Smallest Unit | **bind** | Only if you have somewhere the log goes. A logging rule without a log destination is a wish. Bind it to your actual artifact store or drop it. |
| 10 — Calibrated Trust After Full Diligence | **keep** | Cultural, not procedural. |
| 11 — Review in Pairs or Alone | **rewrite** | Assumes calendar control most teams don't have. Keep the principle (small, undistracted review); rewrite the scheduling practice. |
| 12 — No Favor-Debt | **keep** | Especially load-bearing if your agents serve non-technical users. |

The table above is a suggestion, not a prescription. Your team's honest
pass will differ — that's the point. The failure mode is adopting all
twelve unchanged (ceremony bloat) or rejecting the skill because three
rules don't fit (throwing out the verification practice with the
scheduling advice).

## The `assumes:` frontmatter

If you maintain a fork or a team-local variant of this skill, declare what
it assumes about the environment. Add an `assumes:` block to the SKILL.md
frontmatter:

```yaml
assumes:
  - "git repository with a working tree (VERIFY: lines reference diffs)"
  - "a test command the agent can run (Rule 1's verification practice)"
  - "CI that runs scripts/validate.mjs or equivalent (bound rules need teeth)"
  - "one human who reads the session log per week (Rule 9's observer)"
```

Why: the skill's practices reference tools (diffs, test suites, CI, logs).
When an assumption is false, the corresponding practice degrades silently —
the agent "verifies" by asserting, because there's nothing to run. Listing
assumptions turns silent degradation into a visible gap: if you can't tick
an assumption, you know which rules are running on foam.

The upstream skill does not carry `assumes:` because it targets the
general case. Your fork should, because you know your case.

## After the first month

Revisit the table. Rules you marked **keep** but never invoked are
candidates for **drop** — an uninvoked rule is ceremony. Rules you marked
**bind** where the hook never fired are either perfectly internalized or
never triggered; check which by reviewing one session log against the
rule list.

The skill is working when your team's failure postmortems start citing
rule numbers without prompting.
