---
target: subcategory page (src/pages/[category]/[subcategory]/index.astro)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/[category]/[subcategory]/index.astro"
target_fingerprint: "sha256:e55c84bb958b1afa964b3973214da337d1daa99ddeb7cfed0a3ba1d6393a06c3"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/pages/[category]/[subcategory]/index.astro
timestamp: 2026-09-23T09-58-02Z
slug: src-pages-category-subcategory-index-astro
closed: true
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent), synthesised by the parent.

## Design Health Score (Assessment A)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Active sidebar entry off-screen on load for late categories; counts include unpublished lessons |
| 2 | Match system / real world | 3 | Taxonomy chips with no legend; "Updated" stamp in a picker |
| 3 | User control and freedom | 3 | Drawer returns focus nowhere on close |
| 4 | Consistency and standards | 2 | Nested `<main>`; h1→h3; hover lights a card that is 22% link; placeholder kept where the article dropped it |
| 5 | Error prevention | 3 | Mis-taps on the non-link 78% of each card |
| 6 | Recognition rather than recall | 3 | Nothing to choose by beyond the title |
| 7 | Flexibility and efficiency | 2 | ~27 tab stops before the first lesson |
| 8 | Aesthetic and minimalist design | 2 | 96px empty square per row; category name printed three times |
| 9 | Error recovery | 2 | `.empty` unreachable; all-coming-soon pages get no message |
| 10 | Help and documentation | 2 | Nothing explains formats or timing |
| **Total** | | **25/40** | Acceptable |

## Design specificity verdict
A competent generic docs-sidebar-plus-card-list; only the cluster wayfinding and the two-group sidebar are authored. Rows are the blog-index template with an empty image slot on 207 of 211 rows.

## Deterministic scan (own baseline + Assessment B)
Real browser, light/dark × desktop/mobile: 7 per combination — 5× skipped-heading (h1→h3), 2× all-caps-body (the 43-character uppercase category eyebrow). Static: 84 — 70× cramped-padding (`.sb-sub-list` children flush against its border-left), 7× tight-leading (static-engine approximation on the h1), plus the above.

## Priority issues
- [P1] Row spends its space on an empty square and undifferentiated chips.
- [P1] Hover affordance and hit area disagree (22% of the card is a link).
- [P1] Mobile drawer is not an accessible dialog; close button overlaps the filter; slide never plays; scroll lock survives a resize.
- [P2] Wayfinding tells three things the reader does not need (eyebrow) and hides one they do (active entry off-screen; planned counts).
- [P2] 57 single-lesson pages and 2 all-coming-soon pages end in nothing.

## Persona red flags
Casey (mobile): 44% of the first screen is chrome; taps on the card's lower third do nothing; 600px thumbnails for a 72px slot. Sam (screen reader): two `<main>` landmarks; sidebar before content in DOM; drawer without dialog semantics. Riley: counts promise unpublished lessons; body overflow lock survives rotation.
