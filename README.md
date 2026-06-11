# learncivicsense.in — website

A free, fast, multilingual reading library for civic sense in India.
Built with Astro, Pagefind, and a tiny set of Preact islands.

[![CI](https://github.com/gragtajar/lcs/actions/workflows/ci.yml/badge.svg)](https://github.com/gragtajar/lcs/actions/workflows/ci.yml)
[![E2E](https://github.com/gragtajar/lcs/actions/workflows/e2e.yml/badge.svg)](https://github.com/gragtajar/lcs/actions/workflows/e2e.yml)
[![Perf](https://github.com/gragtajar/lcs/actions/workflows/perf.yml/badge.svg)](https://github.com/gragtajar/lcs/actions/workflows/perf.yml)

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

## Cloudflare setup (Item 1)

The site is parameterised on Cloudflare env vars (see `.env.example`). The build
succeeds with none of them set — images fall back to a bundled placeholder.

**What you do in the Cloudflare dashboard:**

1. Create a Cloudflare account and add the `learncivicsense.in` zone.
2. Migrate nameservers at your registrar; wait for zone activation (5 min–24 h).
3. Subscribe to Cloudflare Images (~$5/mo, 100K transformations).
4. Create R2 bucket `learncivicsense-images` (public access **via Cloudflare Images only**).
5. In Images → Variants create: `thumbnail` (200×200, cover, q80), `card`
   (600×338 16:9, cover, q80), `hero` (1200×675 16:9, cover, q85), `og`
   (1200×630, cover, q85).
6. Create scoped API tokens: `CLOUDFLARE_API_TOKEN` (Account:Read + Zone:Read),
   `CLOUDFLARE_IMAGES_API_TOKEN` (Images:Edit).
7. Copy the account hash + tokens into `.env.local` (and into CI secrets). The
   browser-facing var is `PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH`.

`src/lib/cloudflare.ts` reads these and builds delivery URLs; it never calls the
API at build time and never throws on missing env.

## Amplitude setup (Item 2)

Product analytics is env-gated and privacy-first (`src/lib/analytics.ts`):

- Set `PUBLIC_AMPLITUDE_API_KEY` (from the Amplitude project) in `.env.local` / CI.
- When the key is absent **or** the browser sends Do-Not-Track, Amplitude is
  never initialised (zero analytics JS executes).
- `defaultTracking` is off; we opt into a single, query-stripped page view plus
  named events (`article-read`, `quiz-attempt`, `quiz-correct`,
  `related-link-click`, `search-query`, `language-switch`). No PII is ever sent.
- Do **not** enable session replay / Experiment without owner sign-off.

## Image pipeline (Item 5)

Originals live in Cloudflare R2 at `articles/<lesson-id>/hero.png`; Cloudflare
Images serves named variants. The website renders `<img>`/`srcset` pointing at
delivery URLs (`src/components/ArticleHero.astro`, `src/lib/images.ts`). With no
Cloudflare env, every image falls back to `public/placeholders/default-article.svg`.

**Upload workflow (per article):** generate a hero image, save as PNG/JPEG,
upload to R2 at `articles/<lesson-id>/hero.png`. The site serves it on the next
deploy. See `learncivicsense-content/IMAGES-README.md` for the full checklist.

> Note: this supersedes the addendum T10 local-`<Picture>`/sharp approach — the
> 2026-06-11 brief chose Cloudflare R2 + Images (remote delivery), so there is
> no build-time sharp/LQIP step and no local source images in this repo.

## Where to read next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system shape, data flow, tech stack
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev workflow, branching, commit conventions
- [`docs/adrs/`](./docs/adrs/) — architecture decision records
- [`docs/runbooks/`](./docs/runbooks/) — branch protection, observability setup, rollback
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
| `npm run lhci`          | Lighthouse CI desktop preset             |
| `npm run size`          | size-limit budget check                  |

## License

Source: MIT (see `LICENSE` once added).
Content: CC BY-SA 4.0 (see `/terms` page on the live site).
