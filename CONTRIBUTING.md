# Contributing

How to work on learncivicsense.in. The conventions here are enforced by CI;
the goal is to make the green path the easy path.

## Environment

- Node 20 (pinned in `.nvmrc` — use `nvm use` if you have nvm)
- npm 10+ (ships with Node 20)
- macOS or Linux; Windows works via WSL2 but is unsupported

```bash
nvm use                                   # picks Node from .nvmrc
npm install --legacy-peer-deps            # legacy flag works around an Astro peer-dep quirk
cp .env.example .env                      # optional, only for analytics/Sentry locally
npm run dev                               # http://localhost:4321
```

## Branching model

- `main` is protected. Direct push is blocked.
- Open a short-lived branch per change:
  - `feat/<slug>` — user-visible feature
  - `fix/<slug>` — bug fix
  - `chore/<slug>` — tooling, deps, refactor
  - `docs/<slug>` — documentation only
  - `content/<slug>` — taxonomy or lesson update
- Stack PRs on each other when work is genuinely dependent; otherwise base
  each one on `main` for independent review.

## Pre-commit gates (local)

`husky` installs three hooks automatically on `npm install`:

| Hook         | Runs                                                             | If it fails                                     |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| `pre-commit` | `lint-staged` (eslint --fix + prettier --write on touched files) | commit blocked, files left fixed-where-possible |
| `commit-msg` | `commitlint` against the Conventional Commits spec               | commit blocked, rewrite the message             |
| `pre-push`   | `npm run typecheck`                                              | push blocked                                    |

Bypass only in emergencies (`git commit --no-verify`). CI will catch it.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), sentence-case subject:

```
chore: Add Lighthouse CI thresholds
fix: Resolve hydration mismatch in ThemeToggle
docs: Document branch protection rules
content: Mark queue-001 as published in manifest
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`chore`, `ci`, `build`, `revert`, `content`.

## Code review

Every PR needs at least one approval (you, for now; raise the threshold
once contributors arrive). The PR template walks through the checklist.

Code Owners (in `.github/CODEOWNERS`) are auto-requested on PRs that touch
their paths.

## Adding things

### A new page

1. Add an `.astro` file under `src/pages/`. Use `BaseLayout` so SEO meta and
   the topbar wire up automatically.
2. If the route is dynamic, export `getStaticPaths()`.
3. Add a smoke test in `tests/e2e/smoke.spec.ts`.

### A new component

1. Add to `src/components/` (server-rendered) or `src/islands/` (interactive).
2. Use existing design tokens — don't introduce new color/spacing values
   without updating `src/styles/tokens.css`.
3. If it's a pure utility, add unit tests in `tests/unit/`.

### A new lesson or category

Edit `learncivicsense-content/`, not this repo. The website picks up new
taxonomy entries on the next build.

### A new locale

See `docs/runbooks/add-locale.md` (Phase 3; not yet written).

### An ADR-worthy decision

If you're picking a library, choosing between two architectural shapes, or
locking in a constraint that future-you will need to remember why — write
an ADR in `docs/adrs/NNN-title.md` using the template at the top of that
directory. Past ADRs (001-006) are exemplars.

## Testing

| Suite            | Run                     | When                                             |
| ---------------- | ----------------------- | ------------------------------------------------ |
| Unit (Vitest)    | `npm run test`          | Whenever you touch `src/lib/` or extend a helper |
| Coverage         | `npm run test:coverage` | Coverage drops below 80% statements → CI red     |
| E2E (Playwright) | `npm run test:e2e`      | New pages, new islands, new routes               |
| Lighthouse       | `npm run lhci`          | Before claiming "no perf regression"             |
| Size budget      | `npm run size`          | When you add a dep or an island                  |

## Performance discipline

- New dependencies need justification in the PR description.
- Anything that hits the client bundle gets a size-limit budget update.
- Anything that adds a network request to the page gets called out.

## Documentation discipline

- New public function in `src/lib/`? Add TSDoc.
- Behavior changed? Update `ARCHITECTURE.md` if the change is non-obvious.
- New runbook-worthy procedure? Add to `docs/runbooks/`.

## What's out of scope (for now)

- User accounts, login, favorites — listed as future hooks in
  `WEBSITE-BUILD-SPEC.md §15.4`.
- Hindi / other Indian languages — Phase 3.
- Image pipeline — Phase 3 (placeholders reserved everywhere).
- Comments, social, newsletter — explicitly out of scope at launch.
