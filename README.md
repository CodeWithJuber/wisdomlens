# Wisdom Lens

Universal operating principles for thinking, working, leading, and building in the AI age.

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

Start a new session after installing; the skills activate on demand. Other hosts: [Install and load](#install-and-load).

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

| Skill                | Triggers                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **wisdom-playbook**  | Life advice, operating principles, pressure handling, leadership, conflict, communication, success/failure management |
| **new-lens**         | AI failure modes, doom loops, hallucination, sycophancy, AI costs, black box problems, slop detection, memory issues  |
| **decision-engine**  | Decisions, option evaluation, risk assessment, conflict resolution, strategic planning                                |
| **builder-protocol** | Best practices for AI work, daily operating rules, productivity system, avoiding AI mistakes                          |

## Agent

| Agent              | Purpose                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| **wisdom-advisor** | Deep, multi-layered guidance synthesizing both frameworks for complex situations |

## Hooks

Two quality-control hooks fire at the end of every response:

1. **Builder's Protocol Check** — Verify, specify, foam-check, mark uncertainty, attribute
2. **Wisdom Lens Tone Check** — Straight speech, calibrated register, pressure awareness

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
