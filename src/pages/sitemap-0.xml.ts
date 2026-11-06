// The page sitemap (see src/lib/sitemap.ts for what it lists and why).

import type { APIRoute } from 'astro';
import { sitemapEntries, sitemapNode, XML_HEADERS } from '../lib/sitemap';

export const GET: APIRoute = () => {
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapEntries()
      .map((e) => sitemapNode('url', e.path, e.lastmod))
      .join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: XML_HEADERS });
};
