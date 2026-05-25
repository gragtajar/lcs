# learncivicsense.in — website

Astro-based static site for the learncivicsense.in launch (2 modules: Traffic + Public Transport).

Built to the spec in [`WEBSITE-BUILD-SPEC.md`](./WEBSITE-BUILD-SPEC.md).

## Quick start

```bash
npm install
npm run dev        # local dev server (http://localhost:4321)
npm run build      # static build -> ./dist (also builds the Pagefind index)
npm run preview    # serve the built site locally
```

## Content source

The site reads its content from the sibling `../learncivicsense-content/` repo
at build time. The path is set in [`src/config.ts`](src/config.ts) as
`CONTENT_REPO_PATH`. There is no copy of the content inside this repo.

The launch lessons currently carry `status: draft` in the content repo
(per spec §17.3). To ship without modifying that repo, this build uses an
`allowlist` publish mode in `src/config.ts` — the six launch lesson IDs are
opted in by id. Flip `PUBLISH_MODE` to `'published'` once the content repo
promotes them.

## Architecture in one screen

| Layer | Where |
|---|---|
| Pages (homepage, category, article, search, about, 404) | `src/pages/` |
| Reusable Astro components | `src/components/` |
| Preact interactivity islands (theme toggle, search overlay, TOC, quiz) | `src/islands/` |
| Layout shell with font preload + theme init | `src/layouts/BaseLayout.astro` |
| Design tokens (palette, type scale, spacing) | `src/styles/tokens.css` |
| Content loader + taxonomy parser | `src/lib/content.ts` |
| Markdown renderer with anchor IDs + TOC | `src/lib/markdown.ts` |
| Tiny i18n helper | `src/lib/i18n.ts` |
| UI strings | `src/i18n/en.json` |
| Build-time config flags | `src/config.ts` |

## Search

Powered by [Pagefind](https://pagefind.app). The build script runs
`pagefind --site dist` after `astro build`, producing a static index under
`dist/pagefind/`. The `SearchOverlay` island loads it on demand from
`/pagefind/pagefind.js`; the `/search` page hosts the default Pagefind UI as
a no-JS-overlay fallback.

In `npm run dev`, Pagefind is NOT generated — the global search overlay will
appear but show no results. Use `npm run build && npm run preview` to try
search locally.

## Self-hosting Hind

The CSS preloads system fonts as the fallback stack. To enable the proper
Hind webfont per spec §7.2, drop subsetted woff2 files into
`public/fonts/` and uncomment the `@font-face` block + `<link rel="preload">`
inside `src/layouts/BaseLayout.astro`.

## Deploy

Cloudflare Pages, with:

- Build command: `npm run build`
- Output dir: `dist`
- The Pages project must also have the sibling `learncivicsense-content` repo
  checked out into the build container — either as a submodule or via a
  pre-build `git clone` step.

## Future hooks (NOT built)

- User accounts / login
- Favorites + reading lists — a placeholder slot lives in
  `src/components/ArticleHeader.astro` (`data-future-favorite`).
- Civic-action toolkit widgets (`toolkit_widgets` frontmatter is ignored at launch).
- Hindi (and the other 6 Indian languages) — routing is locale-aware already.
