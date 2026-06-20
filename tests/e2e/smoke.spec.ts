import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders the hero, curated chips, cluster cards, and mission', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/civic sense, learnable/i);
    // At least one curated hero chip links to an article.
    await expect(page.locator('.hero-chip').first()).toBeVisible();
    // Featured cluster cards: each is an <article> with an <h3>.
    await expect(page.locator('.cluster-card').first()).toBeVisible();
    await expect(page.locator('.cluster-card h3').first()).toBeVisible();
    // Mission section below the fold.
    await expect(page.getByRole('heading', { name: /who this is for/i })).toBeVisible();
    // "Browse all topics" leads to the catalog page.
    await expect(page.getByRole('link', { name: /browse all topics/i })).toBeVisible();
  });
});

test.describe('Topics catalog page', () => {
  test('lists the India / abroad sections and expands a category', async ({ page }) => {
    await page.goto('/topics/');
    await expect(page.getByRole('heading', { name: /in and around india/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /for your trip abroad/i })).toBeVisible();
    // Traffic is the first card (open by default) so its subtopics are visible.
    const traffic = page.locator('details[data-cat-id="traffic"]');
    await expect(traffic.getByRole('link', { name: /honking discipline/i })).toBeVisible();
    // A closed category expands on click.
    const queues = page.locator('details[data-cat-id="queues-and-waiting"]');
    await queues.locator('summary').first().click();
    await expect(queues.getByRole('link').first()).toBeVisible();
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
    // water-pools/pool-hygiene still has unwritten lessons → at least one COMING SOON chip.
    await page.goto('/water-pools/pool-hygiene/');
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

  test('renders the ShareBar at the top and bottom with per-platform links', async ({ page }) => {
    await page.goto('/traffic/honking-discipline/the-case-against-honking/');
    await expect(page.locator('.sharebar-compact')).toHaveCount(1); // top
    await expect(page.locator('.sharebar-full')).toHaveCount(1); // bottom
    // The bottom bar exposes the per-platform fallback links + copy.
    const full = page.locator('.sharebar-full');
    await expect(full.getByRole('link', { name: /share on whatsapp/i })).toBeVisible();
    await expect(full.getByRole('link', { name: /share on x/i })).toBeVisible();
    await expect(full.getByRole('button', { name: /copy link/i })).toBeVisible();
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
    await page.goto('/water-pools/pool-hygiene/what-chlorine-does-and-doesnt-do/');
    await expect(page.locator('.ah-soon-badge')).toContainText(/coming soon/i);
    await expect(page.locator('.cs-card')).toContainText(/lesson is being written/i);
    // No TOC, quiz, sources, or ShareBar on coming-soon
    await expect(page.locator('.quiz')).toHaveCount(0);
    await expect(page.locator('.toc')).toHaveCount(0);
    await expect(page.locator('.sharebar')).toHaveCount(0);
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
    // The topbar trigger is a button; the only "Search lessons" input is the overlay's.
    const input = page.getByPlaceholder(/search lessons/i).first();
    await input.fill('chlorine');
    // Wait for Pagefind to load + debounce settle. The chlorine lesson is unwritten,
    // so the result both appears and carries the coming-soon chip.
    await expect(page.getByText(/chlorine/i).first()).toBeVisible({ timeout: 5_000 });
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
