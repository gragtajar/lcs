# `src/lib/`

Pure-functional helpers consumed by pages, components, and islands. No JSX
here, no DOM access, no Astro APIs. Just typed functions over inputs.

This is where unit tests live (covered by Vitest in `tests/unit/`). Coverage
threshold is 80% statements / 75% branches; new files here need new tests.

## Inventory

| File          | What it does                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content.ts`  | Loads + parses `taxonomy.json`; resolves the v2 nav tree (clusters + abroad packs + visitors); detects which planned articles are real; URL helpers. |
| `markdown.ts` | Marked-based renderer with anchored h2/h3 headings, scroll-spy TOC extraction, horizontal-scroll table wrapping, inline-only mode, HTML escaping.    |
| `i18n.ts`     | Tiny `t()` with dotted-path lookup, plural variants by `count`, and `{var}` interpolation. Reads `src/i18n/{locale}.json`.                           |
| `seo.ts`      | `buildMeta()` for OG/Twitter/canonical; `articleJsonLd()`, `collectionJsonLd()`, `breadcrumbJsonLd()` for schema.org.                                |
| `icons.ts`    | Maps taxonomy `icon` strings (e.g. `traffic-cone`) to the IconName enum used by the inline SVG sprite.                                               |

## Conventions

- **Pure functions.** No side effects, no globals (except in-memory caches
  that are safe across the build).
- **Strict null safety.** With `noUncheckedIndexedAccess` on, every
  `array[i]` and `record[key]` returns `T | undefined`. Use `?? fallback`,
  not `!`.
- **No `any`.** ESLint blocks it.
- **TSDoc on every exported function.** The next person — including you in
  six months — needs to know why this exists, not just what it does.

## Caches

Two in-memory caches survive across the build:

- `cachedTaxonomy` in `content.ts` — taxonomy.json is read once.
- `lessonFileIndex` in `content.ts` — each category's `lessons/` dir is
  scanned once.

These are correct for a build (process exits after `dist/` is written).
They would be wrong for a long-running server. Don't move this code into
an SSR context without revisiting.

## Adding a new helper

1. Add the file here. Single responsibility — if you're tempted to put
   `seo-helpers.ts` next to `seo.ts`, the helpers probably belong inside
   `seo.ts`.
2. Add a test in `tests/unit/`. Coverage must stay above threshold.
3. If it's used by a page or component, import via the `@lib/*` alias
   (configured in `tsconfig.json` and `vitest.config.ts`).
4. TSDoc on every export.
