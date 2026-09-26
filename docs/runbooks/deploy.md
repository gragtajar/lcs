# Deploy runbook

How `learncivicsense.in` reaches production, and what to do when a deploy is
red. The decision record is [ADR 008](../adrs/008-godaddy-cpanel-hosting.md).

## How a change reaches the live site

| Change                                    | What starts the deploy                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| A pull request merged into `lcs`          | the push to `main` starts **Deploy production**           |
| A pull request merged into `lcs-content`  | **Content sync** notices within ~15 minutes and starts it |
| A pull request merged into `lcs-workflow` | the same, when a token can read that repo                 |
| Anything else, or right now               | start it by hand (below)                                  |

Every change to any of the three repos goes through a pull request. In `lcs`
the pull request runs **CI**; merge it only when every check is green.

**Deploy production** then runs, in order:

1. **Checks** — the whole CI workflow again, on the merged commit: format,
   ESLint, Stylelint, TypeScript, unit tests with coverage, content lint, the
   build (with the ImageKit registry refreshed), E2E on desktop and mobile in
   light and dark, Lighthouse desktop and mobile, size-limit.
2. **Upload to GoDaddy (FTPS)** — the build from step 1, unchanged. Only
   changed files are uploaded.
3. **Verify production** — every file served byte for byte, redirects, 404
   status, hidden files, headers, caching, gzip; then a browser pass on the live
   site on desktop and mobile in light and dark, with a screenshot of each key
   page (artifact `production-report`).

A green run means the live site is the tested build and works. Deploys never
overlap, and a running upload is never cancelled.

## Start a deploy by hand

```bash
gh workflow run deploy.yml --repo gragtajar/lcs --ref main -f reason="Why"
```

Or Actions → Deploy production → Run workflow.

## See what is live

```bash
curl -s https://learncivicsense.in/build-info.json
```

`site`, `content` and `workflow` are the commits of the three repos the live
build came from; `lessons` counts planned and published lessons.

## When a deploy is red

Open the failed run and look at which job failed.

- **Checks** failed: nothing was uploaded; the live site is unchanged. Fix the
  cause in a pull request.
- **Upload** failed: the live site may be part old, part new. Re-run the
  workflow (Re-run failed jobs); the state file makes the retry upload only what
  is still missing. If it keeps failing, check the FTP secrets and that the
  account still works (cPanel → FTP Accounts).
- **Verify production** failed: the upload finished but the live site is not
  what was tested, or does not work. The log lists every file or check that
  failed, and the `production-report` artifact holds the Playwright report and
  screenshots. A single network flake passes on "Re-run failed jobs"; anything
  else needs a fix, or a rollback ([rollback.md](./rollback.md)).

Content sync tries each content state once. If a content deploy failed, fix the
cause and re-run the deploy by hand; the next sync check continues from there.

## Known host behaviour

- Missing pages answer **404** with GoDaddy's own 13-byte text, not the site's
  404 page; `ErrorDocument` is ignored by the host (ADR 008).
- FTPS runs with `security: loose`, because the FTP certificate is issued to
  `*.prod.phx3.secureserver.net` rather than `learncivicsense.in`.
- The FTP account's home directory is the web root. Never delete `.well-known`
  (certificate renewal) or `.ftpquota`. The deploy never touches files it did
  not upload.

## Secrets (repo `gragtajar/lcs` → Settings → Secrets → Actions)

| Secret                 | Used for                                                  |
| ---------------------- | --------------------------------------------------------- |
| `FTP_SERVER`           | FTP host                                                  |
| `FTP_USERNAME`         | FTP account                                               |
| `FTP_PASSWORD`         | FTP password                                              |
| `CONTENT_REPO_TOKEN`   | cloning `lcs-content`; Content sync                       |
| `IMAGEKIT_PRIVATE_KEY` | refreshing the article-image registry at build time       |
| `WORKFLOW_REPO_TOKEN`  | optional: cloning `lcs-workflow` (manifest, content lint) |
