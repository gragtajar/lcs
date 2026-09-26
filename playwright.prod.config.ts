import { defineConfig, devices } from '@playwright/test';

/**
 * The browser half of the post-deploy verification (Deploy production →
 * Verify production). Runs the smoke suite plus tests/prod/ against the live
 * site on desktop and mobile, in light and dark, and keeps a full-page
 * screenshot of every key page for review.
 *
 *   PROD_URL=https://learncivicsense.in npm run test:prod
 *
 * EXPECTED_SITE_SHA, when set, must match the site commit in /build-info.json.
 */
const baseURL = process.env.PROD_URL ?? 'https://learncivicsense.in';

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/smoke.spec.ts', 'prod/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The network between a CI runner and the host is the flaky part, not the site.
  retries: 2,
  workers: 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results-prod',
  reporter: [
    ...(process.env.CI ? ([['github']] as const) : []),
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-prod' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'mobile-light', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
});
