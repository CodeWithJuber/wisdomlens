# Wisdom Lens

**Your agent writes code. Wisdom Lens makes it think before it ships.**

Wisdom Lens is an instruction-only skill pack — an operating layer for your agent's judgment. Once installed, your agent starts checking its own work: it verifies claims before acting, specifies with numbers before building, ships artifacts instead of foam, and marks what it doesn't know.

No new tools, no credentials, no network access. Just better thinking, installed in 30 seconds.

## Why Wisdom Lens

Most agent failures aren't capability failures. They're judgment failures. Wisdom Lens installs the checks that catch them:

| The failure | The check that catches it |
| --- | --- |
| A "done" that was never verified | **Verify Before Acting** (Builder's Protocol, Rule 1): every consequential claim — a citation, a test result, a "done" — gets investigated before it is acted on |
| Plans that are wishes, not plans | **Specify with Measure** (Rule 2): "Make it better" is not a spec; "under 200 lines, zero new dependencies, ships Friday" is — reject any plan without a number in it |
| Doom loops: fail → apologize → fail again | **The Loop** (The New Lens, Ch. 1): a repetition tripwire — the same action three times means locked; halt, reset, restart clean |
| Slop that dies in a day | **The Foam Check** (Stop hook): "Would this response still be useful in six months, or is it foam?" — if it's foam, revise before delivering |
| Guesses delivered as facts | **Mark Uncertainty** (Stop hook): every response labels what's known vs. inferred vs. guessed |
| Irreversible bets made blind | **The Probe Protocol** (Decision Engine): before irreversible commitments, run one low-cost, reversible test |
| A single option sold as "the decision" | **Force three options** (Decision Engine): force three genuinely different options onto one page — including the option you dislike |

Two automatic quality-control hooks run at the end of every response, so these aren't suggestions your agent reads once — they're checks it passes every time.

## Try it in 30 seconds (Claude Code)

Inside Claude Code, run:

```text
/plugin marketplace add CodeWithJuber/wisdomlens
/plugin install wisdom-lens@wisdom-lens
```

Then test it with one prompt:

```text
Using the builder-protocol skill, walk me through Rule 1 — Verify Before Acting and apply it to my request.
```

Start a new session after installing; the skills activate on demand. Then give it a real task and watch the difference — every answer passes the two quality-control checks ([Hooks](#hooks)) before it reaches you. Other hosts: [Install and load](#install-and-load).

Distilled into actionable frameworks for modern professionals:

- **The Wisdom Playbook** — 20 chapters covering mind, work, people, and the core self
- **The New Lens** — 16 chapters mapping AI-age failure modes and the builder's protocol

## Install and load

The same `skills/` directory is packaged without duplicated skill content:

- **Claude Code:** install this repository as a plugin using `.claude-plugin/plugin.json` (existing support is unchanged).
- **Codex:** install the repository as a plugin; `.codex-plugin/plugin.json` points Codex at `skills/`.
- **Kimi Code CLI:** run `/plugins install https://github.com/CodeWithJuber/wisdomlens`, then `/reload`. Kimi reads `kimi.plugin.json`.
- **OpenClaw:** review the bundle, then run `openclaw plugins install https://github.com/CodeWithJuber/wisdomlens --accept-capabilities`. OpenClaw maps the Codex bundle's skill root; the existing Claude prompt hooks are detected but not executed by OpenClaw.

Start a new session after installation. These are instruction-only skills: they add no executable tools, credentials, or network access. Host permissions and approval policies still apply.

## Provenance and safety

Wisdom Lens is an author-created operational synthesis presented through two named frameworks, **The Wisdom Playbook** and **The New Lens**. Earlier public repository metadata described the work as distilled from ancient wisdom texts, but this package does not include source passages or citation mappings sufficient to verify each principle against an original source.

Treat the skills as authorial interpretation and practical guidance—not original source text, a canonical translation, a religious ruling, or professional legal, medical, financial, or safety advice. For consequential decisions, verify claims against primary sources and consult a qualified human where appropriate. The package contains repository-authored skill material only; it does not bundle user profiles, session logs, or private agent memory.

## Skills

| Skill                | What it gives you                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **wisdom-playbook**  | 20 chapters of operating principles: thinking, pressure handling, leadership, communication, failure recovery, purpose |
| **new-lens**         | 16 chapters mapping AI-age failure modes: doom loops, blind judgment, sycophancy, slop, black-box and memory problems |
| **decision-engine**  | A six-stage decision loop (clarify → classify → diagnose → generate → decide → act) plus a probe protocol for irreversible calls |
| **builder-protocol** | 12 daily operating rules for building with AI: verify before acting, specify with measure, ship artifacts, mark uncertainty |

## Agent

| Agent              | Purpose                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| **wisdom-advisor** | Deep, multi-layered guidance synthesizing both frameworks for complex situations |

## Hooks

Two quality-control hooks fire at the end of every response:

1. **Builder's Protocol Check** — Verify, specify, foam-check, mark uncertainty, attribute
2. **Wisdom Lens Tone Check** — Straight speech, calibrated register, pressure awareness

## Like what you see?

- ⭐ **Star the repo** — it costs you nothing and tells other builders this is worth a look
- 💬 **Try it** — the [30-second install](#try-it-in-30-seconds-claude-code) is all it takes
- 🔁 **Share it** — with anyone whose agent still ships unverified "done"s

## References

Each skill includes detailed reference files:

- **Anchors** — One-line memorable principles for each chapter
- **Field Practices** — Concrete, actionable moves organized by topic
- **Glossary** — Universal terms and key concepts
- **AI Failure Diagnostics** — Quick-reference diagnostic trees
- **Decision Frameworks** — Structured tools for decisions, risk, conflict, recovery

## Philosophy

All terminology is universal and generic. The principles are framework-agnostic and apply to any professional context — leadership, product development, team management, personal growth, or building with AI tools.

## Validation

Run `node scripts/validate.mjs` to check every `SKILL.md` name, description, directory match, relative reference, package manifest, and the private-memory exclusion.
