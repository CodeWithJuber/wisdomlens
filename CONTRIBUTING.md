# Contributing to Wisdom Lens

This repo (`CodeWithJuber/wisdomlens`) is the source of truth for Wisdom Lens.
Redesigns land here as pull requests, not as a parallel copy.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report
security problems privately, as [SECURITY.md](SECURITY.md#reporting) describes,
never in a public issue.

## Ways to help

- **Report a false block.** The Stop check or the tripwire blocked something it
  shouldn't have. Use the [false block form](https://github.com/CodeWithJuber/wisdomlens/issues/new?template=false_block.yml)
  and paste the block reason and the reply or tool calls it blocked.
- **Report a missed loop.** The agent repeated the same call and nothing
  stopped it. Use the [bug report form](https://github.com/CodeWithJuber/wisdomlens/issues/new?template=bug_report.yml)
  with the tool calls in order. The tripwire only blocks the third *identical*
  call in a row; varied retries are left to the skill rule by design.
- **Propose a rule.** Open an issue first. Name the failure the rule catches,
  how an agent or a script can check it, and a source for any number it cites.
- **Add a host.** Add the host's manifest with `"name": "wisdom-lens"`, the
  current version and `skills` pointing at `./skills/`, and add it to the
  `manifests` list in `scripts/validate.mjs`. Add a row to the README host
  table that claims only what you tested on that host (date and host version).

## Setup

You need Node.js 20 or newer and git. There is no install step: the repo has
no dependencies and no build. To try a change in Claude Code, start a session
from the repo root with `claude --plugin-dir .`.

## Run what CI runs

CI (`.github/workflows/validate.yml`) runs these on Node 20, 22 and 24. Run
them from the repo root before you open a pull request:

```bash
node scripts/validate.mjs
node scripts/trigger-test.mjs
node scripts/tripwire-check.mjs --self-test
node scripts/skill-eval.mjs
node scripts/rot-check.mjs --offline
node scripts/token-audit.mjs
node --test tests/*.test.mjs
```

Without `--offline`, `rot-check.mjs` also probes every cited URL and fails on a
past `reverify-by` date; the weekly source-rot workflow runs it that way.

## Changing a skill

- Bump `metadata.version` in its `SKILL.md`: patch for fixes and
  clarifications, minor for new sections or practices, major for removed
  or renamed rules (people bind to rule numbers).
- Add an entry to the skill's `CHANGELOG.md` under a new
  `## [x.y.z] — YYYY-MM-DD` heading. No entry, no merge.
- Set `metadata.last_verified` to today's date.
- Stay within the skill's token budget (`BUDGETS` in
  `scripts/token-audit.mjs`). Raise a budget only on purpose, and say why.
- A new statistic or citation in new-lens needs a source entry with a
  `reverify-by` date (`scripts/rot-check.mjs` checks it).
- Adding a skill: give it a budget in `BUDGETS`, add it to `SKILLS` and
  `SAMPLES` in `scripts/trigger-test.mjs`, to `SKILLS` in
  `scripts/skill-eval.mjs`, and to `TRIGGERS` in
  `scripts/session-context.mjs`, then update the README skill table.
- Skills ship in the plugin, so also follow the next section.

## Changing hooks, the agent, or anything else that ships

- Add or update a test in `tests/` for the behaviour you changed. Keep the
  command hooks failing open: on any error they exit 0 and let the call
  through.
- Bump `version` in `.claude-plugin/plugin.json`: minor for any change in
  what the agent sees or does (the update contract in SECURITY.md), patch
  otherwise. Set the same version in `.claude-plugin/marketplace.json`
  (top level and the plugin entry), `.codex-plugin/plugin.json` and
  `kimi.plugin.json`.
- Add an entry for that version to the root `CHANGELOG.md`.
- If what runs, what it sends or what it writes changes, update the table
  in SECURITY.md and the Hooks section of README.md.
- Use Node built-ins only. No dependencies, no install scripts.

Update the docs in the same pull request as the change, not later.
