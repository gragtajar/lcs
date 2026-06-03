# ADR 006: Coming-soon article stubs from taxonomy

**Status:** Accepted
**Date:** 2026-06-02
**Authors:** Rajat Garg

## Context

The v2 addendum to the build spec introduced the "volumetric navigation"
requirement: every planned article in `taxonomy.json` (all 211 of them)
should have a working URL, regardless of whether the lesson has been
written yet. Articles without a backing `.md` file should render as
clearly-marked placeholders, not 404s.

The choices were:

1. Generate a "real" `.md` stub for every unwritten article at content-prep
   time, then render normally.
2. Detect at build time whether each planned article has a backing file
   and render either the real body or a placeholder variant of the
   article-page template.

## Decision

Approach **2**. At build time, `src/lib/content.ts` scans each category's
`lessons/` directory once, builds an `id → file path` index, and checks
whether each planned article in the taxonomy has a backing file with
`status: published` (or appears in `LAUNCH_LESSON_IDS` for the 6 draft
launch lessons).

The article template (`src/pages/[category]/[subcategory]/[article].astro`)
takes one of two render paths based on this flag. The header layout is
identical between variants; the body differs:

- **Real article:** header + TL;DR + rendered markdown body + quiz (if any)
  - sources + related links + scroll-spy TOC.
- **Coming-soon:** same header (with an outlined format chip + "Coming soon"
  badge instead of date/reading-time) + a calm amber placeholder card
  pointing back to the subcategory. No TOC, no quiz, no sources, no related.

Pagefind indexes both variants. Coming-soon results get a `status:coming-soon`
meta tag and a "Coming soon" chip in the search overlay; they sort below
published results.

## Alternatives considered

- **Generate stub `.md` files at content-prep time:** Requires a script
  - a maintenance burden. Stubs would need to be re-generated whenever
    taxonomy changes. Also bloats the content repo with placeholder content
    that nobody reads. Rejected.
- **404 the unwritten article URLs:** Removes the "show me the whole
  scope at a glance" value of volumetric navigation. The category-page
  article list also wouldn't be able to show comprehensive counts.
  Rejected on the v2 spec.
- **Treat coming-soon as a separate route prefix** (e.g. `/coming-soon/...`):
  Breaks URL stability — a lesson going from coming-soon to published would
  need an HTTP redirect. Coming-soon-vs-real should be a body-rendering
  detail, not a routing detail. Rejected.

## Consequences

- The build generates ~350 routes (15 category landings + 130 subcategory
  pages + 211 articles + a few static), all static HTML. Build time
  remains under 2 seconds.
- The content repo doesn't need stub files; planned articles live only in
  `taxonomy.json` until they're written.
- The "flip a lesson live" workflow is now trivial: drop a real `.md`
  with `status: published` at the right path, rebuild, the route's body
  changes from placeholder to real. The URL doesn't change. SEO doesn't
  thrash.
- Pagefind indexes coming-soon stubs (just their titles, since they have
  no body), so search finds upcoming lessons too — with the "Coming soon"
  chip making the status obvious.
- The file-existence check tolerates short filenames. The taxonomy slug
  for `queue-001` is `the-gate-rush-and-why-the-plane-will-not-leave-without-you`
  but the actual file on disk is `queue-001-the-gate-rush.en.md`. We match
  by `{prefix}-{NNN}` (the stable id), not by the full slug, so neither
  side has to mirror the other.

## References

- `WEBSITE-BUILD-SPEC-v2-ADDENDUM.md` §2 (the spec for this)
- `learncivicsense-workflow/REBUILD-INSTRUCTIONS.md` (the publish workflow)
- `learncivicsense-workflow/PUBLISH-MANIFEST.json` (the publish queue)
- `src/lib/content.ts::isArticlePublished` (the detection)
- `src/components/ComingSoonBody.astro` (the placeholder card)
- `src/pages/[category]/[subcategory]/[article].astro` (the two-path template)
