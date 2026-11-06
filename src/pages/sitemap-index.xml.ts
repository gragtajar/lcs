// The sitemap index robots.txt points to: the page sitemap and the image
// sitemap, so one submission in Search Console covers both.

import type { APIRoute } from 'astro';
import { sitemapEntries, sitemapNode, XML_HEADERS } from '../lib/sitemap';

export const GET: APIRoute = () => {
  // The page sitemap changes when its newest entry does.
  const latest = sitemapEntries()
    .map((e) => e.lastmod ?? '')
    .sort()
    .pop();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapNode('sitemap', '/sitemap-0.xml', latest || undefined) +
    '\n' +
    sitemapNode('sitemap', '/sitemap-images.xml') +
    '\n</sitemapindex>\n';
  return new Response(body, { headers: XML_HEADERS });
};
