#!/usr/bin/env node
// IndexNow (https://www.indexnow.org): tells Bing, and the other search engines
// that share IndexNow submissions, which pages a deploy added, changed or
// removed, so they recrawl those pages instead of waiting for the sitemap.
// Bing retired its old sitemap "ping" address in 2022; IndexNow replaced it.
//
// The Deploy workflow runs it in two steps:
//   node scripts/indexnow.mjs plan --dist dist --out indexnow-urls.txt
//     Before the upload, while the old build is still live: compares every page
//     in the new sitemap with the live page (ignoring GoDaddy's injected script
//     and Astro's per-build island ids) and lists the pages that are new or
//     changed, plus those the new sitemap no longer lists (removed, or now kept
//     out of search).
//   node scripts/indexnow.mjs submit indexnow-urls.txt
//     After Verify production passes: sends that list to Bing's endpoint.
// Neither step can fail a deploy: a problem is reported as a warning.
//
// The key is public by design. IndexNow checks it against
// https://learncivicsense.in/<key>.txt (public/<key>.txt), which shows the
// submission comes from whoever controls the site.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOST_INJECTION } from './host-injection.mjs';

export const INDEXNOW_KEY = 'b82f75be677b899a7269648a46d26a01';
const HOST = 'learncivicsense.in';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://www.bing.com/indexnow';
const CONCURRENCY = 6;
const BUST = `indexnow=${process.env.GITHUB_RUN_ID ?? Date.now()}`;

/** A page's HTML without what differs between builds or deploys but not for readers. */
export function normalizeHtml(html) {
  return html.replace(HOST_INJECTION, '').replace(/ uid="[^"]*"/g, '');
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** Pages that are new or changed, then pages no longer in the sitemap. */
export function changedUrls(newUrls, oldUrls, isChanged) {
  const listed = new Set(newUrls);
  return [...newUrls.filter(isChanged), ...oldUrls.filter((u) => !listed.has(u))];
}

const warn = (msg) =>
  console.log(process.env.GITHUB_ACTIONS ? `::warning title=IndexNow::${msg}` : `warning: ${msg}`);

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'lcs-deploy-indexnow' } });
      if ((res.status >= 500 || res.status === 429) && attempt < 3)
        throw new Error(`${res.status}`);
      return res;
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function plan(dist, out) {
  const newUrls = sitemapUrls(await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8'));
  const live = await get(`${ORIGIN}/sitemap-0.xml?${BUST}`);
  const oldUrls = live.ok ? sitemapUrls(await live.text()) : [];
  const changed = new Set();
  const queue = [...newUrls];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const res = await get(`${url}?${BUST}`);
        const file = path.join(dist, new URL(url).pathname, 'index.html');
        if (
          !res.ok ||
          normalizeHtml(await res.text()) !== normalizeHtml(await readFile(file, 'utf8'))
        ) {
          changed.add(url);
        }
      }
    }),
  );
  const urls = changedUrls(newUrls, oldUrls, (u) => changed.has(u));
  await writeFile(out, urls.length ? `${urls.join('\n')}\n` : '');
  console.log(
    `${changed.size} of ${newUrls.length} pages are new or changed, ` +
      `${urls.length - changed.size} left the sitemap: ${urls.length} to submit.`,
  );
}

async function submit(file) {
  if (!existsSync(file)) return console.log(`No ${file}: nothing to submit.`);
  const urls = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  if (urls.length === 0) return console.log('No page changed: nothing to submit.');
  // IndexNow takes up to 10,000 URLs per request.
  for (let i = 0; i < urls.length; i += 10_000) {
    const urlList = urls.slice(i, i + 10_000);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    // 200: received. 202: received, the key is still being checked.
    if (res.status === 200 || res.status === 202) {
      console.log(`Submitted ${urlList.length} URL(s) to ${ENDPOINT}: HTTP ${res.status}.`);
    } else {
      warn(
        `${ENDPOINT} answered HTTP ${res.status} for ${urlList.length} URL(s): ${await res.text()}`,
      );
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  try {
    if (command === 'plan') {
      await plan(opt('dist', 'dist'), opt('out', 'indexnow-urls.txt'));
    } else if (command === 'submit' && args[0]) {
      await submit(args[0]);
    } else {
      console.error(
        'Usage: indexnow.mjs plan [--dist dist] [--out file] | indexnow.mjs submit <file>',
      );
      process.exitCode = 2;
    }
  } catch (err) {
    // Search engines learn about changes from the sitemap anyway; a failed
    // notification is worth a warning, not a failed deploy.
    warn(`${command} failed: ${err instanceof Error ? err.message : err}`);
    if (command === 'plan') await writeFile(opt('out', 'indexnow-urls.txt'), '');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
