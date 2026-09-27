# ADR 009: Lucide for icons

**Status:** Accepted
**Date:** 2026-09-27
**Authors:** Rajat Garg

## Context

The build spec (`WEBSITE-BUILD-SPEC.md` §7.3) asked for Material Symbols
(Outlined) as a self-hosted SVG subset. What shipped was a hand-drawn set of
about thirty outline paths "in the Material Symbols style" in
`src/components/Icon.astro`, plus copies of the search, sun and moon paths
inside three Preact islands. The drawings drifted from any real set: the X
share icon was drawn as the same crossed lines as the close icon, three of the
fourteen topics showed the fallback book (the map had no entry for the
taxonomy's `language`, `flag` and `globe`), and every new icon meant drawing
one.

The taxonomy in lcs-content already names most category icons in Lucide's
vocabulary (`traffic-cone`, `map-pin`, `shield-check`, `volume-2`, …).

## Decision

Use [Lucide](https://lucide.dev/icons/) (ISC licence) through its official
packages:

- `@lucide/astro` in Astro components. `Icon.astro` is a thin facade over it:
  `<Icon name="chevron-right" />`, where `name` is a Lucide icon name from the
  catalogue in `src/lib/icons.ts`. Icons render to inline SVG at build time, so
  pages ship no icon JavaScript.
- `lucide-preact` in the islands (theme toggle, search overlay and page, quiz),
  imported by name so the bundle carries only the icons used.

Lucide's 2px stroke on its 24px grid is kept (`.icon` in `global.css`).

Lucide removed all brand icons in version 1 and points to Simple Icons for
them, so the share buttons use the brands' own marks from
[Simple Icons](https://simpleicons.org/) (CC0-1.0) for WhatsApp, X and
Telegram. Simple Icons (v16) no longer includes LinkedIn; that mark is
Bootstrap Icons' `linkedin` (MIT). Both live in `BrandIcon.astro`.

## Alternatives considered

- **Material Symbols, as specified:** a real set too, but the taxonomy already
  uses Lucide's names, and Lucide is the set the site's owner chose
  (2026-09-27).
- **Keep drawing our own:** no dependency, but the drift above is what it
  produced.
- **`lucide-static` / an SVG sprite:** one request for all icons, but a sprite
  is fetched even by pages that use two icons, and it cannot be styled per use
  as easily as inline SVG.

## Consequences

- One vocabulary: the icon name in code is the name on lucide.dev.
- Adding an icon is a line in `src/lib/icons.ts` and one import in
  `Icon.astro` (a unit test checks every catalogue name exists in Lucide).
- Taxonomy names that are not Lucide's (`train`, `language`, `explore`) are
  mapped in `src/lib/icons.ts`; a new category with an unknown name falls back
  to `book-open` and fails that test until it is mapped.
- Islands pay a small, per-icon JavaScript cost, checked by `size-limit`.

## References

- `src/components/Icon.astro`, `src/components/BrandIcon.astro`, `src/lib/icons.ts`
- Lucide licence: https://lucide.dev/license
- Lucide v1 notes ("Removed All Brand Icons"): https://lucide.dev/guide/version-1
- Simple Icons disclaimer (brand use): https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
