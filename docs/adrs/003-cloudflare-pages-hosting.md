# ADR 003: Cloudflare Pages as future host (cPanel FTP transitional)

**Status:** Accepted (planned migration; current deploy is cPanel FTP)
**Date:** 2026-05-25
**Authors:** Rajat Garg

## Context

The site is static HTML. The audience is in India, on a mix of fixed broadband
and mobile (2G–5G). We want:

1. **India edge presence** — short round-trips from Bengaluru, Delhi, Chennai,
   etc.
2. **Atomic, instantly-rollback-able deploys** — never half-shipped state.
3. **Zero / minimal cost at our scale.**
4. **PR preview deployments** — every PR gets a unique URL for review.
5. **HTTP/3 + Brotli automatically.**

The repo currently deploys via cPanel FTP (`.github/workflows/deploy.yml`).
That works but is slow, has no atomicity (mid-upload state is visible), and
gives no PR previews. We treat it as transitional.

## Decision

Migrate hosting to **Cloudflare Pages** once Phase 1 is closed. Keep the
cPanel FTP deploy workflow until the cutover; then archive it. Cloudflare
gives us all five constraints above on the free tier.

## Alternatives considered

- **Cloudflare Pages:** Mumbai/Delhi/Chennai/Bengaluru/Kolkata/Hyderabad
  PoPs. Free tier covers our traffic with room. Built-in PR previews and
  atomic deploys. Standard choice. Picked.
- **Netlify:** Excellent DX, similar primitives. India PoP presence weaker
  than Cloudflare. Free tier slightly tighter. Acceptable backup.
- **Vercel:** Targeted at Next.js / React; we're not on that stack. India
  PoP presence comparable to Cloudflare. Free tier exists but commercial
  usage triggers paid tier sooner.
- **GitHub Pages:** Free, but no PR previews, no edge cache controls,
  rougher custom-domain story. Acceptable for a docs site, not for this.
- **Stay on cPanel forever:** Loses PR previews and atomic deploys. The
  current FTP push is slow and races. Rejected as a final state.

## Consequences

- Need a Cloudflare account + DNS migration of `learncivicsense.in` to
  Cloudflare nameservers (the runbook will land with the cutover).
- Production deploys become atomic via `cloudflare/pages-action@v1` in
  GitHub Actions.
- PR preview URLs auto-comment on every PR via the Cloudflare GitHub app.
- Need to set up `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as
  repo secrets.
- Rollback is one click in the Cloudflare dashboard.

## References

- `WEBSITE-BUILD-SPEC.md` §3 (tech stack rationale)
- `.github/workflows/deploy.yml` (current cPanel deploy, transitional)
- `docs/runbooks/rollback.md` (procedure once Cloudflare Pages is live)
- [Cloudflare Pages docs](https://developers.cloudflare.com/pages/)
