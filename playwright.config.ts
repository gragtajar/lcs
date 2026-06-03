import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke + a11y suite. Talks to `npm run preview` (production build with
 * Pagefind index baked in) by default. Override `PLAYWRIGHT_BASE_URL` to
 * point at a preview deployment from CI.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4322',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4322',
        url: 'http://localhost:4322',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
