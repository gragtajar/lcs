# Project notes for Claude

## Git workflow — standing instruction (set 2026-06-11, extended 2026-09-26)

Every change to **any** of the lcs repos (`lcs`, `lcs-content`, `lcs-workflow`)
goes through a pull request: commit, open a PR, merge it once its checks are
green. Never push to `main` directly.

1. Branch off `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `ci/…`, or `content/…`.
2. Commit (husky runs lint-staged + commitlint; subject must be sentence-case).
3. Push the branch as gragtajar; open the PR with `gh pr create`.
4. Merge with a merge commit once green (`gh pr merge --merge --delete-branch`).
   In `lcs`, green means every CI check on the PR. `lcs-content` and
   `lcs-workflow` are private on GitHub Free, which offers neither auto-merge
   nor branch protection there, and they have no CI: merge after verifying.
5. Never force-push; never push secrets.

**Tooling:** `gh` is installed at `~/.local/bin/gh` (accounts `rajat-lt` and
`gragtajar`; the gragtajar token has `repo` + `workflow`). The laptop's default
git credential cannot read the private repos: fetch and push with
`https://gragtajar:$(gh auth token)@github.com/gragtajar/<repo>.git` after
`gh auth switch --user gragtajar`, then switch back. `lcs`'s `main` requires a
PR (no required reviews or status checks are configured).

**Commit identity gotcha:** the GitHub account has email-privacy on, so commits
must use the noreply email or pushes are rejected (`GH007`). All repos are
configured with:
`git config user.email "287801135+gragtajar@users.noreply.github.com"` and
`user.name "gragtajar"`. Keep using it.

**Repos (all on github.com/gragtajar):**

- `lcs` — the website (this repo).
- `lcs-content` (private) — `../learncivicsense-content`.
- `lcs-workflow` (private) — `../learncivicsense-workflow`.
- `lcs-tasks` (public) — `~/Documents/Claude/Scheduled`.

Content/workflow/tasks are separate repos (not a monorepo). Push content edits
to `lcs-content`, workflow edits to `lcs-workflow`, scheduled-skill edits to
`lcs-tasks`.

## Publishing articles — standing instruction

When the user says **"publish the remaining articles"** (or any close variant),
treat `../learncivicsense-workflow/PUBLISH-MANIFEST.json` as the **single source
of truth**. Do not discover work any other way (no git diff, no folder walk, no
taxonomy scan).

The procedure (from `../learncivicsense-workflow/REBUILD-INSTRUCTIONS.md`):

1. Read the manifest. Walk `newly_published_since_last_build`.
2. For each entry, verify the file exists at
   `../learncivicsense-content/{file_path}` with frontmatter `status: published`.
3. Run `npm run build` (Astro + Pagefind).
4. Verify each `url_path` returns 200 and renders the real body (not the
   coming-soon variant): TL;DR present, quiz/sources/TOC where applicable.
5. Lighthouse is skipped locally (no LH CLI in this environment); note it.
6. Roll the manifest forward: move `newly_published_since_last_build` entries
   into `previously_built_in` (preserve fields, add a `built_at` timestamp),
   reset `newly_published_since_last_build` to `[]`, set `last_built_at`.
   Do NOT recompute the `stats` block — that's editorial bookkeeping.
7. Report: routes flipped, build health, total lessons live, anomalies.

If `newly_published_since_last_build` is empty, rebuild idempotently and report
"no new articles, build is current."

## Deploy note

Production is `https://learncivicsense.in` on GoDaddy cPanel hosting (ADR 008,
`docs/runbooks/deploy.md`). **Merging a PR into `lcs` deploys it**: the push to
`main` runs **Deploy production** = the full CI, an FTPS upload of that exact
build, then live verification (every file byte for byte, redirects, headers, and
a Playwright pass on desktop/mobile × light/dark). Merges into `lcs-content` or
`lcs-workflow` deploy through **Content sync** within ~15 minutes; start one at
once with `gh workflow run deploy.yml --repo gragtajar/lcs --ref main -f reason="…"`.
`/build-info.json` on the live site shows which commits are deployed. A deploy
is done when its **Verify production** job is green; look at it, and at the
`production-report` screenshots, before reporting a deploy as done.

A local build + manifest roll-forward does NOT deploy. In the publishing
procedure above, "built and live" now means live on learncivicsense.in: roll the
manifest forward only after the deploy carrying those lessons is verified.
