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
