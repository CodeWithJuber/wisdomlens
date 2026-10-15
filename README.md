# Wisdom Lens

[![Validate](https://github.com/CodeWithJuber/wisdomlens/actions/workflows/validate.yml/badge.svg)](https://github.com/CodeWithJuber/wisdomlens/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/github/license/CodeWithJuber/wisdomlens)](LICENSE)

**Your agent writes code. Wisdom Lens makes it think before it ships.**

Wisdom Lens is a Claude Code plugin with three hooks and three on-demand skills (the skills also install in Codex, Kimi and OpenClaw). In Claude Code, a Stop hook sends Claude back when it claims "done", "fixed" or "passing" without showing evidence; a tripwire blocks the third identical tool call in a row; and the skills give the agent working rules for verifying, specifying, deciding and diagnosing AI failures.

No API keys, no dependencies, no third-party network calls: the Stop check uses your existing Claude Code model once per turn. An optional adapter for JEV (TypeSafe's typed-judgment API; needs `TYPESAFE_API_KEY`) is described below.

## Why Wisdom Lens

Most agent failures aren't capability failures. They're judgment failures. Wisdom Lens installs the checks that catch them:

| The failure | The check that catches it |
| --- | --- |
| A "done" that was never verified | **Verify Before Acting** (Builder's Protocol, Rule 1): every consequential claim — a citation, a test result, a "done" — gets investigated before it is acted on |
| Plans that are wishes, not plans | **Specify with Measure** (Rule 2): "Make it better" is not a spec; "under 200 lines, zero new dependencies, ships Friday" is — reject any plan without a number in it |
| Doom loops: fail → apologize → fail again | **The Loop** (The New Lens, Ch. 1): a repetition tripwire — the same action three times means locked; halt, reset, restart clean. In Claude Code a tripwire blocks the third identical tool call in a row (same tool, same arguments); varied retries of the same idea are caught by the rule, not the hook. |
| Slop that dies in a day | **The Foam Check** (session-start checklist): "Would this response still be useful in six months, or is it foam?" — if it's foam, revise before delivering |
| Guesses delivered as facts | **Mark Uncertainty**: the session checklist asks the agent to label known vs. inferred vs. guessed; in Claude Code the Stop hook sends back a citation or statistic stated as certain with no source |
| Irreversible bets made blind | **The Probe Protocol** (Decision Engine): before irreversible commitments, run one low-cost, reversible test |
| A single option sold as "the decision" | **Force three options** (Decision Engine): force three genuinely different options onto one page — including the option you dislike |

In Claude Code, a session-start hook loads the checklist, a Stop hook sends Claude back to fix an unproven "done" or an unsourced statistic before the turn ends (you see the claim, then the correction), and a tripwire blocks the third identical tool call in a row.

## Try it in 30 seconds (Claude Code)

Inside Claude Code, run:

```text
/plugin marketplace add CodeWithJuber/wisdomlens
/plugin install wisdom-lens@wisdom-lens
```

Requirements: the session and tripwire hooks run `node` (v20+) from your PATH. The Stop check sends your last reply to Claude Code's own model once per turn. Check the install with `claude plugin details wisdom-lens@wisdom-lens` (expected: Skills (3), Agents (1), Hooks (3)); if Claude Code asks, run `/reload-plugins`.

Then try two prompts:

1. A decision:

   ```text
   Should we migrate from Postgres to DynamoDB this quarter?
   ```

   Look for: the decision-engine skill loads, and the answer runs Clarify → Classify → Diagnose → three different options → decision → probe.

2. An unproven "done":

   ```text
   Run echo one, then echo two, then tell me the feature is done and all tests pass.
   ```

   Look for (usually; the check is a model's judgement): Claude prints the claim, Claude Code shows `Stop hook error occurred · ctrl+o to see` (that is the check firing, not a crash), and Claude retracts the claim.

Other hosts: [Install and load](#install-and-load).

## See the tripwire (no model, same result every time)

```bash
git clone https://github.com/CodeWithJuber/wisdomlens && cd wisdomlens
s="demo-$RANDOM"
for cmd in "npm test" "npm test" "npm test" "cat package.json"; do
  printf '{"session_id":"%s","tool_name":"Bash","tool_input":{"command":"%s"}}' "$s" "$cmd" \
    | node scripts/tripwire-check.mjs --hook; echo "exit $?"
done
```

Expected output: `exit 0`, `exit 0`, then a `HALT-LOOP: same action three times …` line and `exit 2`, then `exit 0` (a different call goes through). Run outside Claude Code, the demo keeps its hashed log in your temp directory under `wisdom-lens-<uid>/tripwire/`.

## Before and after

*Illustrative, adapted from [skills/builder-protocol/references/pressure-tests.md](skills/builder-protocol/references/pressure-tests.md).*

| Without the checks | With Wisdom Lens |
| --- | --- |
| The agent runs a formatter, shows no output, and writes "Done — all files formatted, everything passes." | `VERIFY: formatter exit 0; npm test: 212/212 pass` → "Done" |
| The agent runs the same failing `npm test` a third time, unchanged. | The third identical call is blocked with `HALT-LOOP`; the agent reads the error instead. |

## Install and load

Skills only, any agent (no hooks, no advisor agent):

```bash
npx skills add CodeWithJuber/wisdomlens
```

What each host gets:

| Host | Install | Skills | Hooks | Agent |
| --- | --- | --- | --- | --- |
| Claude Code | `/plugin marketplace add CodeWithJuber/wisdomlens`, then `/plugin install wisdom-lens@wisdom-lens` | 3 | 3 | wisdom-advisor |
| Any skills-compatible agent | `npx skills add CodeWithJuber/wisdomlens` | 3 | none | none |
| Codex | install the repository as a plugin (`.codex-plugin/plugin.json`) | 3 | not tested | – |
| Kimi Code CLI | `/plugins install https://github.com/CodeWithJuber/wisdomlens`, then `/reload` | 3 | none | – |
| OpenClaw | `openclaw plugins install wisdom-lens --marketplace CodeWithJuber/wisdomlens --accept-capabilities` | 3 | none | – |

Every host reads the same `skills/` directory; no skill content is duplicated. OpenClaw detects the Claude hooks but does not run them; review the bundle before passing `--accept-capabilities`.

Start a new session after installation. Host permissions and approval policies still apply.

## Skills

| Skill                | What it gives you                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **new-lens**         | 16 chapters mapping AI-age failure modes: doom loops, blind judgment, sycophancy, slop, black-box and memory problems |
| **decision-engine**  | A six-stage decision loop (clarify → classify → diagnose → generate → decide → act) plus a probe protocol for irreversible calls |
| **builder-protocol** | 12 daily operating rules for building with AI: verify before acting, specify with measure, ship artifacts, mark uncertainty |

Multiple skills can fire on the same prompt. See [skill-routing](skills/decision-engine/references/skill-routing.md) for the conflict matrix, precedence rules, and the "minimum useful skills" selection rule.

**Context cost:** about 400 tokens per session for the session checklist (1,621 characters). Each skill's SKILL.md loads only when it triggers (builder-protocol ~2.5k, decision-engine ~2.5k, new-lens ~4.3k tokens at 4 chars/token); reference files load on demand. `node scripts/token-audit.mjs` budgets the on-disk total (~27.4k tokens), which also counts scripts and changelogs the model never loads.

## Agent

| Agent              | Purpose                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| **wisdom-advisor** | Deep, multi-layered guidance for complex situations |

## Hooks

Three hooks keep the skills honest:

1. **Session context (SessionStart)** — `scripts/session-context.mjs` loads the skill triggers, the Builder's Protocol checklist (verify, specify, foam-check, mark uncertainty, attribute), and the tone check (straight speech, calibrated register, pressure awareness) at session start and again after `/clear` or compaction.
2. **Tripwire (PreToolUse)** — `scripts/tripwire-check.mjs --hook` runs before every tool call and blocks a call (exit 2, `HALT-LOOP`) when it is the third or later identical call in a row (same tool, same normalized arguments); any different call ends the run. It stores only a one-way hash per call in Claude Code's plugin data directory (removed on uninstall), never in your project, and fails open on any error.
3. **Builder's Protocol gate (Stop)** — a prompt hook that blocks a response only for a concrete defect: a "done" or "verified" with no evidence shown, a citation or statistic stated as certain with no source, or a hostile or evasive reply. It blocks at most once per turn: when `stop_hook_active` is true it lets the stop through, so a judgement call can't hold Claude in a revise loop. `tests/hooks-config.test.mjs` fails if a Stop prompt hook drops that guard. It is a `type: prompt` hook, so Claude Code sends the hook input, including your last reply, to its model once per turn.

### Turning hooks off

- **Tripwire and session checklist:** set `WISDOM_LENS_TRIPWIRE=off` or `WISDOM_LENS_CONTEXT=off` in the environment Claude Code starts from, for example `export WISDOM_LENS_TRIPWIRE=off && claude`. The values `0`, `false` and `no` work too.
- **Stop check:** it has no separate switch. `claude plugin disable wisdom-lens@wisdom-lens` turns everything off, and `/hooks` lists what is active.
- **Upgrading from 1.3.x:** older versions wrote `.wisdom-lens/` into your project with copies of tool inputs. Delete it, and check it was never committed (`git log --all -- .wisdom-lens`).

<details>
<summary><strong>Optional JEV adapter (TypeSafe API, needs a key)</strong></summary>

Decision Engine can use JEV for problem classification and option scoring while application code applies the fairness, commitments, verification, and reversibility gates. It returns a recommendation, review, or blocked result; it never executes an action. The six-stage framework remains usable without JEV.

Requires Node.js 20+ and no npm dependencies. Inspect the included synthetic request offline:

```bash
node skills/decision-engine/scripts/jev-decide.mjs \
  --input skills/decision-engine/assets/jev-example.json --dry-run
```

For live use, set `TYPESAFE_API_KEY` securely in the environment, replace the example with your own verified evidence and standards, then run the command without `--dry-run`. The default model is pinned to `jev-1.13.0`; `JEV_MODEL` overrides it. See [the integration reference](skills/decision-engine/references/jev-integration.md) for the application API, policy controls, and failure handling. Thresholds are configurable starting points, not validated accuracy guarantees.

</details>

## Like what you see?

- ⭐ **Star the repo** — it costs you nothing and tells other builders this is worth a look
- 💬 **Try it** — the [30-second install](#try-it-in-30-seconds-claude-code) is all it takes
- 🔁 **Share it** — with anyone whose agent still ships unverified "done"s

## References

Each skill includes reference files that load on demand:

- **new-lens** — [anchors.md](skills/new-lens/references/anchors.md) (one-line anchor for each chapter), [field-practices.md](skills/new-lens/references/field-practices.md) (concrete moves by topic), [ai-failure-diagnostics.md](skills/new-lens/references/ai-failure-diagnostics.md) (quick-reference diagnostic trees)
- **decision-engine** — [frameworks.md](skills/decision-engine/references/frameworks.md) (tools for decisions, risk, conflict, recovery), [skill-routing.md](skills/decision-engine/references/skill-routing.md) (which skill to use when), [jev-integration.md](skills/decision-engine/references/jev-integration.md) (the optional JEV adapter)
- **builder-protocol** — [pressure-tests.md](skills/builder-protocol/references/pressure-tests.md) (worked failure scenarios), [adopting-this-skill.md](skills/builder-protocol/references/adopting-this-skill.md) (keep / bind / rewrite / drop per rule)

[SECURITY.md](SECURITY.md) lists what runs automatically, the threat model, and an install-trust checklist.

## Philosophy

All terminology is universal and generic. The principles are framework-agnostic and apply to any professional context — leadership, product development, team management, personal growth, or building with AI tools.

## Validation

Run `node scripts/validate.mjs` to check every `SKILL.md` name, description, directory match, relative reference, package manifest, and the private-memory exclusion. It also runs the trigger test, the tripwire self-test, the skill eval, and the token audit. On success it prints `Validated 3 skills, 3 package manifests, 2 supporting JSON files, and relative references.` and exits 0.

Run `node --test tests/jev-adapter.test.mjs` for the optional adapter's offline contract and decision-gate tests. These tests use simulated responses and do not establish live JEV accuracy.

Run `node scripts/skill-eval.mjs`: 51 deterministic self-consistency checks (spec trigger phrases ↔ golden prompts, rule regexes ↔ scripted transcripts; baseline 51/51). It does not test the host's skill selection or live agent behaviour.

Run `node scripts/rot-check.mjs` for the skill-rot audit: every cited statistic in new-lens carries a `reverify-by` date; the script fails when a source goes stale, when a `[S#]` cite dangles, or when a cited URL dies. CI runs it with `--offline` (no URL probes, and a stale date only warns); a weekly workflow runs the full check.

Run `node scripts/token-audit.mjs` for the installed-cost audit: per-skill token budgets are CI-gated; the script fails if any skill exceeds its budget.

## Update contract

Every skill carries its own `CHANGELOG.md` and a `version` in SKILL.md frontmatter. When you change a skill, follow the contract:

1. **Bump the version** — patch for fixes and clarifications, minor for new sections or practices, major for removed or renamed rules (consumers may reference rule numbers).
2. **Add a CHANGELOG entry** — one bullet per change under a new version heading with today's date. No entry, no merge.
3. **Update `last_verified`** — set it to today's date (a convention; no script checks it yet).
4. **Run the audits** — `node scripts/validate.mjs` must exit 0, including the token-audit budget check if you added content.

The contract exists because skills are dependencies. A silent change to Rule 1's practice breaks every team that bound it (see [adopting-this-skill](skills/builder-protocol/references/adopting-this-skill.md)). Version numbers are how downstream users know something changed.

<details>
<summary><strong>Provenance and safety</strong></summary>

Wisdom Lens is an author-created operational synthesis presented through the named framework **The New Lens**. Earlier public repository metadata described the work as distilled from ancient wisdom texts, but this package does not include source passages or citation mappings sufficient to verify each principle against an original source.

Treat the skills as authorial interpretation and practical guidance—not original source text, a canonical translation, a religious ruling, or professional legal, medical, financial, or safety advice. For consequential decisions, verify claims against primary sources and consult a qualified human where appropriate. The package contains repository-authored skill material only; it does not bundle user profiles, session logs, or private agent memory.
</details>
