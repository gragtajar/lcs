import { describe, it, expect } from 'vitest';
import { sitemapEntries, sitemapNode, xmlEscape } from '../../src/lib/sitemap';
import { getNavCategories, articleUrl } from '../../src/lib/content';

describe('sitemapEntries()', () => {
  const entries = sitemapEntries();
  const paths = entries.map((e) => e.path);

  it('lists each page once, starting with the homepage', () => {
    expect(paths[0]).toBe('/');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('lists every topic and every readable lesson, and no lesson still being written', () => {
    for (const cat of getNavCategories()) {
      expect(paths).toContain(`/${cat.id}/`);
      for (const article of cat.articles) {
        expect(paths.includes(articleUrl(article)), article.id).toBe(article.published);
      }
    }
  });

  it('leaves out the pages kept out of search', () => {
    for (const path of ['/search/', '/visitors/', '/feedback/']) expect(paths).not.toContain(path);
  });

  it("dates a lesson by its own last update, and a topic by its newest lesson's", () => {
    for (const e of entries.filter((x) => x.lastmod)) {
      expect(e.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const traffic = entries.find((e) => e.path === '/traffic/');
    const trafficLessons = entries.filter((e) => e.path.startsWith('/traffic/') && e !== traffic);
    expect(traffic?.lastmod).toBe(
      trafficLessons
        .map((e) => e.lastmod ?? '')
        .sort()
        .pop(),
    );
    // Pages with no dated content of their own carry no date at all.
    expect(entries.find((e) => e.path === '/about/')).toEqual({ path: '/about/' });
  });
});

describe('sitemapNode() / xmlEscape()', () => {
  it('writes an absolute, escaped address with its date when it has one', () => {
    expect(sitemapNode('url', '/a&b/', '2026-06-04')).toBe(
      '  <url><loc>https://learncivicsense.in/a&amp;b/</loc><lastmod>2026-06-04</lastmod></url>',
    );
    expect(sitemapNode('sitemap', '/sitemap-images.xml')).toBe(
      '  <sitemap><loc>https://learncivicsense.in/sitemap-images.xml</loc></sitemap>',
    );
    expect(xmlEscape(`<"'>`)).toBe('&lt;&quot;&apos;&gt;');
  });
});
