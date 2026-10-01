import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Topics that still hold unwritten lessons, most-unwritten first.
 *  Coming-soon coverage shrinks with every publish batch, so the
 *  coming-soon tests below probe this list and use the first topic that
 *  still has a COMING SOON chip, instead of pinning one lesson that gets
 *  published out from under them. Refresh the list if all of these fill in. */
const COMING_SOON_CANDIDATES = [
  // Refreshed 2026-09-28: every India-side topic is fully published; only the
  // abroad packs still carry unwritten lessons.
  '/singapore-uae-southeast-asia/',
  '/uk-and-schengen/',
  '/universal-core/',
];

/** Returns the first candidate topic that still lists a coming-soon lesson,
 *  along with that lesson's URL. Null when everything on the list is published. */
async function findComingSoon(
  page: Page,
): Promise<{ topic: string; article: string; title: string } | null> {
  for (const topic of COMING_SOON_CANDIDATES) {
    await page.goto(topic);
    const link = page.locator('article.li-soon .li-title a').first();
    if ((await link.count()) > 0) {
      const article = await link.getAttribute('href');
      const title = (await link.textContent())?.trim();
      if (article && title) return { topic, article, title };
    }
  }
  return null;
}

/** A lesson's address has two parts, /{topic}/{lesson}/ (ADR 011). */
const LESSON_URL = /^\/[a-z0-9-]+\/[a-z0-9-]+\/$/;

/** Opens the global search overlay and returns its input.
 *  The trigger is a Preact island, so a click fired before hydration is a no-op —
 *  retry until the overlay's input actually shows up. */
async function openSearchOverlay(page: Page) {
  const trigger = page.getByRole('button', { name: /search lessons/i });
  const input = page.getByPlaceholder(/search lessons/i).first();
  await expect(async () => {
    await trigger.click();
    await expect(input).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return input;
}

test.describe('Homepage', () => {
  test('renders the hero, start-here lessons, featured clusters, topic index, and mission', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/civic sense, learnable/i);
    // At least one curated start-here row links to an article.
    await expect(page.locator('.start-link').first()).toBeVisible();
    await expect(page.locator('.start-link').first()).toHaveAttribute('href', /^\/.+\/$/);
    // Featured clusters: each is a <section> whose <h3> names (and links) the cluster.
    await expect(page.locator('.cluster').first()).toBeVisible();
    await expect(page.locator('.cluster h3 a').first()).toBeVisible();
    // Every navigable topic (11 India + 3 abroad) is one click away from the index.
    await expect(page.locator('#topics .topics-link')).toHaveCount(14);
    // Mission section below the fold.
    await expect(page.getByRole('heading', { name: /who this is for/i })).toBeVisible();
    // Its sheet closes the page on the footer: no empty band of page ground between.
    const mission = await page.locator('.mission').boundingBox();
    const footer = await page.locator('.footer').boundingBox();
    expect(Math.round(footer!.y - (mission!.y + mission!.height))).toBe(0);
    // The facts line no longer carries "Free. Fast. Multilingual."
    await expect(page.locator('.hero-facts')).toHaveText('India-rooted. World-applicable.');
    // "All lessons, by topic" leads to the catalog page.
    await expect(page.getByRole('link', { name: /all lessons, by topic/i })).toHaveAttribute(
      'href',
      '/topics/',
    );
  });
});

test.describe('Homepage pictures', () => {
  test('each featured topic leads with its lesson’s illustration or the topic’s cover', async ({
    page,
  }, info) => {
    await page.goto('/');
    const leads = page.locator('.cluster .lead');
    const n = await leads.count();
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i++) {
      const lead = leads.nth(i);
      const img = lead.locator('img.lead-img');
      const cover = lead.locator('.lead-cover');
      expect((await img.count()) + (await cover.count())).toBe(1);
      if ((await img.count()) > 0) {
        await expect(img).toHaveAttribute('src', /^https:\/\/ik\.imagekit\.io\/civic\//);
        await expect(img).toHaveAttribute('srcset', /240w.*560w/);
        // The title beside it is the link and names the lesson.
        await expect(img).toHaveAttribute('alt', '');
      } else {
        // Decorative: the topic's mark, printed twice (the off-register plate).
        await expect(cover).toHaveAttribute('aria-hidden', 'true');
        await expect(cover.locator('svg')).toHaveCount(2);
      }
    }

    // The lesson lists' size, an accent beside the words: on a wide screen at
    // most a third of the column and 240px, on the right, level with the title;
    // on a phone 40% of the column beside the title, the excerpt under both.
    const first = page.locator('.cluster').first();
    const pic = (await first.locator('.lead-pic').boundingBox())!;
    const lead = (await first.locator('.lead').boundingBox())!;
    const title = (await first.locator('.lead-title').boundingBox())!;
    expect(Math.abs(pic.y - title.y)).toBeLessThanOrEqual(8);
    expect(pic.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
    expect(Math.abs(pic.x + pic.width - (lead.x + lead.width))).toBeLessThanOrEqual(1);
    if (info.project.use.isMobile) {
      expect(Math.abs(pic.width - lead.width * 0.4)).toBeLessThanOrEqual(2);
      const excerpt = (await first.locator('.lead-excerpt').boundingBox())!;
      expect(excerpt.y).toBeGreaterThanOrEqual(
        Math.max(title.y + title.height, pic.y + pic.height) - 1,
      );
      expect(Math.abs(excerpt.width - lead.width)).toBeLessThanOrEqual(1);
    } else {
      expect(pic.width).toBeLessThanOrEqual(240.5);
      expect(pic.width).toBeLessThanOrEqual(lead.width * 0.34 + 1);
    }
    expect(Math.abs(pic.width / pic.height - 16 / 9)).toBeLessThan(0.02);
  });
});

test.describe('Topics catalog page', () => {
  test('lists every topic with every lesson, open, with reading times', async ({ page }, info) => {
    await page.goto('/topics/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/topics and lessons/i);
    await expect(page.getByRole('heading', { name: /in and around india/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /for your trip abroad/i })).toBeVisible();
    // Two levels: the facts count topics and lessons, nothing in between.
    await expect(page.locator('.tp-facts')).toContainText(/14 topics/);
    await expect(page.locator('.tp-facts')).not.toContainText(/subtopic/i);
    // No accordions for the content: every topic's lessons are on the page.
    await expect(page.locator('.tp-topic')).toHaveCount(15); // 14 topics + visitors
    const traffic = page.locator('#traffic');
    await expect(traffic.getByRole('link', { name: /the case against honking/i })).toHaveAttribute(
      'href',
      '/traffic/the-case-against-honking/',
    );
    // Each row says how long the lesson takes, or that it is still being written.
    await expect(traffic.locator('.lx-meta').first()).toHaveText(/^\d+ min read$|^coming soon$/i);
    const hrefs = await page
      .locator('.lx-link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(100);
    expect(hrefs.filter((h) => !LESSON_URL.test(h))).toEqual([]);
    await expect(traffic.locator('.tp-browse')).toHaveAttribute('href', '/traffic/');
    // The page's own index jumps to a topic's block; on phones it is folded
    // behind one line first.
    const jump = page.locator('[data-tp-jump]');
    if (info.project.use.isMobile) {
      await expect(jump).not.toHaveAttribute('open', '');
      await page.locator('.tp-jump-summary').click();
    } else {
      await expect(jump).toHaveAttribute('open', '');
    }
    await page.locator('.tp-jump-row', { hasText: 'Queues, lines, and waiting' }).click();
    await expect(page).toHaveURL(/#queues-and-waiting$/);
    await expect(page.locator('#queues-and-waiting h3')).toBeInViewport();
  });
});

test.describe('Topic pages', () => {
  test('a topic page lists every lesson in the topic, beside the topics sidebar', async ({
    page,
  }) => {
    await page.goto('/traffic/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/traffic and roads/i);
    // The current page is the last crumb, after Home.
    await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
    await expect(page.locator('.breadcrumb [aria-current="page"]')).toContainText(
      /traffic and roads/i,
    );
    // What the topic covers, then one line of facts.
    await expect(page.locator('.head-lede')).not.toBeEmpty();
    await expect(page.locator('.head-facts')).toContainText(/\d+ lessons?/i);
    // The lessons themselves, directly under the topic (ADR 011).
    await expect(page.getByRole('heading', { name: /the case against honking/i })).toBeVisible();
    await expect(page.getByText(/3 min read/i).first()).toBeVisible();
    const hrefs = await page
      .locator('.article-list .li-title a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs.filter((h) => !/^\/traffic\/[a-z0-9-]+\/$/.test(h))).toEqual([]);
    // The sidebar is the fourteen topics, this one current; no subtopic lists.
    await expect(page.locator('.sb-topic')).toHaveCount(14);
    await expect(page.locator('.sb-topic.active')).toContainText('Traffic and roads');
    await expect(page.locator('.sb-topic.active')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.sidebar details')).toHaveCount(0);
  });

  test('lesson rows show a lesson’s illustration large, on the right; no "More in"', async ({
    page,
  }, info) => {
    await page.goto('/spitting-and-hygiene/');
    const thumb = page.locator('.li.has-thumb .li-thumb').first();
    await thumb.scrollIntoViewIfNeeded();
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    const box = (await thumb.boundingBox())!;
    const row = (await page.locator('.li.has-thumb').first().boundingBox())!;
    // Beside the text, at the row's right edge, and big enough to read.
    expect(Math.round(box.x + box.width)).toBe(Math.round(row.x + row.width));
    expect(box.width).toBeGreaterThanOrEqual(info.project.use.isMobile ? 120 : 220);
    // The page ends with its lessons: the sibling list ("More in …") is gone.
    await expect(page.getByRole('heading', { name: /^more in /i })).toHaveCount(0);
  });

  test('a topic page mixes published and coming-soon articles', async ({ page }) => {
    const found = await findComingSoon(page);
    test.skip(!found, 'every candidate topic is fully published');
    // Same page still lists at least one published lesson alongside the chip.
    await expect(page.locator('.li-soon-badge').first()).toBeVisible();
    await expect(page.locator('article.li:not(.li-soon)').first()).toBeVisible();
  });
});

test.describe('Article page (real)', () => {
  test('renders title, TL;DR, body, sources, related, and quiz', async ({ page }) => {
    await page.goto('/traffic/the-case-against-honking/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/honking/i);
    // The trail stops at the topic, which stays a link (the article is the page).
    await expect(page.locator('.breadcrumb a').last()).toHaveAttribute('href', '/traffic/');
    await expect(page.locator('.breadcrumb a')).toHaveCount(2);
    await expect(page.getByText(/TL;DR/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /sources/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /quick check/i })).toBeVisible();
    // The ending is one "Up next" card; the "More lessons" list is gone.
    await expect(page.getByRole('heading', { name: /^up next$/i })).toBeVisible();
    await expect(page.locator('.related .next')).toHaveCount(1);
    await expect(page.locator('.related .next')).toHaveAttribute('href', LESSON_URL);
    await expect(page.getByText(/^more lessons$/i)).toHaveCount(0);
  });

  test('renders the ShareBar at the top and bottom with per-platform links', async ({ page }) => {
    await page.goto('/traffic/the-case-against-honking/');
    await expect(page.locator('.sharebar-compact')).toHaveCount(1); // top
    await expect(page.locator('.sharebar-full')).toHaveCount(1); // bottom
    // The bottom bar exposes the per-platform fallback links + copy.
    const full = page.locator('.sharebar-full');
    await expect(full.getByRole('link', { name: /share on whatsapp/i })).toBeVisible();
    await expect(full.getByRole('link', { name: /share on x/i })).toBeVisible();
    await expect(full.getByRole('button', { name: /copy link/i })).toBeVisible();
    // The four platforms show their own marks; email and copy use Lucide icons.
    await expect(full.locator('svg.icon-brand')).toHaveCount(4);
    await expect(full.locator('svg.lucide-mail')).toHaveCount(1);
    await expect(full.locator('svg.lucide-link')).toHaveCount(1);
  });

  test('clicking a quiz option reveals per-option feedback', async ({ page }) => {
    await page.goto('/traffic/the-case-against-honking/');
    const firstOpt = page.locator('.quiz-opt').first();
    await firstOpt.scrollIntoViewIfNeeded();
    // The quiz is a Preact island: it renders server-side, so a click that lands
    // before hydration is silently dropped. Retry until the feedback appears.
    await expect(async () => {
      await firstOpt.click();
      // Feedback text appears below the picked option
      await expect(page.locator('.quiz-feedback').first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    // Hydration keeps the server's text: the number once, not "1.." (it did).
    await expect(page.locator('.quiz-q-num').first()).toHaveText('1.');
    // The verdict is a Lucide icon on the picked option's disc.
    await expect(firstOpt.locator('.quiz-opt-marker svg.lucide')).toHaveCount(1);
  });
});

test.describe('Article page (coming-soon)', () => {
  test('renders the placeholder body for a planned-but-unpublished lesson', async ({ page }) => {
    const found = await findComingSoon(page);
    test.skip(!found, 'every candidate topic is fully published');
    expect(found!.article).toMatch(LESSON_URL);
    await page.goto(found!.article);
    await expect(page.locator('.ah-soon-badge')).toContainText(/coming soon/i);
    await expect(page.locator('.cs-status')).toContainText(/lesson is being written/i);
    // The stub leads somewhere: the topic's nearest readable lesson ("Meanwhile,
    // in {topic}", one card), then every lesson in the topic.
    const topicName = (await page.locator('.breadcrumb a').last().textContent())!.trim();
    await expect(page.locator('.cs .related-title')).toHaveText(`Meanwhile, in ${topicName}`);
    await expect(page.locator('.cs .related .next')).toHaveAttribute('href', LESSON_URL);
    await expect(page.locator('.cs .related .next-where')).toContainText(topicName);
    await expect(page.locator('.cs-all')).toHaveAttribute('href', found!.topic);
    // The breadcrumb's topic crumb is a real link, not the "current page".
    await expect(page.locator('.breadcrumb a').last()).toHaveAttribute('href', found!.topic);
    await expect(page.locator('.breadcrumb [aria-current="page"]')).toHaveCount(0);
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
  test('overlay opens and finds a published article', async ({ page }) => {
    await page.goto('/');
    const input = await openSearchOverlay(page);
    await input.fill('honking');
    // Wait for Pagefind to load + debounce settle.
    await expect(page.getByText(/honking/i).first()).toBeVisible({ timeout: 5_000 });
    // A published hit renders without the .soon modifier (and so without the chip).
    await expect(page.locator('.search-result:not(.soon)').first()).toBeVisible();
    // The overlay hands over to the shareable results page.
    await expect(page.locator('.search-see-all')).toHaveAttribute('href', '/search/?q=honking');
  });

  test('closes on a click outside the panel, with a query typed', async ({ page }, info) => {
    test.skip(!!info.project.use.isMobile, 'on phones the panel fills the screen');
    await page.goto('/');
    const input = await openSearchOverlay(page);
    await input.fill('honking');
    await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 5_000 });
    // The backdrop covers the whole page, not just the top bar.
    const panel = (await page.locator('.search-panel').boundingBox())!;
    const viewport = page.viewportSize()!;
    const outside = { x: 16, y: Math.min(panel.y + panel.height + 24, viewport.height - 16) };
    await page.mouse.click(outside.x, outside.y);
    await expect(page.locator('.search-overlay')).toHaveCount(0);
  });

  test('shows a loading state while a slow search runs', async ({ page }) => {
    // Slow the index down, as a first search on a slow connection would be.
    await page.route('**/pagefind/**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.goto('/');
    const input = await openSearchOverlay(page);
    await input.fill('queue');
    await expect(page.locator('.search-input-row .search-loading')).toBeVisible();
    await expect(page.locator('.search-results')).toContainText(/searching/i);
    await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.search-input-row .search-loading')).toHaveCount(0);
  });

  test('arrow keys keep the highlighted result in view', async ({ page }) => {
    await page.goto('/');
    const input = await openSearchOverlay(page);
    await input.fill('queue');
    const rows = page.locator('.search-result');
    await expect(rows.nth(10)).toBeAttached({ timeout: 5_000 });
    const count = await rows.count();
    const highlightedInView = () =>
      page.evaluate(() => {
        const field = document.querySelector('.search-input')!;
        const row = document.getElementById(field.getAttribute('aria-activedescendant') ?? '');
        const list = document.querySelector('.search-results')!.getBoundingClientRect();
        const r = row?.getBoundingClientRect();
        return !!r && r.top >= list.top - 1 && r.bottom <= list.bottom + 1;
      });
    // Down to the last row, as a held key would, then back up to the first.
    for (let i = 1; i < count; i++) await input.press('ArrowDown');
    await expect(rows.last()).toHaveAttribute('aria-selected', 'true');
    expect(await highlightedInView()).toBe(true);
    for (let i = 1; i < count; i++) await input.press('ArrowUp');
    await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
    expect(await highlightedInView()).toBe(true);
  });

  test('flags coming-soon results with a chip', async ({ page }) => {
    // Search the unwritten lesson by its own title so it ranks into the results,
    // rather than pinning a query whose lesson later gets published.
    const found = await findComingSoon(page);
    test.skip(!found, 'every candidate topic is fully published');
    await page.goto('/');
    const input = await openSearchOverlay(page);
    await input.fill(found!.title.replace(/[^\w\s]/g, ' '));
    await expect(page.locator('.search-result-chip').first()).toContainText(/coming soon/i, {
      timeout: 5_000,
    });
  });
});

test.describe('Search page', () => {
  test('a shared ?q= renders results in the search row and keeps the URL current', async ({
    page,
  }) => {
    await page.goto('/search/?q=honking');
    await expect(page.locator('.sp-list .search-result').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.sp-status')).toContainText(/lessons match/i);
    // The match is marked inside a lesson-text excerpt.
    await expect(page.locator('.sp-list .search-result-excerpt mark').first()).toBeVisible();
    // The topic index steps aside while results show.
    await expect(page.locator('#search-browse')).toBeHidden();
    // Typing over the shared query rewrites the URL, so the page stays shareable.
    await page
      .getByPlaceholder(/search lessons/i)
      .first()
      .fill('chlorine');
    await expect(page).toHaveURL(/\/search\/\?q=chlorine$/);
    await expect(page.locator('.sp-status')).toContainText(/chlorine/i);
  });

  test('a result for a lesson with an illustration shows it on the right', async ({ page }) => {
    await page.goto('/search/?q=paan');
    const thumb = page.locator('.sp-list .search-result.has-thumb .search-result-thumb').first();
    await expect(thumb).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test('the field shows a loading state while a slow search runs', async ({ page }) => {
    await page.route('**/pagefind/**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.goto('/search/?q=honking');
    await expect(page.locator('.sp-field .search-loading')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.sp-status')).toHaveText(/searching/i);
    await expect(page.locator('.sp-list .search-result').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.sp-field .search-loading')).toHaveCount(0);
  });

  test('the empty state focuses the field and offers the topic index and examples', async ({
    page,
  }) => {
    await page.goto('/search/');
    await expect(page.getByPlaceholder(/search lessons/i).first()).toBeFocused();
    await expect(page.locator('#search-browse .topics-link')).toHaveCount(14);
    // An example query runs the search (as a link it also works before hydration).
    await page.locator('.sp-example').first().click();
    await expect(page.locator('.sp-list .search-result').first()).toBeVisible({ timeout: 10_000 });
  });

  test('a query with no matches says so and keeps the topic index as the way out', async ({
    page,
  }) => {
    await page.goto('/search/?q=zzzzqq');
    await expect(page.locator('.sp-status')).toContainText(/no lessons found/i, {
      timeout: 10_000,
    });
    await expect(page.locator('#search-browse')).toBeVisible();
  });
});

test.describe('Theme menu', () => {
  /** The menu is a Preact island (client:idle): a click before hydration is
   *  dropped, so opening retries until the menu shows (as in the search tests). */
  async function openThemeMenu(page: Page) {
    const menu = page.getByRole('menu', { name: 'Theme' });
    await expect(async () => {
      if (!(await menu.isVisible())) await page.locator('.theme-toggle').click();
      await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    return menu;
  }
  const item = (menu: ReturnType<Page['getByRole']>, name: string) =>
    menu.getByRole('menuitemradio', { name, exact: true });
  const themeColours = (page: Page) =>
    page
      .locator('meta[name="theme-color"]')
      .evaluateAll((ms) => ms.map((m) => m.getAttribute('content')));

  test('starts on System, ticks the mode in use, and a choice survives a reload', async ({
    page,
  }, info) => {
    const device = info.project.use.colorScheme === 'dark' ? 'dark' : 'light';
    const other = device === 'dark' ? 'light' : 'dark';
    const otherName = other === 'dark' ? 'Dark' : 'Light';
    const html = page.locator('html');
    await page.goto('/');
    await expect(html).toHaveAttribute('data-theme', device);
    await expect(html).toHaveAttribute('data-theme-mode', 'system');
    const builtColours = await themeColours(page);

    let menu = await openThemeMenu(page);
    await expect(menu.getByRole('menuitemradio')).toHaveCount(3);
    await expect(item(menu, 'System')).toHaveAttribute('aria-checked', 'true');
    await expect(item(menu, otherName)).toHaveAttribute('aria-checked', 'false');

    // The theme the device is not using, so the page visibly changes.
    await item(menu, otherName).click();
    await expect(menu).toBeHidden();
    await expect(html).toHaveAttribute('data-theme', other);
    await expect(page.locator('.theme-toggle')).toBeFocused();
    await expect(page.locator('.theme-toggle')).toHaveAccessibleName(`Theme: ${otherName}`);
    expect(await page.evaluate(() => localStorage.getItem('lcs-theme'))).toBe(other);
    // The phone's browser bar follows the fixed choice.
    expect(new Set(await themeColours(page)).size).toBe(1);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', other);
    await expect(html).toHaveAttribute('data-theme-mode', other);
    expect(new Set(await themeColours(page)).size).toBe(1);

    // Back to System: nothing stored, the device decides again, the bar too.
    menu = await openThemeMenu(page);
    await expect(item(menu, otherName)).toHaveAttribute('aria-checked', 'true');
    await item(menu, 'System').click();
    await expect(html).toHaveAttribute('data-theme', device);
    await expect(html).toHaveAttribute('data-theme-mode', 'system');
    expect(await page.evaluate(() => localStorage.getItem('lcs-theme'))).toBeNull();
    expect(await themeColours(page)).toEqual(builtColours);
  });

  test('System follows a change of the device setting live; a fixed choice holds', async ({
    page,
  }) => {
    const html = page.locator('html');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(html).toHaveAttribute('data-theme', 'light');
    // The listener lives in the island: open and close the menu to know it hydrated.
    const menu = await openThemeMenu(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-theme', 'light');

    await item(await openThemeMenu(page), 'Light').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    // Give a (wrong) repaint the chance to happen before asserting it did not.
    await page.waitForTimeout(300);
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('works from the keyboard', async ({ page }, info) => {
    test.skip(!!info.project.use.isMobile, 'keyboard use is tested on desktop');
    await page.goto('/');
    const button = page.locator('.theme-toggle');
    const menu = await openThemeMenu(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    // The arrow key opens the menu on the ticked item (System, the default).
    await page.keyboard.press('ArrowDown');
    await expect(menu).toBeVisible();
    await expect(item(menu, 'System')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(item(menu, 'Light')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item(menu, 'Dark')).toBeFocused();
    await page.keyboard.press('End');
    await expect(item(menu, 'System')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item(menu, 'Light')).toBeFocused();

    // Escape closes and returns to the button; Enter reopens; Enter chooses.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(item(menu, 'System')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(item(menu, 'Dark')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(button).toBeFocused();
  });

  test('closes on a click outside, choosing nothing', async ({ page }) => {
    await page.goto('/');
    const menu = await openThemeMenu(page);
    await page.mouse.click(10, 400);
    await expect(menu).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system');
    expect(await page.evaluate(() => localStorage.getItem('lcs-theme'))).toBeNull();
  });

  test('names the current mode in the site’s own tooltip, hidden by Escape and by the menu', async ({
    page,
  }, info) => {
    test.skip(!!info.project.use.isMobile, 'hover tooltips are for pointer devices');
    await page.goto('/');
    const button = page.locator('.theme-toggle');
    const tip = page.locator('.theme-tip');
    // No browser-native title bubble on top of ours.
    await expect(button).not.toHaveAttribute('title', /.+/);
    await expect(tip).toHaveCSS('opacity', '0');
    const hoverUntilShown = async () =>
      expect(async () => {
        await page.mouse.move(0, 400);
        await button.hover();
        await expect(tip).toHaveCSS('opacity', '1', { timeout: 1_000 });
      }).toPass({ timeout: 15_000 });
    await hoverUntilShown();
    await expect(tip).toHaveText('Theme: System');
    // The tooltip repeats the button's name, so it is hidden from assistive tech.
    await expect(button).toHaveAccessibleName('Theme: System');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCSS('opacity', '0');

    await hoverUntilShown();
    await openThemeMenu(page);
    await expect(tip).toHaveCSS('opacity', '0');
  });
});

test.describe('Language menu', () => {
  /** A Preact island (client:idle), opened with retries like the theme menu. */
  async function openLanguageMenu(page: Page) {
    const menu = page.getByRole('menu', { name: 'Language' });
    await expect(async () => {
      if (!(await menu.isVisible())) await page.locator('.lang-toggle').click();
      await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    return menu;
  }

  test('is in the top bar of every kind of page, English by default', async ({ page }) => {
    for (const url of [
      '/',
      '/traffic/',
      '/traffic/the-case-against-honking/',
      '/topics/',
      '/search/',
      '/about/',
      '/feedback/',
      '/zzqq-xxyy/',
    ]) {
      await page.goto(url);
      await expect(page.locator('.topbar .lang-toggle')).toHaveAccessibleName('Language: English');
    }
  });

  test('offers English, ticked, and Hindi as coming soon', async ({ page }) => {
    await page.goto('/about/');
    const menu = await openLanguageMenu(page);
    const items = menu.getByRole('menuitemradio');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAccessibleName('English');
    await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(items.nth(1)).toHaveText(/हिन्दी\s*Hindi\s*Coming soon/i);
    await expect(items.nth(1)).toHaveAttribute('aria-checked', 'false');
    await expect(items.nth(1)).toHaveAttribute('aria-disabled', 'true');
    await expect(items.nth(1).locator('[lang="hi"]')).toHaveText('हिन्दी');

    // Hindi can't be chosen yet: a click (forced, since it is marked disabled)
    // leaves the page as it is, in English, with the menu still open.
    await items.nth(1).click({ force: true });
    await expect(menu).toBeVisible();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');

    // English is already in use: choosing it just closes the menu.
    await items.nth(0).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('.lang-toggle')).toBeFocused();
  });

  test('works from the keyboard, and reaches Hindi to say it is coming', async ({ page }, info) => {
    test.skip(!!info.project.use.isMobile, 'keyboard use is tested on desktop');
    await page.goto('/about/');
    const button = page.locator('.lang-toggle');
    const menu = await openLanguageMenu(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    await page.keyboard.press('ArrowDown');
    const items = menu.getByRole('menuitemradio');
    await expect(items.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Home');
    await expect(items.nth(0)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('closes on a click outside, and when the theme menu opens', async ({ page }) => {
    await page.goto('/');
    const menu = await openLanguageMenu(page);
    await page.mouse.click(10, 400);
    await expect(menu).toBeHidden();

    await openLanguageMenu(page);
    await page.locator('.theme-toggle').click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole('menu', { name: 'Theme' })).toBeVisible();
  });

  test('fits the top bar at 320px without a sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/traffic/the-case-against-honking/');
    const toggle = page.locator('.lang-toggle');
    await expect(toggle).toBeVisible();
    // Only the icon on a phone; the name still says the language.
    await expect(page.locator('.lang-toggle-label')).toBeHidden();
    await expect(toggle).toHaveAccessibleName('Language: English');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    const menu = await openLanguageMenu(page);
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });
});

test.describe('About, Privacy and Terms', () => {
  test('share one layout: a trail home, a heading, a lede, facts, then side-heading sections', async ({
    page,
  }) => {
    const pages: Array<[string, string]> = [
      ['/about/', 'About Learn Civic Sense'],
      ['/privacy/', 'Privacy policy'],
      ['/terms/', 'Terms of use'],
    ];
    for (const [url, h1] of pages) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
      await expect(page.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/');
      await expect(page.locator('.info-lede')).not.toBeEmpty();
      await expect(page.locator('.info-facts')).toBeVisible();
      // Every section has an address from its heading, and its name is an h2.
      const sections = page.locator('.info-section');
      expect(await sections.count()).toBeGreaterThanOrEqual(4);
      for (const id of await sections.evaluateAll((s) => s.map((x) => x.id))) {
        expect(id).toMatch(/^[a-z0-9-]+$/);
      }
      await expect(sections.first().locator('h2')).toBeVisible();
    }
  });

  test('About: the library in numbers, the homepage’s audience, lessons to start with; no roadmap', async ({
    page,
  }) => {
    await page.goto('/');
    const mission = (await page.locator('.mission-body p').first().textContent())?.trim();
    await page.goto('/about/');
    await expect(page.locator('.info-facts > span:not(.info-sep)')).toHaveText([
      /^\d+ topics$/,
      /^\d+ lessons$/,
    ]);
    await expect(page.getByRole('heading', { name: /roadmap/i })).toHaveCount(0);
    // One source for "Who this is for": the homepage's words.
    await expect(page.locator('#who-this-is-for p').first()).toHaveText(mission!);
    await expect(page.locator('#how-the-content-is-built')).toContainText(
      'Sources are linked at the end of each lesson that cites them.',
    );
    const starts = page.locator('.about-start-link');
    expect(await starts.count()).toBeGreaterThanOrEqual(3);
    for (const href of await starts.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      expect(href).toMatch(LESSON_URL);
    }
    await expect(page.locator('.about-next a')).toHaveText([
      'All lessons, by topic',
      'Send feedback',
    ]);
  });

  test('Privacy: dated, points to the host’s cookies first, and keeps the feedback address', async ({
    page,
  }) => {
    await page.goto('/privacy/');
    await expect(page.locator('.info-facts time')).toHaveAttribute('datetime', '2026-09-29');
    const pointer = page.locator('#what-this-site-collects a[href="#what-others-see"]');
    await expect(pointer).toHaveText('What others see');
    await pointer.click();
    await expect(page).toHaveURL(/#what-others-see$/);
    // Arriving draws the section's rule in the brand colour.
    await expect(page.locator('#what-others-see')).toHaveCSS('border-top-width', '2px');
    // The feedback form's "How feedback is handled" link lands here.
    await page.goto('/feedback/');
    await page.getByRole('link', { name: 'How feedback is handled' }).click();
    await expect(page).toHaveURL(/\/privacy\/#feedback$/);
    await expect(page.locator('#feedback h2')).toHaveText('The feedback form');
  });

  test('Terms: accurate about the code, the site and the sources', async ({ page }) => {
    await page.goto('/terms/');
    await expect(page.locator('.info-facts time')).toHaveAttribute('datetime', '2026-09-29');
    await expect(page.locator('#source-code')).toContainText(
      'The content license above covers the lessons, not the code.',
    );
    await expect(page.locator('#acceptable-use')).toContainText('strains the site');
    await expect(page.locator('#no-warranty')).toContainText('link the sources they cite');
    await expect(page.locator('main')).not.toContainText(/open source|CDN/);
  });

  test('links in the text are underlined, not marked by colour alone', async ({ page }) => {
    await page.goto('/privacy/');
    const link = page.locator('#your-choices a').first();
    await expect(link).toHaveCSS('border-bottom-style', 'solid');
    await expect(link).toHaveCSS('border-bottom-width', '1px');
  });
});

test.describe('Footer', () => {
  test('lists About, Feedback, Privacy and Terms, in that order', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.footer-nav a');
    await expect(links).toHaveText(['About', 'Feedback', 'Privacy', 'Terms']);
    expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([
      '/about/',
      '/feedback/',
      '/privacy/',
      '/terms/',
    ]);
  });
});

test.describe('Feedback form', () => {
  // `astro preview` runs no PHP, so /feedback.php is answered here the way the
  // real endpoint answers (scripts/test-feedback-endpoint.mjs tests that one).
  const TYPES = ['New articles', 'Correction in article', 'Report something', 'Others'];

  test('the footer links to it, on every kind of page', async ({ page }) => {
    for (const url of ['/', '/traffic/', '/traffic/the-case-against-honking/', '/privacy/']) {
      await page.goto(url);
      await expect(page.locator('.footer-nav a[href="/feedback/"]')).toHaveText('Feedback');
    }
  });

  test('asks for a type and up to 500 characters, takes no file, stays out of search', async ({
    page,
  }) => {
    await page.goto('/feedback/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Send feedback');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const form = page.locator('form[data-fb-form]');
    await expect(form).toHaveAttribute('action', '/feedback.php');
    await expect(form).toHaveAttribute('method', 'post');
    const type = page.getByLabel('What is it about?');
    await expect(type).toHaveAttribute('required', '');
    await expect(type.locator('option:not([disabled])')).toHaveText(TYPES);
    const message = page.getByLabel('Your message');
    await expect(message).toHaveAttribute('maxlength', '500');
    await expect(message).toHaveAttribute('required', '');
    // No attachments, in any form.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(form).not.toHaveAttribute('enctype', /multipart/);
    // The trap field is there for bots, out of sight and out of the tab order.
    const trap = page.locator('input[name="website"]');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    await expect(trap).not.toBeInViewport();
  });

  test('sends in place and says thank you', async ({ page }) => {
    const sent = { body: '', accept: '' };
    await page.route('**/feedback.php', async (route) => {
      sent.body = route.request().postData() ?? '';
      sent.accept = route.request().headers().accept ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true,"code":"sent"}',
      });
    });
    await page.goto('/feedback/');
    await expect(page.locator('form[data-fb-form][data-ready]')).toHaveCount(1);
    await page.getByLabel('What is it about?').selectOption({ label: 'Correction in article' });
    await page.getByLabel('Your message').fill('The fine in the table is out of date.');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    const thanks = page.getByRole('heading', { name: 'Thank you. Your feedback was sent.' });
    await expect(thanks).toBeVisible();
    await expect(thanks).toBeFocused();
    await expect(page.locator('form[data-fb-form]')).toBeHidden();
    const params = new URLSearchParams(sent.body);
    expect(params.get('type')).toBe('correction');
    expect(params.get('message')).toBe('The fine in the table is out of date.');
    expect(params.get('website')).toBe('');
    expect(sent.accept).toContain('application/json');
    // And the form comes back, empty, for another message.
    await page.getByRole('button', { name: 'Send more feedback' }).click();
    await expect(page.getByLabel('What is it about?')).toBeFocused();
    await expect(page.getByLabel('Your message')).toHaveValue('');
  });

  test('a refused message keeps its text and says why', async ({ page }) => {
    await page.route('**/feedback.php', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: '{"ok":false,"code":"rate"}',
      }),
    );
    await page.goto('/feedback/');
    await expect(page.locator('form[data-fb-form][data-ready]')).toHaveCount(1);
    await page.getByLabel('What is it about?').selectOption({ label: 'Others' });
    await page.getByLabel('Your message').fill('Please add a lesson on lift etiquette.');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'You’ve sent several messages in a short time. Please try again later.',
    );
    await expect(page.getByLabel('Your message')).toHaveValue(
      'Please add a lesson on lift etiquette.',
    );
    await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
  });

  test('the counter follows the typing and speaks near the limit', async ({ page }) => {
    await page.goto('/feedback/');
    await expect(page.locator('form[data-fb-form][data-ready]')).toHaveCount(1);
    await page.getByLabel('Your message').fill('a'.repeat(480));
    await expect(page.locator('[data-fb-count]')).toHaveText('480 / 500');
    await expect(page.locator('[data-fb-count]')).toHaveClass(/is-near/);
    await expect(page.locator('[data-fb-live]')).toHaveText('20 characters left');
  });

  test('without JavaScript, both result pages lead back', async ({ page }) => {
    await page.goto('/feedback/sent/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Thank you. Your feedback was sent.',
    );
    await expect(page.getByRole('link', { name: 'Send more feedback' })).toHaveAttribute(
      'href',
      '/feedback/',
    );
    await page.goto('/feedback/not-sent/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your feedback wasn’t sent');
    await expect(page.getByRole('link', { name: 'Back to the form' })).toHaveAttribute(
      'href',
      '/feedback/',
    );
  });
});

test.describe('Top bar', () => {
  test('is identical and sticky on every primary page', async ({ page }) => {
    for (const url of [
      '/',
      '/traffic/',
      '/traffic/the-case-against-honking/',
      '/topics/',
      '/visitors/',
      '/search/',
    ]) {
      await page.goto(url);
      await expect(page.locator('.topbar')).toBeVisible();
      await expect(page.locator('.brand-name')).toContainText('Learn Civic Sense');
    }
  });
});

test.describe('404', () => {
  // Locally `astro preview` answers unknown routes with 404.html; on the host
  // public/404.php does (ADR 010). Either way: status 404, the site's own page.
  test('a mistyped lesson address answers 404 and names the lesson it meant', async ({ page }) => {
    const typo = '/traffic/the-case-against-honkng/';
    const res = await page.goto(typo);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/page not found/i);
    await expect(page.locator('[data-nf-path]')).toHaveText(typo);
    // The answer, found by the address's words despite the typo.
    const title = page.locator('.nf-answer-title');
    await expect(title).toHaveAttribute('href', '/traffic/the-case-against-honking/', {
      timeout: 15_000,
    });
    await expect(page.locator('.nf-answer')).toContainText(/were you looking for/i);
    // The search stays a way to correct the address, now the second way out.
    await expect(page.locator('[data-nf-query]')).toHaveValue('case against honkng');
    await expect(page.locator('[data-nf]')).toHaveAttribute('data-state', 'found');
    // The curated lessons never change under the reader.
    await expect(page.locator('.nf-link')).toHaveCount(5);
  });

  test('an address that matches nothing says so and keeps the lessons and topics', async ({
    page,
  }) => {
    const res = await page.goto('/zzqq-xxyy/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('[data-nf-path]')).toHaveText('/zzqq-xxyy/');
    // Pagefind "matches" nonsense to something; nothing sharing a word is offered.
    await expect(page.locator('.nf-answer')).toContainText(/no lesson matches/i, {
      timeout: 15_000,
    });
    await expect(page.locator('.nf-answer-title')).toHaveCount(0);
    await expect(page.locator('[data-nf-query]')).toHaveValue('');
    await expect(page.locator('.nf-link')).toHaveCount(5);
    await expect(page.locator('#browse-h ~ .topics-group .topics-link')).toHaveCount(14);
    // The search works without JavaScript too: a plain GET to /search/.
    await expect(page.locator('form.nf-search')).toHaveAttribute('action', '/search/');
  });
});
