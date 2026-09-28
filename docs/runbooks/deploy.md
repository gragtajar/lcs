# Deploy runbook

How `learncivicsense.in` reaches production, and what to do when a deploy is
red. The decision record is [ADR 008](../adrs/008-godaddy-cpanel-hosting.md).

## How a change reaches the live site

| Change                                    | What starts the deploy                             |
| ----------------------------------------- | -------------------------------------------------- |
| A pull request merged into `lcs`          | the push to `main` starts **Deploy production**    |
| A pull request merged into `lcs-content`  | **Content sync** notices and starts it (see below) |
| A pull request merged into `lcs-workflow` | the same, when a token can read that repo          |
| Anything else, or right now               | start it by hand (below)                           |

Every change to any of the three repos goes through a pull request. In `lcs`
the pull request runs **CI**; merge it only when every check is green.

Content sync is scheduled every 15 minutes, but GitHub drops scheduled runs
under load: in September 2026 it ran every 2.5–6 hours (12 runs in 48 hours).
After a content or workflow merge, start a deploy by hand if it matters.

**Deploy production** then runs, in order:

1. **Checks** — the whole CI workflow again, on the merged commit: format,
   ESLint, Stylelint, TypeScript, unit tests with coverage, content lint, the
   build (with the ImageKit registry refreshed), E2E on desktop and mobile in
   light and dark, Lighthouse desktop and mobile, size-limit, and every branch
   of the feedback endpoint under PHP (nothing is emailed).
2. **Upload to GoDaddy (FTPS)** — the build from step 1, unchanged, plus the
   feedback form's private settings, written from the `FEEDBACK_EMAIL_TO`
   secret into `.lcs-private/` (never in the build, never served; ADR 012).
   Only changed files are uploaded.
3. **Verify production** — every file served byte for byte, redirects (all
   331 addresses from before ADR 011 included), the site's 404 page (status 404) for missing addresses, the feedback endpoint's guards (without
   sending an email), hidden files and the private settings, headers,
   caching, gzip; then a browser pass on the live
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

- The host replaces the body of every error **Apache** generates with its own
  13-byte text and ignores `ErrorDocument` (ADR 008). So every address the site
  has no page for is rewritten to `404.php`, which sends the site's 404 page
  with status 404 (ADR 010); verification checks this on every deploy.
- GoDaddy **injects a monitoring script into every HTML page** (before
  `</html>`: an inline `_trfd` queue plus
  `img1.wsimg.com/traffic-assets/js/tccl.min.js`), which sets `_tccl_visitor`,
  `_tccl_visit` and `_scc_session` cookies and beacons to
  `csp.secureserver.net`. Its own comment says opting out is done by contacting
  GoDaddy hosting support. Verification recognises exactly this injection and
  shows a warning on each run; anything else that differs from the build fails.
- Mail that PHP sends from this host lands in Gmail's spam folder, both from
  the server's own address and as `feedback@learncivicsense.in` (the domain
  has no SPF or DKIM records; tested in PR #37). Feedback emails therefore go
  out from the server's own address with the subject `[Learn Civic Sense
feedback] …`, and the owner's Gmail filter on that subject ("Never send it
  to Spam") keeps them in the inbox.
- The FTP certificate is issued to `*.prod.phx3.secureserver.net`. With
  `FTP_SERVER` = `learncivicsense.in` the upload uses `security: loose`
  (encrypted, server not verified); set `FTP_SERVER` to
  `p3plzcpnl505141.prod.phx3.secureserver.net` and it verifies the certificate.
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
| `FEEDBACK_EMAIL_TO`    | the address feedback is emailed to (ADR 012)              |
