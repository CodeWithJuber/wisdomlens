# Security

This skill pack is **instruction-only by design**: Markdown skill files plus two
Node scripts (the JEV adapter is opt-in and never runs on install). The core
skills need no credentials, no network access, and no installation step beyond
copying files. That constraint is a security property — it bounds what a
compromised package can do.

## Threat model

**What cannot happen with the core skills:** there is no code to execute, so
the classic supply-chain payloads (install-time RCE, dependency hijacking,
credential exfiltration via a malicious dependency) have no execution path.
The JEV adapter scripts run only when you invoke them directly, with an API key
you supply; they make a single outbound POST to `https://api.typesafe.ai` and
never execute the model's recommendation.

**What can still happen (honest scope):**

1. **Prompt-injection via skill text.** Skill files are instructions to your
   agent. A tampered SKILL.md could instruct your agent to do things the author
   never intended. This is the real attack surface — not the code.
2. **Persistent memory writes.** Some install flows let a skill bundle write to
   `MEMORY.md`, `SOUL.md`, or agent config files. Those writes persist across
   sessions and are a known persistence vector (see ClawHavoc, Jan 2026).
3. **Silent update drift.** A skill that is clean today can turn hostile
   tomorrow if updates are unsigned and unpinned.

## Install-trust checklist (before installing any third-party skill)

1. Read the SKILL.md files. All of them. This pack has 3 skills and takes about
   ten minutes — that smallness is the point.
2. Search for imperative install steps: any "Prerequisites: run this command"
   is the ClawHavoc signature — do not run it.
3. Check what the install writes: skill files only, or also `MEMORY.md`,
   `SOUL.md`, shell profiles, or hooks? Reject writes outside the skills
   directory unless you understand each one.
4. Check every external URL the skill references (this repo's are live-checked
   by `scripts/rot-check.mjs`; dead or hijacked domains are a takeover signal).
5. Pin what you install. `npx skills add CodeWithJuber/wisdomlens` installs
   from git HEAD; for a frozen copy, install a specific commit or tag.
6. Re-read on update. There is no silent-update mechanism in this repo; when
   you update, diff the new version against your installed copy first.

## Update contract

This package will never change agent-visible behavior between versions without
a minor-version bump and a changelog entry. Third-party marketplaces have
auto-update off by default; update explicitly, then diff.

## Reporting

Security issues: open a GitHub issue on this repository. There is no bounty
program; disclosure is credited.
