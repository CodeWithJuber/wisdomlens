# Changelog — decision-engine

## [1.1.1] — 2026-10-15

### Fixed
- The JEV adapter command now gives a runnable invocation: `node "${CLAUDE_SKILL_DIR}/scripts/jev-decide.mjs" --input <file> --dry-run` in Claude Code, with paths relative to the skill's directory on other hosts. The old bare `scripts/jev-decide.mjs` path resolves against the user's working directory, not the skill's.
- `references/skill-routing.md` and `references/frameworks.md` were not linked from SKILL.md; a new References section now points to both.

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
