---
target: article page (src/pages/[category]/[subcategory]/[article].astro)
total_score: 26
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: 'file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/[category]/[subcategory]/[article].astro'
target_fingerprint: 'sha256:2e78a4a57d22d9ebb15bbeb5e05e25bacfb6388b3e406ef67087a935be09dcd8'
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/[category]/[subcategory]/[article].astro
timestamp: 2026-09-23T07-18-23Z
slug: src-pages-category-subcategory-article-astro
---

Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent), synthesised by the parent.

## Design Health Score (Assessment A)

| #         | Heuristic                       | Score     | Key issue                                                                                                       |
| --------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of system status     | 2         | TOC marker lags 1–2 sections; Share toggle flips aria-expanded with no visible change; no quiz completion state |
| 2         | Match system / real world       | 3         | Meta row leads with editorial taxonomy; "v1.0" unexplained; US-style dates                                      |
| 3         | User control and freedom        | 3         | No next lesson; Share toggle cannot collapse anything                                                           |
| 4         | Consistency and standards       | 2         | One h2 level rendered three ways; amber means four things; cluster colour absent on the article; `hidden` inert |
| 5         | Error prevention                | 3         | —                                                                                                               |
| 6         | Recognition rather than recall  | 3         | 13 icon-only share buttons; mobile Contents with no chevron                                                     |
| 7         | Flexibility and efficiency      | 2         | No next-lesson path; TOC omits Quick check                                                                      |
| 8         | Aesthetic and minimalist design | 2         | First sentence at 1126px behind a 428px placeholder and 7 share controls; 345px dead strip beside prose         |
| 9         | Error recovery                  | 3         | Copy-link failure silent                                                                                        |
| 10        | Help and documentation          | 3         | —                                                                                                               |
| **Total** |                                 | **26/40** | Acceptable                                                                                                      |

## Design specificity verdict

Editorial layer authored for the product (five-beat scenario skeleton, local copy); the template around it is category-interchangeable, made worse by the placeholder hero on 194/198 pages and by the article being the one surface that ignores the 14 cluster accents.

## Deterministic scan (Assessment B)

Static: 7 (5× monotonous-spacing — tokenisation artefact; 1× cramped-padding table-wrap — real; 1× aphoristic-cadence — editorial copy). Real browser desktop and mobile: 1 (table-wrap). In-page overlay at 1024px: first-viewport-column-overflow (sticky TOC beside a long column; by design).

## Priority issues

- [P1] `hidden` attribute inert site-wide (ShareBar `display:flex` beats the UA rule): 7 share controls always visible at the top; dead native button at the bottom.
- [P1] Placeholder hero spends the fold on a "coming soon" clock on 194/198 pages; bright panel in dark mode.
- [P2] Article drops the cluster wayfinding colour.
- [P2] The lesson has no ending (no quiz result, no next lesson, page ends on a toolbar).
- [P2] Comparison tables clip the third column on phones with no cue.

## Persona red flags

Casey (mobile): first sentence 1262–1641px down; 104px share block; table column 3 unreachable. Sam (screen reader): every heading announces as a link; quiz feedback not announced; Share expanded state is false. Riley (stress): silent copy failure; TOC desync; dead native button.

## Minor observations

US date format; version stamp; format chip leads the meta row; TOC omits Quick check; three names for one share action; uppercase "SELECT AN ANSWER." hint; sources/related h2s at 15px caps.
