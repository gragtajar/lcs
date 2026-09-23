---
target: search page (src/pages/search.astro)
total_score: 14
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/search.astro"
target_fingerprint: "sha256:0c6666937f9d062504e209cfca9608fb70700996fecf1597b2e217e15bc7f3db"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/search.astro
timestamp: 2026-09-23T19-35-47Z
slug: src-pages-search-astro
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent), synthesised by the parent. Mode: Operate (all ten heuristics scored).

## Design Health Score (Assessment A)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 1 | Typed query invisible under OS dark (UA FieldText on Pagefind's forced white input); count never announced; `?q=` never updated |
| 2 | Match system / real world | 1 | Raw meta keys as pills ("Cluster:", "Subtopic:", "Status: coming-soon"); roadmap text in excerpts |
| 3 | User control and freedom | 2 | Refresh/back/share lose the typed query; `/` opens the overlay over the page |
| 4 | Consistency and standards | 1 | Two search UIs: fonts, rows, chips, sort, placeholders all differ |
| 5 | Error prevention | 2 | Stubs look like lessons |
| 6 | Recognition rather than recall | 1 | Empty state offers nothing to recognise |
| 7 | Flexibility and efficiency | 2 | Deep link works; no arrow keys; `/` routes elsewhere |
| 8 | Aesthetic and minimalist design | 1 | 157px rows, dead pills, #ffff00 marks |
| 9 | Error recovery | 2 | "No results" then 396px of nothing; zero links |
| 10 | Help and documentation | 1 | One sentence, no examples |
| **Total** | | **14/40 (35%)** | Poor |

## Design specificity verdict
Two products stapled together: authored chrome above `#search-root`, Pagefind's catalogue default below it (system font at 0.8 scale, #393939 text, #eeeeee rules, yellow marks, "Key: value" pills). Both assessments: replace the vendor UI layer, keep the engine.

## Deterministic scan (own baseline + Assessment B, 17 runs, identical)
Static 0 (blind to the client-mounted UI). Empty state 0 in all four theme/viewport combos. Query states: light desktop 4× line-length (excerpts 86–109 chars/line at 12.8px in 696px); dark desktop 10 (+6× low-contrast #393939 on #171613 = 1.57:1); dark mobile 6; dark no-results 1. Overlay injection succeeded (desktop 4, empty 0, mobile 0). Measured, outside the rules: input text white-on-white whenever the browser prefers dark; UA yellow `<mark>`; Arial input, system results, Hind h1.

## Priority issues
- [P0] Vendor block not wired to the theme: `color-scheme: light dark` meta lets the UA colour the input by OS; site-dark results at 1.57:1.
- [P1] Index includes chrome (breadcrumb, header meta, share bars, related links, coming-soon body) so every excerpt is debris.
- [P1] Two result designs; 134 KB of vendor UI renders a worse row than the overlay's 3.4 KB island.
- [P1] Empty and no-results states are dead ends; nothing links to /search/.
- [P2] Invisible focus stop on "Clear"; count not announced; `/` opens the overlay over the page; 38px/35px targets.

## Persona red flags
Sam: invisible focus stop, unannounced count, 1.57:1 titles, stubs by position only. Riley: URL keeps the old query; "no-JS fallback" claim is false; concatenated related-links text in excerpts. Casey: field not focused; two results per screen; nothing tappable without typing.

## Minor observations
Three names for one page (title/h1/placeholders); trailing space in tags; `excerptLength: 18` only guarantees meta today; merging /search/ with /topics/ is an open IA question for the user.
