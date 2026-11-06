// The page sitemap: every page search engines should index, each with the date
// its content last changed.
//
// Built from the lessons themselves rather than from the list of built pages:
// pages that are kept out of search (coming-soon lessons, /search/, /visitors/,
// /feedback/, the 404) are left out, and a lesson's date is its own
// `last_updated`, not the build time. Google uses lastmod only while it stays
// accurate; a date that moves on every deploy teaches it to ignore the field.
// tests/e2e/smoke.spec.ts checks that every built page is either listed here or
// marked noindex.

import { getNavCategories, loadLessonForArticle, articleUrl, categoryUrl } from './content';

export const SITE_ORIGIN = 'https://learncivicsense.in';

export interface SitemapEntry {
  /** Site-relative path, with its trailing slash. */
  path: string;
  /** YYYY-MM-DD; left out when the page has no dated content of its own. */
  lastmod?: string;
}

/** Indexable pages that are not lessons or topics, and carry no content date. */
const PLAIN_PAGES = ['/about/', '/privacy/', '/terms/'];

function newest(dates: Array<string | undefined>): string | undefined {
  return dates
    .filter((d): d is string => !!d)
    .sort()
    .pop();
}

export function sitemapEntries(): SitemapEntry[] {
  const topics: SitemapEntry[] = [];
  const lessons: SitemapEntry[] = [];
  for (const cat of getNavCategories()) {
    const dates: string[] = [];
    for (const article of cat.articles) {
      if (!article.published) continue;
      const lesson = loadLessonForArticle(article);
      if (!lesson) continue;
      lessons.push({ path: articleUrl(article), lastmod: lesson.last_updated || undefined });
      if (lesson.last_updated) dates.push(lesson.last_updated);
    }
    // A topic page changes when one of its lessons does.
    topics.push({ path: categoryUrl(cat.id), lastmod: newest(dates) });
  }
  // The homepage and the index of every lesson change with any lesson.
  const latest = newest(topics.map((t) => t.lastmod));
  return [
    { path: '/', lastmod: latest },
    { path: '/topics/', lastmod: latest },
    ...PLAIN_PAGES.map((path) => ({ path })),
    ...topics,
    ...lessons,
  ];
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** One <url> or <sitemap> entry: its absolute address, and its date when known. */
export function sitemapNode(tag: 'url' | 'sitemap', path: string, lastmod?: string): string {
  const loc = xmlEscape(new URL(path, SITE_ORIGIN).toString());
  const date = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  return `  <${tag}><loc>${loc}</loc>${date}</${tag}>`;
}

export const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8' };
