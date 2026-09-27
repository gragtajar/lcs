---
target: the topics page
total_score: 26
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 0
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/topics.astro"
target_fingerprint: "sha256:3c05babbdfc0a890a54302db4ba22e701a8cc03bb384b47ccdf9f2c1e312186b"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/topics.astro
timestamp: 2026-09-27T18-48-22Z
slug: src-pages-topics-astro
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No position cue on a 10,700px phone page; jumps landed 152px low with no target cue |
| 2 | Match System / Real World | 3 | Plain labels, but the visitors block leaked internal words ("reverse-direction module", "Phase 4") |
| 3 | User Control and Freedom | 3 | Hash jumps keep Back working; no way back to the index after a manual scroll |
| 4 | Consistency and Standards | 2 | Jump index an unstyled flow unlike the homepage's topic rows; "24 lessons" styled like a link but inert; h2 > h1 on phones |
| 5 | Error Prevention | 3 | "Coming soon" labels head off dead ends; 32px jump targets |
| 6 | Recognition Rather Than Recall | 3 | Whole library visible; jump links and topic-name links did not read as links on touch |
| 7 | Flexibility and Efficiency | 3 | Jump index, deep links, "/" search; index used up after the first screen |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained, card-free; three hairlines at topic boundaries; abroad rows wrapping to 3–4 lines |
| 9 | Error Recovery | n/a | Static directory with no inputs or error states |
| 10 | Help and Documentation | 3 | The lede explains the counts; nothing suggests where to start |
| **Total** | | **26/36** | **Good** |

## Design Specificity Verdict

LLM assessment: on-system (4/8 blocks, SubtopicIndex rows, cluster inks and Lucide icons, candid topic descriptions) but a category-generic catalogue shape; the page's own promise (lessons readable today) barely shows.

Deterministic scan: 0 findings. CLI on src/pages/topics.astro and src/components/SubtopicIndex.astro (exit 0, `[]`); 6 headless URL scans (forced light/dark and system theme, 1280 and 390) and 8 injected-overlay runs, all "No anti-patterns found"; positive control on a bad page: 18 findings / 6 rules. No false positives. Headless only: no visible overlay.

## Priority Issues

- [P2] The jump index did not read as navigation and filled the first phone screen (541px, 32px targets). Fix: rows with icon and count; folded behind "Jump to a topic" on phones; visitors entry.
- [P2] Affordances backwards: the coloured "24 lessons" looked like the homepage's browse link but was text, while the real link (the h3) looked like a heading. Fix: make it "Browse all 24 lessons ›".
- [P2] Compact rows broke on long meta ("2 lessons · 4 coming soon" squeezed titles to 3–4 lines; grid rows stretched). Fix: stack that meta; columns that flow independently.
- [P2] The page ended on internal notes (duplicate "For visitors to India", roadmap jargon, clamped mid-word). Fix: reader-facing line, no duplicate heading, a way onward.
- [P3] Jump landings offset twice (scroll-padding-top + scroll-margin-top = 152px). Fix: one offset and a :target cue.

## Persona Red Flags

Casey (one thumb, 360–375px): no subtopic on the first screen; 32px jump targets; index 7,000px up with no way back. Jordan (first-timer): read the jump list as a paragraph; tapped "24 lessons" and nothing happened. Sam (screen reader): 31 labelled regions (each topic twice); jump links in a paragraph with no list semantics; visitors heading announced twice.

## Minor Observations

h2 (33px) larger than h1 (32px) on phones; stats separators 1.27:1; description clamp cut tablets mid-word; "Universal global civic core" reads like an internal name (content; unchanged); category breadcrumbs skip /topics/ (unchanged).

## Questions to Consider

- Is "N lessons" worth repeating 120 times when 118 rows are readable?
- Should the index follow the reader (a sticky strip) instead of being used up at the top?
- Why end the catalogue on the one module with nothing to read? (Now ends on a search.)

## Resolution (same PR)

All five priority issues fixed: index as icon/name/count rows (44px), folded on phones behind "Jump to a topic" and open from 960px, with the visitors entry; "Browse all N lessons ›" link; compact rows without per-row hairlines, stacked when a row counts lessons coming soon, columns flowing independently; visitors block rewritten for readers with no duplicate heading, then a closing "Search all lessons"; a single scroll offset (landing at 76px measured) with a :target rule in the topic's colour. Also: h2 clamps below the h1 on phones, visible separators, clamp only under 560px, topic blocks no longer labelled regions. Detector: 0 findings before the fixes.
