// Image sitemap (brief Item 5).
//
// @astrojs/sitemap covers pages but not images, and Google Image Search indexes
// images via a dedicated sitemap-images.xml. This endpoint emits one
// <image:image> per PUBLISHED article (coming-soon stubs are skipped), pointing
// at the article's Cloudflare Images hero delivery URL.
//
// Env-gated: when Cloudflare Images isn't configured every hero would resolve to
// the local placeholder, which isn't worth indexing — so we emit a valid but
// empty <urlset>. The file (and its robots.txt reference) stay valid; it
// populates automatically once R2/Images is live in production.

import type { APIRoute } from 'astro';
import { getNavCategories, loadLessonForArticle, articleUrl } from '../lib/content';
import { getArticleImage } from '../lib/images';
import { cloudflareImagesEnabled } from '../lib/cloudflare';

const SITE_ORIGIN = 'https://learncivicsense.in';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function imageEntry(loc: string, imgLoc: string, title: string, caption: string): string {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    '    <image:image>',
    `      <image:loc>${xmlEscape(imgLoc)}</image:loc>`,
    `      <image:title>${xmlEscape(title)}</image:title>`,
    `      <image:caption>${xmlEscape(caption)}</image:caption>`,
    '      <image:geo_location>India</image:geo_location>',
    '    </image:image>',
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = () => {
  const entries: string[] = [];

  if (cloudflareImagesEnabled()) {
    for (const cat of getNavCategories()) {
      for (const sub of cat.subtopics) {
        for (const article of sub.articles) {
          if (!article.published) continue;
          const lesson = loadLessonForArticle(article);
          if (!lesson) continue;
          const loc = new URL(articleUrl(article), SITE_ORIGIN).toString();
          const imgLoc = getArticleImage(lesson.id, 'hero', true);
          const caption = lesson.meta_description || lesson.tldr[0] || lesson.title;
          entries.push(imageEntry(loc, imgLoc, lesson.title, caption));
        }
      }
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    (entries.length ? entries.join('\n') + '\n' : '') +
    '</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
