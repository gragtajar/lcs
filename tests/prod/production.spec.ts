import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Production checks, run by Deploy production → Verify production against the
 * live site in four projects (desktop / mobile × light / dark), alongside the
 * smoke suite. They prove what only the live host can: the build that CI
 * tested is the one being served, pages render in the right theme with the
 * self-hosted font, search works with the host's MIME types, ImageKit images
 * load, and no page logs an error or requests something that fails.
 *
 * A full-page screenshot of each key page is saved for human review.
 */

const EXPECTED_SITE_SHA = process.env.EXPECTED_SITE_SHA;
const GROUND = { light: 'rgb(251, 250, 247)', dark: 'rgb(23, 22, 19)' } as const;

/** Console errors, page errors, and failed requests seen while the page is open. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) =>
    problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`),
  );
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return problems;
}

async function shoot(page: Page, info: TestInfo, name: string) {
  const dir = path.join('test-results-prod', 'screenshots');
  mkdirSync(dir, { recursive: true });
  const body = await page.screenshot({
    fullPage: true,
    path: path.join(dir, `${info.project.name}-${name}.png`),
  });
  await info.attach(name, { body, contentType: 'image/png' });
}

function scheme(info: TestInfo): 'light' | 'dark' {
  return info.project.use.colorScheme === 'dark' ? 'dark' : 'light';
}
function isMobile(info: TestInfo): boolean {
  return !!info.project.use.isMobile;
}

test.describe('Production', () => {
  test('serves the build this deploy tested', async ({ request }) => {
    // Headers and caching are the host's policy, checked by scripts/verify-deploy.mjs.
    const res = await request.get(`/build-info.json?check=${Date.now()}`);
    expect(res.status()).toBe(200);
    const info = (await res.json()) as {
      site: string;
      content: string;
      lessons: { planned: number; published: number };
    };
    if (EXPECTED_SITE_SHA) expect(info.site).toBe(EXPECTED_SITE_SHA);
    expect(info.content).toMatch(/^[0-9a-f]{40}$/);
    expect(info.lessons.published).toBeGreaterThan(0);
    expect(info.lessons.published).toBeLessThanOrEqual(info.lessons.planned);
  });

  test('home renders in the reader’s theme with the self-hosted font', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/civic sense, learnable/i);
    await expect(page.locator('.start-link')).toHaveCount(5);
    await expect(page.locator('#topics .topics-link')).toHaveCount(14);

    // The pre-paint script picked the theme the device asks for, and the tokens applied.
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme(info));
    const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(ground).toBe(GROUND[scheme(info)]);

    // Hind (self-hosted woff2) loaded in the weights the page uses, not a fallback.
    const hind = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((f) => f.family.replace(/["']/g, '') === 'Hind' && f.status === 'loaded')
        .map((f) => String(f.weight));
    });
    expect(hind).toEqual(expect.arrayContaining(['400', '700']));

    // The top bar adapts: a labelled field on desktop, an icon button on phones.
    const label = page.locator('.search-trigger-label');
    if (isMobile(info)) await expect(label).toBeHidden();
    else await expect(label).toBeVisible();

    await shoot(page, info, 'home');
    expect(problems).toEqual([]);
  });

  test('category and lesson-list pages', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('/traffic/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/traffic and roads/i);
    await expect(page.locator('.si-link')).toHaveCount(10);
    await shoot(page, info, 'category');

    await page.goto('/traffic/honking-discipline/');
    await expect(page.locator('article.li').first()).toBeVisible();
    const toggle = page.locator('[data-drawer-toggle]');
    if (isMobile(info)) {
      // Phones get the categories as a drawer.
      await expect(toggle).toBeVisible();
      await expect(async () => {
        await toggle.click();
        await expect(page.locator('#sidebar-drawer')).toHaveAttribute('role', 'dialog', {
          timeout: 1_000,
        });
      }).toPass({ timeout: 15_000 });
      await page.keyboard.press('Escape');
    } else {
      await expect(toggle).toBeHidden();
      await expect(page.locator('.sidebar').first()).toBeVisible();
    }
    await shoot(page, info, 'lesson-list');
    expect(problems).toEqual([]);
  });

  test('a lesson: contents, quiz and sources', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('/traffic/honking-discipline/the-case-against-honking/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/honking/i);
    await expect(page.locator('.tldr')).toBeVisible();
    if (isMobile(info)) await expect(page.locator('.toc-mobile')).toBeVisible();
    else await expect(page.locator('.toc-side')).toBeVisible();

    const option = page.locator('.quiz-opt').first();
    await option.scrollIntoViewIfNeeded();
    await expect(async () => {
      await option.click();
      await expect(page.locator('.quiz-feedback').first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /sources/i })).toBeVisible();
    await shoot(page, info, 'lesson');
    expect(problems).toEqual([]);
  });

  test('a lesson with an ImageKit image', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto(
      '/religious-sites-and-monuments/gurdwara-visits/the-gurdwara-visit-head-cover-langar-the-parikrama/',
    );
    const hero = page.locator('img[src*="ik.imagekit.io"]').first();
    await hero.scrollIntoViewIfNeeded();
    await expect(hero).toBeVisible();
    await expect
      .poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await shoot(page, info, 'lesson-with-image');
    expect(problems).toEqual([]);
  });

  test('search works with the host’s file types', async ({ page }, info) => {
    const problems = watch(page);
    // pagefind.js is an ES module and its index is binary: both depend on
    // how the host serves them, which a local preview cannot prove.
    await page.goto('/search/?q=honking');
    await expect(page.locator('.sp-list .search-result').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.sp-status')).toContainText(/lessons? match/i);
    await expect(page.locator('.sp-list mark').first()).toBeVisible();
    await shoot(page, info, 'search');
    expect(problems).toEqual([]);
  });

  test('the designed 404 page is deployed', async ({ page }, info) => {
    // Missing URLs answer 404 (asserted in the smoke suite); this host shows its
    // own text for them, so check the site's page itself is in place.
    const res = await page.goto('/404.html');
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/page not found/i).first()).toBeVisible();
    await shoot(page, info, '404');
  });
});
