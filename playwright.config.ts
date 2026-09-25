import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke suite against the production build before it ships. Talks to
 * `npm run preview` (the built dist/ with the Pagefind index) by default.
 * Every test runs in four projects: desktop and mobile, light and dark.
 *
 * The same smoke suite also runs against the live site after each deploy,
 * together with tests/prod/ — see playwright.prod.config.ts.
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
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'mobile-light', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
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
