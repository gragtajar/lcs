# ADR 012: The feedback form, a PHP endpoint that emails the owner

**Status:** Accepted
**Date:** 2026-09-29
**Authors:** Rajat Garg
**Relates to:** [ADR 008](./008-godaddy-cpanel-hosting.md) (hosting), [ADR 010](./010-php-404-responder.md) (PHP on this host)

## Context

The owner asked for a feedback form, linked from the footer only, with the
following requirements:

- a type (New articles, Correction in article, Report something, Others) and a
  message of up to 500 characters;
- no file attachment at all;
- SQL injection filtered out, along with other security measures;
- every message delivered to the owner's email address, which must not appear
  anywhere in the site's frontend or backend code.

The site is static on GoDaddy cPanel hosting, which runs PHP 8.3 (ADR 010). The
domain has no MX, SPF or DKIM records; its DMARC policy is `p=quarantine`
(GoDaddy's default).

A throwaway probe on the host (PR #37, closed unmerged) found the following:

- PHP `mail()` works, but both test emails reached Gmail's **spam** folder: one
  from the server's own address, one sent as `feedback@learncivicsense.in`.
- A folder's `.user.ini` applies `post_max_size` but not `file_uploads` (a
  system-only setting).
- Apache's `LimitRequestBody` answers 413 for a 20 KB post.
- A `Require all denied` file answers 403.

## Decision

- **`/feedback/`** is a static page (noindex, footer link only) with a form
  that posts `application/x-www-form-urlencoded` to **`/feedback.php`**. With
  JavaScript, the result shows in place and a refused message keeps its text
  and says why. Without it, the endpoint redirects (303) to `/feedback/sent/`
  or `/feedback/not-sent/`.
- **The web server refuses** multipart bodies (file uploads) with 403 before
  PHP parses them, and bodies over 16 KB with 413 (`public/.htaccess`). It
  never caches the endpoint's answers.
- **The endpoint** (`public/feedback.php`) repeats the web server's checks and
  requires, in order:
  1. POST;
  2. `Origin: https://learncivicsense.in`;
  3. a urlencoded body with no files;
  4. an empty trap field (a bot that fills it is told "sent", and nothing is
     sent);
  5. one of the four types;
  6. valid UTF-8 of 3–500 characters after normalising (CRLF counts once;
     control characters and text-direction overrides are removed);
  7. no obvious code: SQL injection, markup or script, server templates, path
     traversal. The patterns are narrow enough that ordinary sentences pass;
     the tests include some that come close;
  8. at most three links;
  9. at most 5 messages an hour and 20 a day per sender, and 200 a day in all
     (429 with `Retry-After`).
- **Delivery**: `mail()` through the host, as plain UTF-8 text (base64), from
  the server's own address, with the subject `[Learn Civic Sense feedback]
{type}`. The owner chose a Gmail filter on that subject ("Never send it to
  Spam") over authenticating the domain or an email service. The server's own
  address does not fail DMARC (secureserver.net is `p=none`), so a filter can
  hold it in the inbox. Nothing from the visitor goes into a mail header.
- **The owner's address** is the GitHub secret `FEEDBACK_EMAIL_TO`. The deploy
  writes it into `.lcs-private/feedback-config.php` after downloading the
  tested build, so it is in neither the repo nor the build artifact. That
  folder is never served: every dotted path answers the 404 page, which Verify
  production checks.
- **Kept on the server**: only the rate-limit state. For each sender that is a
  keyed hash (HMAC-SHA256, with a random key the server makes for itself) of
  the IP address and the times they sent feedback. Entries older than a day
  are dropped the next time the form is used. Messages are not stored.
- **Tests**:
  - The CI job "Feedback endpoint (PHP)" runs every branch under PHP 8.3 with a
    file transport (nothing is emailed; `scripts/test-feedback-endpoint.mjs`).
  - E2E covers the page, with the endpoint answered by Playwright.
  - Verify production checks the host's side without sending an email.

## Alternatives considered

- **A form service** (Formspree and similar): the address would live in the
  vendor's dashboard, but the checks would be the vendor's, and a third party
  would hold every message. Not chosen.
- **An email API** (Resend): reliable delivery without DNS work, but it needs an
  account and an API key, and the provider sees the messages. Offered; the
  owner chose the filter.
- **Authenticating the domain** (SPF and DKIM records at GoDaddy, DKIM enabled
  in cPanel), then sending as `feedback@learncivicsense.in`. This is better for
  deliverability everywhere, but it means DNS changes. Offered; still possible
  later without changing the form.
- **Storing messages on the server**: more personal data at rest on shared
  hosting, for no gain over email. Rejected.
- **A CAPTCHA**: a third-party script and friction for readers. The trap field,
  the origin check and the rate limits are enough at this scale; revisit if
  spam gets through.

## Consequences

- Delivery to the inbox depends on the owner's Gmail filter; without it,
  feedback lands in spam.
- There is no database, so SQL injection has nothing to attack. The code filter
  keeps junk out; it can refuse an unusual but honest message, which is then
  told why and can be reworded.
- The privacy page describes the form. Changing what it keeps, or where
  messages go, means updating `src/pages/privacy.astro` in the same change.

## References

- `public/feedback.php`, `src/pages/feedback/`, `public/.htaccess`
- `.github/workflows/deploy.yml` (the private settings), `.github/workflows/ci.yml`
  (the PHP job), `scripts/test-feedback-endpoint.mjs`, `scripts/verify-deploy.mjs`
- `docs/runbooks/deploy.md` (the secret, the host's mail behaviour)
