import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INDEXNOW_KEY, normalizeHtml, sitemapUrls, changedUrls } from '../../scripts/indexnow.mjs';

// IndexNow is how a deploy tells Bing which pages changed (scripts/indexnow.mjs,
// run by .github/workflows/deploy.yml).

describe('IndexNow', () => {
  it('serves its key at /<key>.txt, as IndexNow checks', () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
    expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8')).toBe(INDEXNOW_KEY);
  });

  it("compares pages without the host's injected script or per-build island ids", () => {
    const host =
      "<script>'undefined'=== typeof _trfq || (window._trfq = []);_trfd.push({'a':'b'})</script>" +
      "<script src='https://img1.wsimg.com/traffic-assets/js/tccl.min.js'></script>";
    const built = '<body><astro-island uid="Z1abc" x="1"></astro-island></body></html>';
    const served = `<body><astro-island uid="Zq9" x="1"></astro-island></body>${host}</html>`;
    expect(normalizeHtml(served)).toBe(normalizeHtml(built));
    expect(normalizeHtml(served)).not.toBe(normalizeHtml(built.replace('x="1"', 'x="2"')));
  });

  it('submits new and changed pages, then pages the sitemap no longer lists', () => {
    const xml =
      '<urlset><url><loc>https://learncivicsense.in/</loc></url>' +
      '<url><loc>https://learncivicsense.in/a/</loc><lastmod>2026-06-04</lastmod></url></urlset>';
    expect(sitemapUrls(xml)).toEqual([
      'https://learncivicsense.in/',
      'https://learncivicsense.in/a/',
    ]);
    expect(
      changedUrls(['/', '/a/', '/b/'], ['/', '/a/', '/gone/'], (u: string) => u === '/b/'),
    ).toEqual(['/b/', '/gone/']);
  });
});
