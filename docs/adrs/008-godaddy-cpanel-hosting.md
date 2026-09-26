# ADR 008: GoDaddy cPanel hosting, deployed over FTPS by GitHub Actions

**Status:** Accepted
**Date:** 2026-09-26
**Authors:** Rajat Garg
**Supersedes:** [ADR 003](./003-cloudflare-pages-hosting.md) (Cloudflare Pages as future host)

## Context

- The owner bought GoDaddy web hosting for `learncivicsense.in`. DNS is on
  GoDaddy (`ns09/ns10.domaincontrol.com`); the apex resolves to
  `107.180.116.224` and `www` is a CNAME to it. The server is Apache over
  HTTP/2, and the host provisioned a certificate (ZeroSSL, apex + `www`).
- Deployment access is an FTP account. Its home directory **is** the web root
  (verified in PR #28 by writing a file over FTP and reading it back over HTTPS).
  The root holds only the host's `.ftpquota` and `.well-known`.
- The site is a static Astro build plus a Pagefind index, built from three
  repos: `lcs` (site), `lcs-content` (lessons, taxonomy), `lcs-workflow`
  (publish manifest, content linter). Article images are on ImageKit.
- The previous `deploy.yml` uploaded the repository source without building it.
  It never succeeded, because the FTP secrets were only added on 2026-09-25.

## Decision

Host on the GoDaddy account and deploy from GitHub Actions:

- **`Deploy production`** runs on every push to `main`, when **`Content sync`**
  finds that `lcs-content` or `lcs-workflow` has moved on (checked every 15
  minutes), and by hand. It calls **`CI`** — the same workflow every pull
  request runs — then uploads the exact `dist/` that CI tested, and then verifies
  the live site.
- The upload uses `SamKirkland/FTP-Deploy-Action`, pinned to the v4.4.0 commit,
  over **explicit FTPS**. It keeps a state file on the server, uploads only
  changed files, and never deletes a file it did not upload.
- **`public/.htaccess`** replaces the Cloudflare `_headers` file: canonical
  `https://learncivicsense.in` (HTTP and `www` redirect, path and query kept),
  security headers, cache lifetimes, gzip, correct types for fonts, modules and
  the Pagefind index, and dotfiles hidden (except `.well-known`). Every
  module-dependent directive is inside `<IfModule>`. It was tested on the real
  host in a throwaway folder before the first deploy (PR #28).
- **`/build-info.json`** records the commits of all three repos the build came
  from. Verification compares it byte for byte; Content sync compares its
  content commits with the repos.
- Verification after every upload: every file in `dist/` is fetched from the
  live site and compared by SHA-256, the redirects, 404 status, hidden files,
  headers, caching and compression are checked (`scripts/verify-deploy.mjs`),
  and a Playwright pass runs on the live site on desktop and mobile in light and
  dark (`playwright.prod.config.ts`), keeping a screenshot of each key page.

## Alternatives considered

- **Cloudflare Pages (ADR 003):** atomic deploys and an edge in India. Not
  chosen because the owner has bought this hosting; it remains open.
- **`lftp mirror` instead of the action:** no state file, but CI builds give
  every file a new timestamp, so it either re-uploads everything each time or,
  with `--ignore-time`, can skip a changed file whose size did not change.
- **Plain FTP:** works on this host, but sends the password in clear text.
- **A `repository_dispatch` from the content repos:** starts a deploy the
  moment content merges, but needs a new token stored in each content repo.
  Content sync works with the token the site already has.

## Consequences

- **Deploys are not atomic.** While changed files upload, a visitor can get a
  new page with an old stylesheet for a few seconds. After the first deploy
  uploads are incremental and small.
- **FTPS certificate check depends on `FTP_SERVER`.** The host's FTP
  certificate names `*.prod.phx3.secureserver.net`, not `learncivicsense.in`.
  With `FTP_SERVER` set to the domain the session is encrypted but the server is
  not authenticated. The server's own name,
  `p3plzcpnl505141.prod.phx3.secureserver.net`, resolves to the same IP and its
  certificate verifies (2026-09-26); `deploy.yml` switches to `security: strict`
  automatically when `FTP_SERVER` ends in `.secureserver.net`.
- **The host injects a monitoring script into every page.** Found by the first
  deploy's verification: each HTML response gets two `<script>` tags before
  `</html>` (an inline `_trfd` settings queue and
  `https://img1.wsimg.com/traffic-assets/js/tccl.min.js`), commented "If you want
  to opt-out, please contact web hosting support." In a browser it sets
  `_tccl_visitor` (one year), `_tccl_visit` and `_scc_session` cookies on
  `.learncivicsense.in` and sends beacons to `csp.secureserver.net`. The site
  itself sets no cookies, and `/privacy/` says there are no third-party trackers.
  Verification recognises exactly this injection, reports it on every deploy,
  and still fails on any other difference.
- **The host replaces error bodies.** Missing pages answer 404 with the host's
  own 13-byte text; `ErrorDocument` is ignored in every form (quoted text, local
  path, with or without rewrites; PR #28). The designed `/404.html` is deployed
  and will show once the host honours `ErrorDocument`.
- **Distance.** The certificate's host name indicates GoDaddy's Phoenix data
  centre. From India, connecting took 0.33–0.55 s and the first byte arrived
  after 1.2–1.6 s (measured 2026-09-26), the round trip ADR 003 wanted to avoid.
  A CDN in front of the host, or a later move, would address it.
- **HSTS with `includeSubDomains; preload`** is sent, carried over from the old
  `_headers` policy. Every subdomain must keep working over HTTPS.
- **Content sync relies on a schedule.** GitHub pauses scheduled workflows in a
  public repository after 60 days without activity; a push re-enables it.
- **Secrets:** `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`,
  `CONTENT_REPO_TOKEN`, `IMAGEKIT_PRIVATE_KEY`, and optionally
  `WORKFLOW_REPO_TOKEN` (read access to `lcs-workflow`, which today's content
  token lacks; without it the homepage rotation uses content-derived signals and
  the content lint is skipped).

## References

- `.github/workflows/ci.yml`, `deploy.yml`, `content-sync.yml`
- `public/.htaccess`, `src/pages/build-info.json.ts`, `scripts/verify-deploy.mjs`
- `playwright.prod.config.ts`, `tests/prod/production.spec.ts`
- [`docs/runbooks/deploy.md`](../runbooks/deploy.md),
  [`docs/runbooks/rollback.md`](../runbooks/rollback.md)
