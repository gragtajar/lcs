// Image sitemap (brief Item 5).
//
// sitemap-0.xml covers pages but not images, and Google Image Search indexes
// images via a dedicated sitemap-images.xml. This endpoint emits one
// <image:image> per PUBLISHED article that actually HAS an ImageKit image, pointing
// at its hero delivery URL. Articles with only the placeholder are skipped (not worth
// indexing), so early on the file is small and grows as images are uploaded.
// Each entry is just the image's address: Google retired the image title,
// caption and geo_location tags in 2022 and reads those from the page.

import type { APIRoute } from 'astro';
import { getNavCategories, loadLessonForArticle, articleUrl } from '../lib/content';
import { getArticleImage, hasArticleImage } from '../lib/images';
import { SITE_ORIGIN, xmlEscape, XML_HEADERS } from '../lib/sitemap';

function imageEntry(loc: string, imgLoc: string): string {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    '    <image:image>',
    `      <image:loc>${xmlEscape(imgLoc)}</image:loc>`,
    '    </image:image>',
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = () => {
  const entries: string[] = [];

  for (const cat of getNavCategories()) {
    for (const article of cat.articles) {
      if (!article.published || !hasArticleImage(article.id)) continue;
      const lesson = loadLessonForArticle(article);
      if (!lesson) continue;
      const loc = new URL(articleUrl(article), SITE_ORIGIN).toString();
      entries.push(imageEntry(loc, getArticleImage(lesson.id, 'hero', true)));
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    (entries.length ? entries.join('\n') + '\n' : '') +
    '</urlset>\n';

  return new Response(body, { headers: XML_HEADERS });
};
