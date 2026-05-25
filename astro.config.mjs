import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// learncivicsense.in — Astro config
// Zero-JS by default. Preact only for the few interactive islands.
export default defineConfig({
  site: 'https://learncivicsense.in',
  output: 'static',
  integrations: [preact()],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
