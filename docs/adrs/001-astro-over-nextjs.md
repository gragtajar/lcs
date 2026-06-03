# ADR 001: Astro over Next.js

**Status:** Accepted
**Date:** 2026-05-25
**Authors:** Rajat Garg

## Context

learncivicsense.in is a content-heavy reading site. It has no dynamic backend,
no auth, and a hard constraint to be usable on 2G connections. The site grows
by adding markdown content, not by adding interactive features. Server-side
rendering is unnecessary; static generation is sufficient.

The interactive surface is small and well-bounded: theme toggle, search
overlay, sidebar accordion, TOC scroll-spy, lesson quiz. Everything else
can be plain HTML.

## Decision

Use **Astro** as the framework. Build static HTML at build time, ship zero
JavaScript by default, use Astro's islands architecture only for the five
interactive components.

## Alternatives considered

- **Next.js:** Ships a React runtime to the client by default; turning that
  off requires careful effort with RSC + careful boundary discipline. Higher
  baseline JS payload than Astro. Excellent if SSR/RSC were needed; we don't
  need them. Rejected.
- **Hugo:** Pure static, very fast builds, but adding islands for interactive
  components (search overlay, quiz) requires bolting on a separate JS toolchain.
  Astro's islands story is cleaner.
- **Eleventy:** Also pure static, mature, smaller and more deliberate than
  Next.js. The developer experience for adding interactive components is
  less integrated than Astro's; the ecosystem is smaller.
- **Plain HTML + JS:** No build step at all. Quickly becomes hard to maintain
  across 211+ lessons in 8 languages. Rejected.

## Consequences

- We commit to Astro's idioms (content collections, integrations API, slots).
- The site will be exceptionally fast at any scale because most pages ship
  near-zero JS. Measured: **14.67 KB gzipped total JS** on the heaviest page.
- When we eventually need any dynamic feature (e.g. user accounts), we add it
  as a separate service rather than rewriting the site.
- Contributor pool for Astro is smaller than React/Next.js; we accept that
  trade for the architectural fit.

## References

- `WEBSITE-BUILD-SPEC.md` §2 (hard constraints) and §3 (tech stack)
- `astro.config.mjs`
- [Astro docs](https://docs.astro.build/)
