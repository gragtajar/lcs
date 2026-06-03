# Incident response runbook

What to do when the site is down, slow, or wrong. Read this once now, not
during the incident.

## Priorities, in order

1. **Restore the user-visible site.** Rollback first, root-cause later.
2. **Communicate.** If the outage is visible (>5 min), post a one-line
   update on the status page (BetterStack).
3. **Root cause.** Postmortem within 72 hours of resolution.
4. **Prevent recurrence.** Add a regression test or a CI gate.

## Signals (where alerts come from)

| Source                   | What it catches                | Where it pages                        |
| ------------------------ | ------------------------------ | ------------------------------------- |
| BetterStack              | Site unreachable, 5xx from CDN | Email + optional Slack                |
| Sentry                   | Spike in client-side JS errors | Email on new error type, +10/hr alert |
| Cloudflare Web Analytics | Drop in page views             | No alert; check dashboard weekly      |
| Manual report (user)     | Anything the others miss       | Issue triaged via `[bug]` template    |

## Triage

For each alert, answer in ≤5 minutes:

1. **Is the site actually broken?**
   - `curl -fsSL https://learncivicsense.in/ > /dev/null` should return 0.
   - Open the site in a fresh incognito window.
2. **What changed recently?**
   - `git log --oneline origin/main -10` — most recent deploys.
   - Cloudflare Pages dashboard → Deployments → check the most recent.
3. **Is it a build issue or a runtime issue?**
   - Build: CI was green but production differs → infra problem (DNS, CDN).
   - Runtime: a JS island throwing → look at Sentry stack traces.

## Decision tree

```
Site returns 5xx or unreachable → ROLLBACK (docs/runbooks/rollback.md)
Site loads, content looks broken → ROLLBACK
JS island throws but site usable → bug ticket, no rollback
Lighthouse score drops → bug ticket, no rollback
Search returns no results → rebuild + check Pagefind index in CI
```

## Postmortem template

`docs/runbooks/postmortems/YYYY-MM-DD-slug.md`:

```markdown
# Postmortem: <one-line summary>

**Date:** YYYY-MM-DD
**Duration:** HH:MM — HH:MM (XX minutes user-visible)
**Severity:** S1 (site down) | S2 (degraded) | S3 (cosmetic)
**Author:** Name

## What happened

One paragraph, plain language.

## Timeline

- 14:02 — First signal
- 14:05 — Rollback executed
- 14:07 — Site verified restored

## Root cause

Why it happened, one paragraph. Avoid blame; focus on system-level reasons.

## What worked

What signal caught it, what process held up.

## What didn't

Where the lag was. Where we got lucky.

## Action items

- [ ] Add CI gate for X (assigned: @name, due: YYYY-MM-DD)
- [ ] Update runbook Y
```

## Things that look like an incident but aren't

- **Manifest has new entries.** That's a normal publish cycle — run the
  rebuild brief in `learncivicsense-workflow/REBUILD-INSTRUCTIONS.md`.
- **CI failure on a feature PR.** That's the gate working. Fix the PR, not
  the CI.
- **Lighthouse score dropping 1-2 points.** Within normal variance; only
  worry if it dips below the gated threshold (0.95 desktop / 0.90 mobile).
