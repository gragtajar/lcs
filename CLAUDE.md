# Project notes for Claude

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
