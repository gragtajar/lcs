# Project notes for Claude

## Git workflow — standing instruction (set 2026-06-11)

From now on, land every website change through a PR-style flow, then merge to main:

1. Branch off `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`, or `content/…`.
2. Commit (husky runs lint-staged + commitlint; subject must be sentence-case).
3. Push the branch; surface the PR compare URL.
4. Merge to `main` with a merge commit (`git merge --no-ff`) once green, then
   `git push origin main`. Delete the merged branch.
5. Never force-push; never push secrets.

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

This repo deploys via cPanel FTP on push to `main` (`.github/workflows/deploy.yml`).
Content lives in the sibling `../learncivicsense-content/` repo. A local build +
manifest roll-forward does NOT deploy; only push to `main` does. Don't push or
deploy unless asked.
