# ADR 004: Hind superfamily for typography

**Status:** Accepted
**Date:** 2026-05-25
**Authors:** Rajat Garg

## Context

We need a single typeface that:

1. Looks clean and readable for body text in long-form lessons.
2. Covers Latin (English at launch) and Devanagari (Hindi in Phase 3).
3. Has siblings for the other six Indian scripts (Tamil, Telugu, Malayalam,
   Kannada, Gujarati, Odia) so we don't switch families per locale.
4. Is free and self-hostable (no Google Fonts CDN — extra DNS round-trip
   hurts our 2G budget).
5. Is light enough to subset and ship under our 20-KB-per-script woff2 budget.

## Decision

Use the **Hind** family by Indian Type Foundry. Specifically:

- **Hind** for Latin + Devanagari (launch + Phase 3 Hindi)
- **Hind Madurai** (Tamil), **Hind Guntur** (Telugu), **Hind Kochi**
  (Malayalam), **Hind Vadodara** (Gujarati), **Hind Mysuru** (Kannada) for
  Phase 3+ Indian scripts
- **Noto Sans Oriya** as the fallback for Odia (Hind has no Odia variant)

Self-host woff2 files, subset per script, load via `unicode-range` so the
browser only fetches what it needs for the active locale.

## Alternatives considered

- **System fonts only** (Hind 0 KB): Excellent baseline performance, but
  the family changes per OS, and Devanagari fallbacks are inconsistent
  across Android versions. Rejected for design coherence.
- **Inter** (variable font, free): Beautiful for Latin, lighter for Devanagari
  than most Western families, but the visual rhythm differs between Inter
  Latin and Inter Devanagari. Rejected for the mismatch.
- **Noto Sans family**: Google's universal coverage. Heavier per script
  than Hind variants. Acceptable backup if Hind ever becomes unavailable.
- **Mukta / IBM Plex Sans Devanagari**: Each covers Latin + Devanagari well
  but doesn't extend to other Indian scripts as a coherent family. Hind's
  siblings are the differentiator.

## Consequences

- Single typeface system for all 8 languages, by design from day one.
- Subset woff2 per script means initial English pages load only the Latin
  subset (~15-20 KB regular weight).
- Hind's design rhythm is consistent enough that script-mixing within a
  page (e.g. an English headline with a Devanagari quote) doesn't jar.
- License: free for commercial use. We host the woff2 ourselves; no
  external CDN dependency.
- Currently a **fallback stack** is shipping (`system-ui, ...`) while we
  finalise subsetting. The hooks in `BaseLayout.astro` are ready; drop the
  woff2 files into `/public/fonts/` and uncomment the `@font-face` block
  to ship.

## References

- `WEBSITE-BUILD-SPEC.md` §7.2 (typography spec)
- `src/styles/tokens.css` (font-family variables)
- `src/layouts/BaseLayout.astro` (font-face hook, currently commented)
- [Hind family at Indian Type Foundry](https://www.indiantypefoundry.com/fonts/hind)
