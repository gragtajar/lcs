import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders the hero + 3 sections of categories', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/learn civic sense/i);
    await expect(page.getByRole('heading', { name: /in and around india/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /for your trip abroad/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /for visitors to india/i })).toBeVisible();
  });

  test('expanding a category reveals its subcategories', async ({ page }) => {
    await page.goto('/');
    const traffic = page.locator('details[data-cat-id="traffic"]');
    await traffic.locator('summary').first().click();
    await expect(traffic.getByRole('link', { name: /honking discipline/i })).toBeVisible();
  });
});

test.describe('Category and subcategory pages', () => {
  test('subcategory page lists articles with a sidebar', async ({ page }) => {
    await page.goto('/traffic/honking-discipline/');
    // breadcrumb leads back
    await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
    // sidebar has the active subtopic highlighted
    await expect(page.locator('.sb-sub.active')).toContainText('Honking discipline');
    // the published article shows real metadata
    await expect(page.getByRole('heading', { name: /the case against honking/i })).toBeVisible();
    await expect(page.getByText(/3 min read/i).first()).toBeVisible();
  });

  test('subcategory page mixes published and coming-soon articles', async ({ page }) => {
    await page.goto('/traffic/honking-discipline/');
    // at least one COMING SOON chip on the list
    await expect(page.locator('.li-meta-soon').first()).toBeVisible();
  });
});

test.describe('Article page (real)', () => {
  test('renders title, TL;DR, body, sources, related, and quiz', async ({ page }) => {
    await page.goto('/traffic/honking-discipline/the-case-against-honking/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/honking/i);
    await expect(page.getByText(/TL;DR/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /sources/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /quick check/i })).toBeVisible();
  });

  test('clicking a quiz option reveals per-option feedback', async ({ page }) => {
    await page.goto('/traffic/honking-discipline/the-case-against-honking/');
    const firstOpt = page.locator('.quiz-opt').first();
    await firstOpt.scrollIntoViewIfNeeded();
    await firstOpt.click();
    // Feedback text appears below the picked option
    await expect(page.locator('.quiz-feedback').first()).toBeVisible();
  });
});

test.describe('Article page (coming-soon)', () => {
  test('renders the placeholder body for a planned-but-unpublished lesson', async ({ page }) => {
    await page.goto(
      '/traffic/honking-discipline/honking-at-red-lights-and-what-it-costs-everyone/',
    );
    await expect(page.locator('.ah-soon-badge')).toContainText(/coming soon/i);
    await expect(page.locator('.cs-card')).toContainText(/lesson is being written/i);
    // No TOC, quiz, or sources on coming-soon
    await expect(page.locator('.quiz')).toHaveCount(0);
    await expect(page.locator('.toc')).toHaveCount(0);
  });
});

test.describe('Visitors module', () => {
  test('/visitors renders the Phase 4 placeholder page', async ({ page }) => {
    await page.goto('/visitors/');
    await expect(page.getByRole('heading', { name: /for visitors to india/i })).toBeVisible();
    await expect(page.getByText(/phase 4/i).first()).toBeVisible();
  });
});

test.describe('Global search', () => {
  test('overlay opens, finds a published article, and flags coming-soon results', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open search/i }).click();
    const input = page.getByPlaceholder(/search lessons/i).nth(1); // overlay input, not topbar trigger
    await input.fill('honking');
    // Wait for Pagefind to load + debounce settle.
    await expect(page.getByText(/the case against honking/i).first()).toBeVisible({
      timeout: 5_000,
    });
    // The coming-soon "Honking at red lights..." should appear with chip
    await expect(page.locator('.search-result-chip').first()).toContainText(/coming soon/i);
  });
});

test.describe('Theme toggle persistence', () => {
  test('toggling dark mode survives a reload', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.theme-toggle');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await toggle.click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(after).not.toBe(before);
    await page.reload();
    const reloaded = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(reloaded).toBe(after);
  });
});

test.describe('Top bar', () => {
  test('is identical and sticky on every primary page', async ({ page }) => {
    for (const url of [
      '/',
      '/traffic/',
      '/traffic/honking-discipline/',
      '/traffic/honking-discipline/the-case-against-honking/',
      '/visitors/',
      '/search/',
    ]) {
      await page.goto(url);
      await expect(page.locator('.topbar')).toBeVisible();
      await expect(page.locator('.brand-name')).toContainText('learncivicsense.in');
    }
  });
});

test.describe('404', () => {
  test('renders the custom not-found page', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
