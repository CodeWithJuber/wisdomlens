# Changelog — new-lens

## [1.0.1] — 2026-10-15

### Fixed
- Chapter 1: the tripwire is no longer described as running everywhere. A pre-tool-call hook enforces it only in the Claude Code plugin and only for exact repeats; on other hosts, and for varied retries, the agent must notice the loop itself.
- Chapter 6: removed the claim that a lint script checks deliverables (no such script exists). Nothing checks the `[known]/[inferred]/[guessed]` tags automatically.
- Chapter 8: the $500+ edit is now marked as a single reported case, tagged `[guessed — illustrative anecdote]`.
- Chapter 9: "every model" degrades with input length is now "all 18 frontier models Chroma tested", cited `[S6]`. `references/ai-failure-diagnostics.md` Diagnostic 5 says the same instead of "100% of them".
- Chapter 11: the unsourced "half" share of machine-made web text is now "a large and growing share of new web text", tagged `[inferred]`.
- Chapter 13: dropped the duplicate $500 anecdote and the unsourced "budgets burned by April"; the line now states the design point, tagged `[inferred]`.
- The pointer to the `references/` directory now names each reference file and when to read it.
- `references/ai-failure-diagnostics.md` S8: the deskilling study's first author is Budzyń, not Romańczyk; the source entry now gives the full title, journal citation and DOI, and has one `reverify-by` line instead of two.
- The 1.0.0 "Stat citation pinning" entry overstated what each citation carries; corrected below.

## [1.0.0] — 2026-10-12

Initial public release of the skill as a standalone pack.

### Added
- 16 chapters mapping AI-age failure modes across four parts: machine failures (doom loops, blind judgment, sycophancy, slop, black-box, memory), workflow failures, relationship failures, and the human's answer.
- The One-Page AI-Age Operating System (distilled reference).
- `references/anchors.md`: one-line memorable principles per chapter.
- `references/field-practices.md`: concrete actionable moves by topic.
- `references/ai-failure-diagnostics.md`: quick-reference diagnostic trees with dated source citations (S1–S8, each with `reverify-by`).
- Chapter 16 cross-reference cleanup (builder-protocol's 12 rules compressed to one-liners with pointer).
- `## When NOT to Use` section.
- `last_verified` frontmatter field and `reverify-by` dates (rot-check support).
- `license: MIT` frontmatter.
- Stat citation pinning: every cited number carries a title, a URL/DOI/arXiv ID where available, and a reverify-by date.
