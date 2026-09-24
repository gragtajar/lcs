---
target: coming-soon article body (src/components/ComingSoonBody.astro)
total_score: 17
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 2
target_identity: "file:/Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/components/ComingSoonBody.astro"
target_fingerprint: "sha256:26073712c0d4ccec4ddcb0dde019fb4dd0146b8cbd5d1f6f089928331b5e58b3"
target_path: /Users/rajatg/Documents/Claude/Projects/civic sense/learncivicsense-website/src/components/ComingSoonBody.astro
timestamp: 2026-09-24T00-53-53Z
slug: src-components-comingsoonbody-astro
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent), synthesised by the parent. Mode: Read (H7 n/a).

## Design Health Score (Assessment A)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Status clear; timing ("Phase 2") opaque |
| 2 | Match system / real world | 2 | Roadmap jargon; phase hard-coded |
| 3 | User control and freedom | 2 | One exit; subtopic crumb is dead text |
| 4 | Consistency and standards | 2 | Card, centred layout, teal-on-amber, "←" glyph match nothing else |
| 5 | Error prevention | 2 | Shared links carry the category blurb |
| 6 | Recognition rather than recall | 1 | No readable alternative shown |
| 7 | Flexibility and efficiency | n/a | Single-action placeholder |
| 8 | Aesthetic and minimalist design | 2 | Two clocks, three status lines, card scaffold, 160px void |
| 9 | Error recovery | 2 | Stub → list with nothing readable → stub loop in two subtopics |
| 10 | Help and documentation | 1 | The explanation is "Phase 2" |
| **Total** | | **17/36 (47%)** | Poor |

## Design specificity verdict
The header is a lesson header, so the stub keeps its seat in the system; below it is the generic empty-state template with zero reading on a site with 198 readable lessons.

## Deterministic scan
0 findings in every mode (static, light/dark × desktop/mobile), overlay clean. Measured outside the rules: "←" renders in Hind Fallback (Arial × 0.9472 = 16.1px; Hind has no U+2190–2193); one link in the article; 938px page on an 800px viewport.

## Priority issues
- [P1] No reading: three sibling situations, none served; two subtopics loop to an empty list.
- [P1] Status stated three times, then "Phase 2" (hard-coded).
- [P2] Breadcrumb unlinks the subtopic crumb and marks it aria-current="page" on every article page.
- [P2] Craft-floor scaffold: card, pill, fallback-font glyph, teal on amber, void.
- [P3] Share metadata: category blurb as description; no og:image; indexable (policy left to the user per ADR-006).

## Persona red flags
Jordan: "Phase 2"; the action styled as a sentence in a box. Riley: the stub/list loop; wrong aria-current; phase hard-coded. Casey: centred two-line link with an orphaned arrow above 160px of nothing.
