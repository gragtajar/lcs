# ADR 010: The 404 page is sent by PHP

**Status:** Accepted
**Date:** 2026-09-27
**Authors:** Rajat Garg
**Relates to:** [ADR 008](./008-godaddy-cpanel-hosting.md) (GoDaddy cPanel hosting)

## Context

The site is static, but it needs its own not-found page for every address it
has no page for, with a real 404 status. On this host that cannot come from
Apache: GoDaddy replaces the body of every error Apache generates with its own
13-byte "404 Not Found" (or "403 Forbidden"), and `ErrorDocument` is ignored in
every form: quoted text, a local path, with or without rewrites (ADR 008,
PR #28). Folders with no page of their own (`/_astro/`, `/fonts/`) answered the
host's bare 403.

A probe on the real host (PR #35, a throwaway folder, since deleted) showed
that a response PHP generates keeps its own body and status. A missing page, a
missing `.html`, a folder without an index, a dotfile and `404.php` itself all
answered **404** with the probe's page and `text/html; charset=utf-8`. PHP's
`X-Powered-By` header can be removed, and the host does not inject its
monitoring script into PHP output (it does into static HTML).

## Decision

`public/.htaccess` rewrites (internally, so the address bar keeps the URL)
every address the site has no page for to `/404.php`:

- anything missing (`!-f` and `!-d`),
- any folder without an `index.html`,
- anything whose name starts with a dot, except `.well-known`.

It runs after the HTTPS and host redirects, so an `http://` or `www.` address
is canonicalised first.

`public/404.php` sends status 404, `text/html; charset=utf-8`,
`Cache-Control: no-store`, no `X-Powered-By`, and the bytes of `404.html`,
which Astro builds from `src/pages/404.astro`. It reads nothing from the
request. The page itself is `noindex` with no canonical URL, and enhances in
the browser: it shows the address that was followed, fills the search field
from it, and offers the lessons the address's words match.

## Alternatives considered

- **Serve `404.html` with status 200** ("soft 404") through a rewrite:
  search engines treat it as an error page anyway and report it as a problem,
  link checkers and monitoring stop seeing missing pages, and a stale link looks
  like a working one. Rejected; the site owner chose a real 404 or nothing.
- **Keep the host's text:** a 13-byte dead end for every mistyped or truncated
  link, often shared on WhatsApp. It was the fallback if PHP had not kept the
  body.
- **A redirect to `/404/`:** the reader loses the address they followed, and
  the redirect target answers 200. Rejected.

## Consequences

- The site now depends on the host running PHP for one tiny, input-free script.
  If PHP stopped, `/404.php` would be served as text or fail. Deploy
  verification checks every not-found case on each deploy: status 404, the page
  byte for byte, `no-store`, no `X-Powered-By`.
- A missing address costs one PHP execution and ~25 kB of HTML instead of
  13 bytes; bots probing for `/wp-login.php` and the like get the page too.
- The local preview (`astro preview`) answers unknown routes with `404.html`
  itself, so the E2E suite exercises the same page and status without PHP.

## References

- `public/.htaccess`, `public/404.php`, `src/pages/404.astro`
- `scripts/verify-deploy.mjs` (the not-found checks), `tests/e2e/smoke.spec.ts`,
  `tests/prod/production.spec.ts`
