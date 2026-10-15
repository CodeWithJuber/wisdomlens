# Changelog — builder-protocol

## [1.0.1] — 2026-10-15

### Fixed
- The intro no longer claims each rule was tested against real failures; it now says each rule targets a recurring agent failure pattern.
- `references/pressure-tests.md`: the scenarios are now described as illustrative, modelled on common agent failure patterns, rather than distilled from real incidents.
- `references/pressure-tests.md` scenario 1: corrected the claim that the tripwire hook blocks this case. The hook runs only in the Claude Code plugin and blocks only exact repeats (same tool, same arguments), so varied timeout bumps never trip it; Rule 1's red flag is what catches them.

## [1.0.0] — 2026-10-12

Initial public release of the skill as a standalone pack.

Not everything below shipped on that date: `references/pressure-tests.md`, `references/adopting-this-skill.md` and the References section that links them landed on 2026-10-14 (commit 9e6222c) without a version bump.

### Added
- Twelve rules for builders (verify, specify, write, ship, log, and eight more), each with a checkable practice.
- Rule 1 red-flags table (five halt signals) and rationalization-prevention table (six excuses with answers).
- Quick Diagnostics: loop / slop / sycophancy checks.
- The Anxiety Protocol and Anchors Worth Memorizing.
- The AI Oversight Equation (net AI value = production time saved − verification + repair + recurrence + learning loss + trust degradation).
- `references/pressure-tests.md`: five adversarial scenarios with worked correct behavior.
- `references/adopting-this-skill.md`: keep/bind/rewrite/drop decision table and `assumes:` frontmatter guidance.
- `## When NOT to Use` section (trivial questions, domain-expertise substitution, explicit casual instruction, sub-10-minute tasks).
- `scripts/rot-check.mjs` support: `last_verified` frontmatter field.
- `license: MIT` frontmatter.
