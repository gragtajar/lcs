# Architecture Decision Records

Each `NNN-title.md` here captures one architectural choice: what we decided,
what we considered instead, what we accept by picking it, and what we lock in.

ADRs are write-once mostly. We only edit them to mark status as `Superseded`
and link forward to the replacement.

## Template

```markdown
# ADR NNN: Decision title

**Status:** Accepted | Proposed | Deprecated | Superseded by ADR XXX
**Date:** YYYY-MM-DD
**Authors:** Name

## Context

What problem are we solving? What constraints exist?

## Decision

What we decided to do, in one paragraph.

## Alternatives considered

- Alternative A: why rejected
- Alternative B: why rejected

## Consequences

What we gain. What we accept. What we leave on the table for future revision.

## References

Links to relevant code, external docs, related ADRs.
```

## Index

| #                                        | Title                                 | Status                                      |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------- |
| [001](./001-astro-over-nextjs.md)        | Astro over Next.js                    | Accepted                                    |
| [002](./002-pagefind-over-algolia.md)    | Pagefind over Algolia / Elasticsearch | Accepted                                    |
| [003](./003-cloudflare-pages-hosting.md) | Cloudflare Pages as future host       | Accepted (current: cPanel FTP transitional) |
| [004](./004-hind-font-family.md)         | Hind superfamily for typography       | Accepted                                    |
| [005](./005-design-token-palette.md)     | Teal + amber design token palette     | Accepted                                    |
| [006](./006-coming-soon-rendering.md)    | Coming-soon stubs from taxonomy       | Accepted                                    |
