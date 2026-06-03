# Observability setup runbook

How to wire up the three observability surfaces this site uses — analytics,
error monitoring, uptime — from blank account to receiving signal.

All three are on the free tier of their respective products. Total cost: $0.

---

## 1. Cloudflare Web Analytics (page views, geographic distribution, Core Web Vitals)

**Why this one:** cookie-free, GDPR-safe by default, collected and aggregated
by Cloudflare. Replaces Google Analytics for our needs.

### Setup

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site**.
2. Site domain: `learncivicsense.in`. Choose **Free** plan.
3. After creation, copy the **Beacon token** (a hex string like
   `abc123def4567890abc123def4567890`).
4. Add to repo secrets: GitHub → Settings → Secrets and variables → Actions →
   New repository secret:
   - Name: `PUBLIC_CF_ANALYTICS_TOKEN`
   - Value: the token from step 3
5. (Locally) copy to `.env`: `PUBLIC_CF_ANALYTICS_TOKEN=<token>`
6. Trigger a build. The beacon will be inlined into every page via
   `BaseLayout.astro`.

### Verifying

Open a production page in an incognito window. Network tab should show a
request to `static.cloudflareinsights.com/beacon.min.js`. Dashboard updates
roughly every 60 seconds.

### Removing

Drop the env var. Next build ships zero analytics JS.

---

## 2. Sentry (client-side JS errors in islands)

**Why this one:** the four interactive islands (ThemeToggle, SearchOverlay,
TableOfContents, LessonQuiz) are the only places where runtime errors can
happen. Sentry catches them with the actual user's stack trace.

Free tier: 5,000 events/month, 30-day retention. Plenty for our traffic.

### Setup

1. Sentry → **Create Project** → Platform: **Astro** → name `learncivicsense`.
2. Copy the **DSN** from project Settings.
3. Generate an **Auth Token** at Settings → Account → User Auth Tokens.
   Scopes needed: `project:releases`, `project:write` (for source-map upload).
4. Add repo secrets:
   - `SENTRY_DSN` — the DSN from step 2
   - `SENTRY_AUTH_TOKEN` — the token from step 3
5. (Locally, optional) copy to `.env` for testing source maps.
6. Trigger a deploy. `astro.config.mjs` conditionally adds the Sentry
   integration when `SENTRY_DSN` is set, and uploads source maps when
   `SENTRY_AUTH_TOKEN` is also set.

### Verifying

Visit a production page in the browser console, run:
`throw new Error('sentry smoke test ' + Date.now())`. The error should
appear in the Sentry dashboard within a minute, with file/line resolved via
source maps.

### Alerting

Sentry → Alerts → Create alert. Recommended:

- New error type ever observed → email immediately.
- Existing error type fires ≥10 events in 1 hour → email + (optional) Slack.

---

## 3. BetterStack (uptime + status page)

**Why this one:** the build can be green and the site can still be down
(DNS misconfigured, deploy never reached the host, etc). External pings
are the only way to know.

Free tier: 10 monitors, 3-minute checks, unlimited team members, public
status page included.

### Setup

1. BetterStack → **Uptime → Monitors → Add monitor**.
2. Add four monitors (the canonical surfaces of the site):
   - `https://learncivicsense.in/` — homepage
   - `https://learncivicsense.in/traffic/honking-discipline/the-case-against-honking/` — canonical article
   - `https://learncivicsense.in/search/` — search page
   - `https://learncivicsense.in/sitemap-index.xml` — signals build health
3. For each monitor: check interval 3 minutes, alert on 2 consecutive failures.
4. Notification channels: at least email. Slack/SMS optional.

### Status page (optional, recommended)

BetterStack → Status pages → Create. Subdomain: `status.learncivicsense.in`.
Add the four monitors above. Publish.

### Verifying

Take the site offline (block your IP, or just visit the BetterStack incident
page during a planned deploy). Confirm email arrives within ~7 minutes
(2 failed checks × 3min interval + alert latency).

---

## Removing observability entirely

Drop these env vars (locally + in CI). Next build ships without any of them.
The site is fully functional analytics-free; it's just less observable.
