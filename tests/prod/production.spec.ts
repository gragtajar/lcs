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

// GoDaddy injects its own monitoring script into every page (a loader from
// img1.wsimg.com that beacons to csp.secureserver.net; see the deploy runbook).
// Those requests belong to the host, not the site: a beacon cut short by the
// next navigation is not a site failure. scripts/verify-deploy.mjs reports the
// injection on every deploy.
const HOST_MONITORING = new Set(['img1.wsimg.com', 'csp.secureserver.net']);
const isHostMonitoring = (url: string) => HOST_MONITORING.has(new URL(url).host);

/** Console errors, page errors, and failed requests seen while the page is open. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (isHostMonitoring(r.url())) return;
    // An image request the browser cancelled itself is not a failure a reader
    // sees. Chromium re-picks a responsive image's file when the page's metrics
    // change, as they do inside this suite's full-page screenshots: in deploy
    // run 36860644289 the homepage's 400w illustrations loaded (200) at page
    // load, then 240w requests began 32-110 ms into the capture and were
    // cancelled. HTTP errors still count (below), as does every other failure.
    if (r.resourceType() === 'image' && r.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isHostMonitoring(r.url())) {
      problems.push(`HTTP ${r.status()}: ${r.url()}`);
    }
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
    // The featured topics' illustrations load from ImageKit for real (the
    // topics without one show a CSS cover, not an image).
    for (const img of await page.locator('img.lead-img').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth), {
          timeout: 15_000,
        })
        .toBeGreaterThan(0);
    }
    expect(problems).toEqual([]);
  });

  test('a topic page: its lessons, with the topics sidebar', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('/traffic/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/traffic and roads/i);
    await expect(page.locator('article.li').first()).toBeVisible();
    await expect(page.locator('.article-list .li-title a').first()).toHaveAttribute(
      'href',
      /^\/traffic\/[a-z0-9-]+\/$/,
    );
    const toggle = page.locator('[data-drawer-toggle]');
    if (isMobile(info)) {
      // Phones get the topics as a drawer.
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
    await shoot(page, info, 'topic');
    expect(problems).toEqual([]);
  });

  test('an address from before the site had two levels lands on its lesson', async ({ page }) => {
    // The Apache 301 (public/.htaccess, ADR 011), followed as a browser does.
    await page.goto('/traffic/honking-discipline/the-case-against-honking/');
    await expect(page).toHaveURL(/\/traffic\/the-case-against-honking\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/honking/i);
    await page.goto('/traffic/honking-discipline/');
    await expect(page).toHaveURL(/\/traffic\/$/);
  });

  test('a lesson: contents, quiz and sources', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('/traffic/the-case-against-honking/');
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
      '/religious-sites-and-monuments/the-gurdwara-visit-head-cover-langar-the-parikrama/',
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

  test('a missing address answers 404 with the site’s own page', async ({ page }, info) => {
    // Sent by 404.php (ADR 010); the host would replace any error body Apache
    // generated itself with its 13-byte "404 Not Found".
    const missing = `/no-such-lesson-${Date.now()}/`;
    const problems = watch(page);
    const res = await page.goto(missing);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/page not found/i);
    await expect(page.locator('[data-nf-path]')).toHaveText(missing);
    await expect(page.locator('#browse-h')).toBeVisible();
    await shoot(page, info, '404');
    // The page's own 404 is the point of the test; nothing else may fail. (The
    // console line for it carries no URL; any other failed request still shows
    // up below by its URL.)
    expect(
      problems.filter(
        (p) =>
          !p.endsWith(missing) &&
          p !== 'console: Failed to load resource: the server responded with a status of 404 ()' &&
          p !==
            'console: Failed to load resource: the server responded with a status of 404 (Not Found)',
      ),
    ).toEqual([]);
  });
});
