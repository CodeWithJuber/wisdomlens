# Changelog — decision-engine

## [1.1.0] — 2026-10-12

### Added
- `references/skill-routing.md`: conflict matrix with exclusive trigger zones, pairwise precedence rules, and the 2-skill maximum selection rule.
- `## When NOT to Use` section and below-threshold play guidance (what to do when JEV confidence comes back under `minConfidence`).
- JEV adapter contract documentation in `references/jev-integration.md`.
- `license: MIT` frontmatter.
- `last_verified` frontmatter field (rot-check support).

### Fixed
- Trigger description narrowed: the skill now explicitly routes failure-diagnosis prompts to new-lens and option-weighing stays here, reducing misroutes.

## [1.0.0] — 2026-10-09

Initial public release.

### Added
- The six-stage decision loop (clarify → classify → diagnose → generate → decide → act).
- The Probe Protocol for irreversible commitments (one low-cost, reversible test first).
- Force-three-options rule (three genuinely different options, including the disliked one).
- Below-threshold play, conflict resolution framework, risk management checklist, attribution audit, decision logging rule.
- Optional JEV / TypeSafe adapter (`scripts/jev-adapter.mjs`, `scripts/jev-decide.mjs`).
- `references/frameworks.md`, `references/jev-integration.md`.
