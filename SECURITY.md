# Security

Wisdom Lens is Markdown skills plus a few dependency-free Node scripts.
Installed as skills only (for example `npx skills add`), it is instructions
only. Installed as a Claude Code plugin, it also runs the hooks below
automatically — read them before installing.

## What runs automatically (Claude Code plugin only)

| Component | When | What it does | Network | Writes |
| --- | --- | --- | --- | --- |
| `scripts/session-context.mjs` | session start, `/clear`, compaction | adds ~1.6k characters of checklist text to context | none | nothing |
| `scripts/tripwire-check.mjs --hook` | before every tool call | reads the tool name and the full tool input (file contents, commands) from stdin, hashes them, and compares the hash with the previous calls; blocks the 3rd and any later identical call in a row | none | `<plugin data dir>/tripwire/<session>.log` (one per subagent when the call carries an `agent_id`), one 32-character hash per call, compacted to the last 20 after 200, mode 0600; logs untouched for 7 days are deleted when a new one starts |
| Stop prompt hook (`hooks/hooks.json`) | end of every turn | sends the hook input, including your last reply, to Claude Code's own model to judge it | Claude Code's existing model connection | nothing |
| `skills/decision-engine/scripts/jev-decide.mjs` / `jev-adapter.mjs` | only when you run them | typed scoring; never executes the recommendation | one POST to `https://api.typesafe.ai`, retried up to 2 times on 429/5xx | nothing |

Both command hooks fail open. The tripwire exits 0 and lets the call through
on a malformed payload or any state error; the session-context hook reads no
input and writes nothing, and if it fails the session starts without the
checklist. The tripwire log holds one-way hashes, never raw tool inputs. Its
directory is created with mode 0700; when the hook runs outside Claude Code
(for example the README demo), it uses `wisdom-lens-<uid>/tripwire/` in the system temp
directory instead of the plugin data directory, and keeps no state (allowing
the call) if that folder is a symlink or belongs to another user. To turn the
session checklist or the tripwire off, see
[Turning hooks off](README.md#turning-hooks-off).

## Threat model

**Supply chain:** no dependencies and no install scripts, so dependency
hijacking and install-time code execution have no path. The hooks above do
run code every session and tool call; a tampered release could change them,
so pin and diff (below).

**What can still happen (honest scope):**

1. **Prompt-injection via skill text.** Skill files are instructions to your
   agent. A tampered SKILL.md could instruct your agent to do things the author
   never intended. Alongside the hook scripts, this is the real attack surface.
2. **Persistent memory writes.** Some install flows let a skill bundle write to
   `MEMORY.md`, `SOUL.md`, or agent config files. Those writes persist across
   sessions and are a known persistence vector (see ClawHavoc, Jan 2026).
3. **Silent update drift.** A skill that is clean today can turn hostile
   tomorrow if updates are unsigned and unpinned.

## Install-trust checklist (before installing any third-party skill)

1. Read the 3 SKILL.md files, `hooks/hooks.json`, and the two scripts it runs.
   The pack is kept small so that this review is practical.
2. Search for imperative install steps: any "Prerequisites: run this command"
   is the ClawHavoc signature — do not run it.
3. Check what the install writes: skill files only, or also `MEMORY.md`,
   `SOUL.md`, shell profiles, or hooks? Reject writes outside the skills
   directory unless you understand each one. This pack writes only the
   tripwire's hashed log, under the plugin data directory.
4. Check every external URL the skill references (this repo's are live-checked
   by `scripts/rot-check.mjs`; dead or hijacked domains are a takeover signal).
5. Pin what you install. `npx skills add CodeWithJuber/wisdomlens` installs
   from git HEAD; for a frozen copy, install a specific commit or release tag.
6. Re-read on update. There is no silent-update mechanism in this repo; when
   you update, diff the new version against your installed copy first.

## Update contract

This package will never change agent-visible behavior between versions without
a minor-version bump and a changelog entry. Third-party marketplaces have
auto-update off by default; update explicitly, then diff.

## Reporting

Report security issues privately at
https://github.com/CodeWithJuber/wisdomlens/security/advisories/new (GitHub
private vulnerability reporting). Please do not open a public issue for a
security problem. There is no bounty program; disclosure is credited.
