---
target: About, Privacy and Terms (InfoLayout)
total_score: 23
max_score: 32
na_heuristics: 5,9
p0_count: 0
p1_count: 0
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/layouts/InfoLayout.astro"
target_fingerprint: "sha256:683a93c75bc6f6298478933549d8a8226e38ea1da08a33b02e9e7894170e4894"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/layouts/InfoLayout.astro
timestamp: 2026-09-29T09-52-52Z
slug: src-layouts-infolayout-astro
closed: true
---
Method: dual-agent (A: design review · B: detector and browser evidence), run independently.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Arriving at /privacy/#feedback is not marked |
| 2 | Match System / Real World | 3 | Plain words; Privacy lets in "keyed hash", cookie ids (explained) |
| 3 | User Control and Freedom | 3 | Breadcrumb + footer; Terms ends with no way on |
| 4 | Consistency and Standards | 3 | Visually consistent; two different "Who this is for" texts |
| 5 | Error Prevention | n/a | No inputs on these pages |
| 6 | Recognition Rather Than Recall | 3 | Contact asks readers to remember "Report something" |
| 7 | Flexibility and Efficiency | 2 | Only #feedback is linkable |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; About repeats its tagline |
| 9 | Error Recovery | n/a | No error states |
| 10 | Help and Documentation | 3 | The pages are the site's help; feedback form offered |
| **Total** | | **23/32** | |

## Design Specificity Verdict
Consistent with the site (the /topics/ header, the 4/8 side-heading grid, hairline rows, 18px reading text), holding at 1280/960/375 in light and dark. Plainness suits Privacy and Terms; About misses the product's own materials (topic colours, lessons).
Deterministic scan: CLI exit 0, 0 findings on the 5 files (a positive control produced 5). Browser, 12 runs: light clean; dark shows 2x `gpt-thin-border-wide-shadow` on the top bar's closed menus (TopBar.astro .topbar-menu: 1px border + dark --elevation-2 16px blur), not on these pages.

## Priority Issues
- [P2] Links barely underlined: teal 40% underline = 1.85:1 (light) / 2.25:1 (dark) against the page; link colour vs body text 2.84:1 / 1.95:1. Fix: 70% (3.2:1 / 4.3:1), 100% on hover; same in `.article-body a` (35%). (/impeccable polish)
- [P2] About reads like a legal page: four one-paragraph bands, none of the library's material. Fix: "Start with one lesson" rows (resolveHeroChips, topic-coloured, as on 404); facts in /topics/ order. (/impeccable bolder)
- [P2] Two answers to "Who this is for": About (adults, students, travellers, NRIs) vs the homepage MissionSection ("for everyone", not a national trait). Needs the owner's decision. (/impeccable clarify)
- [P2] Privacy's first screen says "no cookies of its own"; GoDaddy's three cookies appear ~800px later. Needs the owner's approval of new words. (/impeccable clarify)
- [P3] Only #feedback has an address; arrival is not marked. Fix: ids from headings, `.info-section:target` 2px rule as /topics/. (/impeccable polish)

## Persona Red Flags
Jordan (first-timer): About's way on leads to the full 198-lesson list; "NRIs" unexplained; nothing says who runs the site.
Sam (screen reader): weak link cue; facts line read as "198 lessons 14 topics" without a pause.
Riley (stress tester): "no cookies of its own" vs GoDaddy's three; two "Who this is for" texts; "no quizzes with grades" vs the quiz's "{correct} of {total} right".

## Minor Observations
Privacy's bold lead-ins vary (boundary-only fix). Terms uses straight quotes. The 18px reading size is hard-coded twice (token). Wording items left for the owner: "license" spelling, Terms' thin meta description, "NRIs". Dark-mode menu border duplicates the dark elevation ring.

## Questions to Consider
- Why does About name no person behind the site?
- Should About share Terms' template, or only its header and hairlines?
- What if Privacy's first screen gave the whole answer in three lines, the rest being the proof?
