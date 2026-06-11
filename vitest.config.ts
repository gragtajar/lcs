/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/lib/**/*.ts'],
      // icons.ts is a static lookup table; analytics.ts + logger.ts are browser-SDK
      // glue (Amplitude / Sentry) whose init paths need a real browser — they're
      // exercised by Playwright e2e + their safe surface in runtime-libs.test.ts,
      // not by unit branch coverage.
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        'src/lib/icons.ts',
        'src/lib/analytics.ts',
        'src/lib/logger.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@lib': new URL('./src/lib/', import.meta.url).pathname,
      '@i18n': new URL('./src/i18n/', import.meta.url).pathname,
    },
  },
});
