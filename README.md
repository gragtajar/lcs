# Learn Civic Sense — website

A free reading library for civic sense in India, live at https://learncivicsense.in.
Built with Astro, Pagefind, and a tiny set of Preact islands.

[![Deploy production](https://github.com/gragtajar/lcs/actions/workflows/deploy.yml/badge.svg)](https://github.com/gragtajar/lcs/actions/workflows/deploy.yml)
[![CI](https://github.com/gragtajar/lcs/actions/workflows/ci.yml/badge.svg)](https://github.com/gragtajar/lcs/actions/workflows/ci.yml)

## Quick start

```bash
npm install --legacy-peer-deps    # uses Node 20 — see .nvmrc
npm run dev                       # http://localhost:4321
npm run build                     # static build to ./dist + Pagefind index
npm run preview                   # serve the built site at :4321
```

Search and JSON-LD only render against the production build (`npm run build` then
`npm run preview`). The dev server skips the Pagefind index step.

## What's in this repo

- **Pages, components, layouts** in `src/`
- **Design tokens** (palette, type scale, spacing) in `src/styles/tokens.css`
- **Content** is read from the sibling `../learncivicsense-content/` repo at build time
- **Pagefind** indexes every article (real + coming-soon stubs) post-build
- **All Phase-1 production hardening** wired up: TypeScript strict, ESLint,
  Prettier, Stylelint, husky pre-commit + pre-push hooks, Vitest unit tests
  (44 specs / ≥80% coverage), Playwright smoke suite (12 specs × 2 devices),
  Lighthouse CI (desktop + mobile), size-limit budgets, Cloudflare Web
  Analytics + Sentry (env-gated), sitemap, JSON-LD, OG/Twitter meta

## Deployment

Production is `https://learncivicsense.in` on GoDaddy cPanel hosting
([ADR 008](./docs/adrs/008-godaddy-cpanel-hosting.md)). Every merge to `main`,
and every content change in `lcs-content` / `lcs-workflow`, runs the full CI,
uploads the tested build over FTPS, and verifies the live site: every file byte
for byte, redirects, headers, and a browser pass on desktop and mobile in light
and dark. See [`docs/runbooks/deploy.md`](./docs/runbooks/deploy.md);
`/build-info.json` shows what is live.

## Amplitude setup (Item 2)

Product analytics is env-gated and privacy-first (`src/lib/analytics.ts`):

- Set `PUBLIC_AMPLITUDE_API_KEY` (from the Amplitude project) in `.env.local` / CI.
- When the key is absent **or** the browser sends Do-Not-Track, Amplitude is
  never initialised (zero analytics JS executes).
- `defaultTracking` is off; we opt into a single, query-stripped page view plus
  named events (`article-read`, `quiz-attempt`, `quiz-correct`,
  `related-link-click`, `search-query`, `language-switch`). No PII is ever sent.
- Do **not** enable session replay / Experiment without owner sign-off.

## Images (ImageKit)

Lesson illustrations are served by ImageKit (`https://ik.imagekit.io/civic`):
one high-resolution source per lesson, named after the lesson id
(`sacred-004.png`), and every size is a URL transformation
(`src/lib/imagekit.ts`, `src/lib/images.ts`). To add one, upload it to the
ImageKit Media Library, then deploy (any merge to `main`, or **Deploy
production** from the Actions tab; uploads alone do not start one): the build
lists the library
(`scripts/sync-imagekit-registry.mjs`, with the `IMAGEKIT_PRIVATE_KEY` CI
secret) and the lesson shows it. Without the key the committed
`src/data/article-images.json` is used.

| Where                                                   | Shown at                        | Served                   |
| ------------------------------------------------------- | ------------------------------- | ------------------------ |
| Lesson page hero                                        | reading column                  | `srcset` 400–1600w, auto |
| Row thumbnail: lesson lists, homepage lead, search page | up to 240px, 16:9, on the right | 320w (1x), 640w (2x)     |
| Social card (`og:image`)                                | 1200×630                        | JPEG, q80                |

A lesson without an illustration shows no image slot. Its social card falls
back to `public/placeholders/default-article.svg`.

## Where to read next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system shape, data flow, tech stack
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev workflow, branching, commit conventions
- [`docs/adrs/`](./docs/adrs/) — architecture decision records
- [`docs/runbooks/`](./docs/runbooks/) — deploy, rollback, branch protection, observability setup
- [`WEBSITE-BUILD-SPEC.md`](./WEBSITE-BUILD-SPEC.md) — original v1 spec (what we built)
- [`WEBSITE-BUILD-SPEC-v2-ADDENDUM.md`](./WEBSITE-BUILD-SPEC-v2-ADDENDUM.md) — v2 volumetric nav
- [`PRODUCTION-READINESS-SPEC.md`](./PRODUCTION-READINESS-SPEC.md) — the Phase 1 hardening plan

## Scripts

| Command                 | What it does                             |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Astro dev server, HMR, no Pagefind index |
| `npm run build`         | Static build to `dist/` + Pagefind index |
| `npm run preview`       | Serve the production build locally       |
| `npm run lint`          | ESLint (zero-warnings gate)              |
| `npm run format:check`  | Prettier check (CI) / `format` to fix    |
| `npm run stylelint`     | Stylelint over `src/styles/**/*.css`     |
| `npm run typecheck`     | `astro sync && tsc --noEmit`             |
| `npm run test`          | Vitest unit tests                        |
| `npm run test:coverage` | Vitest + coverage with thresholds        |
| `npm run test:e2e`      | Playwright (auto-starts `preview`)       |
| `npm run test:prod`     | Playwright against the live site         |
| `npm run verify:deploy` | Live site vs `dist/`, byte for byte      |
| `npm run lhci`          | Lighthouse CI desktop preset             |
| `npm run size`          | size-limit budget check                  |

## License

Source: MIT (see `LICENSE` once added).
Content: CC BY-SA 4.0 (see `/terms` page on the live site).
