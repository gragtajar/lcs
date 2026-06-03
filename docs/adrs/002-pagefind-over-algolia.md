# ADR 002: Pagefind over Algolia / Elasticsearch

**Status:** Accepted
**Date:** 2026-05-25
**Authors:** Rajat Garg

## Context

The site has a hard global-search requirement (search overlay from the top
bar, results as-you-type, indexes article titles + body + taxonomy). At
launch the catalog is ~211 lessons; at Phase-3 scale it grows to ~1,700
across 8 languages.

The build is static. We have no server, no database, no API. Adding a
running search service for ~200 articles would be infrastructure tax for
zero functional benefit.

## Decision

Use **Pagefind**. The build script runs `pagefind --site dist` after
`astro build`, producing a static search index under `dist/pagefind/`. The
client downloads chunks of the index on demand (only when the user opens
search), and queries are answered entirely in the browser.

## Alternatives considered

- **Algolia:** Excellent search UX, but: free tier limits, vendor lock-in
  on a paid product, network round-trip per query, requires API key
  rotation. Right for sites with personalization, sponsored results, or
  > 100K records. Overkill for us.
- **Elasticsearch (self-hosted):** Requires a running server, security
  patching, scaling. Inversely correlated with our "free tier, no infra"
  constraint. Rejected.
- **MeiliSearch / Typesense:** Same shape as Elasticsearch (running server),
  smaller, simpler — but still infra we don't need.
- **Naive JS text search (Fuse.js etc.):** Works for tiny catalogs but
  ships the entire corpus to the client. At 211 lessons (~1,300 words
  indexed) the corpus is ~50 KB; at Phase-3 scale it's 400+ KB. Unacceptable
  for our 2G budget.

## Consequences

- Free, fast, no running cost, no infrastructure to patch.
- Search index regenerates on every build (~150ms post-build for the current
  corpus).
- Coming-soon stubs get indexed too (only their titles, since they have no
  body). The search overlay flags them with a "Coming soon" chip.
- For Phase 3 multilingual: Pagefind supports per-locale indices via
  `--root-selector "[data-pagefind-lang='hi']"`; we'll split indices then.
- If catalog ever exceeds ~5K records or we need server-side personalization,
  revisit. Not now.

## References

- `WEBSITE-BUILD-SPEC.md` §13 (search spec)
- `src/islands/SearchOverlay.tsx` (overlay UI + ranking)
- `src/pages/[category]/[subcategory]/[article].astro` (`data-pagefind-meta`)
- [Pagefind docs](https://pagefind.app/)
