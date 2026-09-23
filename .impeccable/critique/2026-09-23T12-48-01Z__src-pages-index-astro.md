---
target: homepage (src/pages/index.astro)
total_score: 22
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 3
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/index.astro"
target_fingerprint: "sha256:ac7322733bb3236e8d23ef0aafaa6f91a49296f07ab6158051d91743477288fd"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/index.astro
timestamp: 2026-09-23T12-48-01Z
slug: src-pages-index-astro
closed: true
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent), synthesised by the parent.

## Design Health Score (Assessment A)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Only library-size statement is inside an aria-hidden link and contradicts the "Search 200+ lessons…" placeholder above it |
| 2 | Match system / real world | 3 | SCENARIO / RULE / COMPARISON as unexplained uppercase kickers; "Multilingual" with no language control |
| 3 | User control and freedom | 3 | On mobile the only way past 5,210px of cards is scrolling |
| 4 | Consistency and standards | 2 | Two search entries; kicker-above-title vs meta-below on the list page; dates here, removed there; nested cards vs hairline rows |
| 5 | Error prevention | 3 | Empty hero submit lands on an empty results page |
| 6 | Recognition rather than recall | 2 | 6 of 11 topics + 3 abroad packs reachable only via one 17px link at 3,077px / 6,066px; cluster names not links |
| 7 | Flexibility and efficiency | 3 | `/` opens the overlay; chips are shortcuts |
| 8 | Aesthetic and minimalist design | 2 | Two search boxes; 20 bordered boxes (15 nested); 15 date stamps; 15 truncated excerpts; 7,142px mobile page |
| 9 | Error recovery | n/a | No failable action on this surface |
| 10 | Help and documentation | 2 | Orientation copy is the last section |
| **Total** | | **22/36 (61%)** | Acceptable |

## Design specificity verdict
Words authored (h1, chip labels, cluster descriptions); composition is the interchangeable knowledge-base landing template (centred hero → tagline → search → pills → scroll cue → five identical cards nesting three cards each → centred link → prose). The homepage still speaks the visual language the article/list pages abandoned this week.

## Deterministic scan (own baseline + Assessment B, identical)
Real browser light/dark desktop 0, 1024px 0; light/dark mobile 2× body-text-viewport-edge (`.hero-subhead`, `.hero-body`; cause: `.hero` 8px inline padding). Static 1× tight-leading (false positive: `.hero-chip` line-height 1.3 on the threshold). Overlay injection succeeded (desktop clean, mobile the same two); live server stopped. Not detector rules but deterministic: the scroll-cue pulse never runs (scoped selector never matches the unscoped `<Icon>` SVG, which renders at 16.25px); typed "→" falls to Arial (U+2192 outside Hind's unicode-range).

## Priority issues
- [P1] Featured section is the refused scaffold: five same-size cards nesting three bordered cards (20 boxes, 15 nested; 971–1,070px each on mobile).
- [P1] Two competing search entries above the fold; "200+" vs "198"; empty submit to an empty page; the solid button steals primary weight from the chips.
- [P1] Index function fails: 6 of 11 topics and the 3 abroad packs unreachable without a 3,000–6,000px scroll; cluster h3s not links.
- [P2] Hero spends the whole first viewport (599px / 739px), dead-centre stack, 8px gutter, dead scroll cue.
- [P2] Previews contradict the lesson-row grammar: uppercase kicker above title, date stamps, 3-line "…" clamps, ~250-char link names, fallback-font arrows, 24px browse links.

## Persona red flags
Jordan: two search boxes; "Multilingual" with no switch; "RULE" read as law; cluster name not clickable; traffic not featured and the index 3,077px down. Riley: 200+ vs 198; empty submit; animation that never runs; size statement hidden from AT. Casey: hero fills the first viewport with no lesson; 5,210px of cards; reassurance at 6,957px; 8px gutter; 35/38px topbar targets (TopBar out of scope).

## Minor observations
Previews on `--color-bg` inside a `--color-surface` card; alternating centred/left alignment; descriptions duplicate the mission's register; "198 lessons" includes abroad packs while "11 topics" excludes them; inconsistent link tap sizes.
