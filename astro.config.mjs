import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import sentry from '@sentry/astro';

// learncivicsense.in — Astro config.
// Zero-JS by default. Preact only for the few interactive islands.
//
// Sentry is conditionally included only when SENTRY_DSN is set, so local dev
// and forked CI builds don't drag in the Sentry runtime. Source-map upload
// happens only when SENTRY_AUTH_TOKEN is also present (i.e. production deploys).

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const integrations = [
  preact(),
  sitemap({
    changefreq: 'weekly',
    priority: 0.8,
    lastmod: new Date(),
    // The dedicated image sitemap (src/pages/sitemap-images.xml.ts) is referenced
    // directly from robots.txt; keep it out of the page sitemap index.
    filter: (page) => !page.includes('/sitemap-images.xml'),
    i18n: {
      defaultLocale: 'en',
      locales: { en: 'en-IN' },
    },
  }),
];

if (SENTRY_DSN) {
  integrations.push(
    sentry({
      dsn: SENTRY_DSN,
      environment: NODE_ENV,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      sourceMapsUploadOptions: SENTRY_AUTH_TOKEN
        ? {
            project: 'learncivicsense',
            authToken: SENTRY_AUTH_TOKEN,
          }
        : undefined,
    }),
  );
}

export default defineConfig({
  site: 'https://learncivicsense.in',
  output: 'static',
  integrations,
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
