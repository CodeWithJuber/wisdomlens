# Changelog — wisdom-lens

Changes to the plugin as a whole: hooks, agent, manifests, CI and docs. Each skill also keeps its own `CHANGELOG.md` under `skills/<name>/`. Entries before 1.4.0 are reconstructed from git history; for 1.0.0 to 1.2.1, see the git log.

## [1.4.0] — 2026-10-15

### Fixed
- The tripwire no longer blocks every later tool call after one HALT-LOOP. It blocks only while the run of identical calls continues; a different call ends the run.
- The tripwire no longer stores raw tool inputs in your project. It keeps a one-way hash per call in Claude Code's plugin data directory, or in a per-user temp folder when run outside Claude Code (directory mode 0700, file mode 0600).
- Parallel tool calls no longer overwrite each other's tripwire records.
- The tripwire and session-context hooks no longer silently do nothing when the plugin path is a symlink.
- The wisdom-advisor agent quotes a principle's name or anchor line only from text it has in front of it, and otherwise says it is paraphrasing from memory.
- Skill text no longer overstates the tooling or its sources: the tripwire is described as Claude Code only and exact repeats only, a claimed lint check is gone, and unsourced statistics are now sourced or tagged. Details are in each skill's changelog (new-lens 1.0.1, builder-protocol 1.0.1, decision-engine 1.1.1).

### Added
- Off switches: `WISDOM_LENS_TRIPWIRE=off` and `WISDOM_LENS_CONTEXT=off` (`0`, `false` and `no` also work). A tripwire block message names its switch.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), issue forms for bugs and false blocks, a pull request template, `.gitattributes` and `.editorconfig`.
- This root changelog.

### Changed
- `scripts/validate.mjs` reads the version from `.claude-plugin/plugin.json`, requires every other manifest (the marketplace and its plugin entries, Codex, Kimi) to match it, and requires a matching `## [version]` entry in this file.
- CI runs on pushes to main, on pull requests and by hand, and runs `rot-check --offline`, so a passed reverify-by date warns instead of failing the build. The full source check, with URL probes, runs weekly. Dependabot proposes GitHub Actions updates monthly.
- README and SECURITY.md now state what runs automatically, which hosts run hooks, and the Stop check's per-turn model call. Security reports go to private advisories.
- `docs/redesign-note.md` is removed; its policy (redesigns land here as pull requests) is now in `CONTRIBUTING.md`.

### Upgrading
- Delete the `.wisdom-lens/` folder that 1.3.x wrote into your projects (it can contain copies of tool inputs), and check it was never committed: `git log --all -- .wisdom-lens`.

## [1.3.1] — 2026-10-15

### Fixed
- The Stop hook no longer holds Claude in a revise loop. One check now allows the stop when `stop_hook_active` is set and blocks only for concrete defects: an unproven "done", an unsourced citation or statistic, or a hostile or evasive reply. The separate tone-check Stop hook is removed.
- The SessionStart hooks never ran, because prompt hooks do not run on SessionStart. `scripts/session-context.mjs`, a command hook that prints the skill triggers and the Builder's Protocol checklist, replaces them.

## [1.3.0] — 2026-10-04

- Optional JEV adapter for the Decision Engine (`skills/decision-engine/scripts/jev-decide.mjs`).
- Later changes shipped under this same number from 2026-10-11 to 2026-10-14 without a version bump: SessionStart hooks added, the wisdom-playbook skill removed, and the PreToolUse tripwire added; then `SECURITY.md`, `scripts/rot-check.mjs`, `scripts/token-audit.mjs` and the per-skill changelogs.
