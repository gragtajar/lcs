#!/usr/bin/env node
// Post-deploy verification for learncivicsense.in, run by the Deploy workflow
// right after the FTPS upload (and runnable by hand at any time).
//
// 1. Every file in dist/ is served at its URL with status 200, the expected
//    content type, and the same bytes (sha256). The live site is then exactly
//    the build CI tested: no partial upload, no stale file, nothing rewritten.
// 2. The Apache policy from public/.htaccess holds: one HTTPS origin (http and
//    www redirect), 404 for missing pages, hidden dotfiles, security headers,
//    cache lifetimes and compression.
//
// Usage:
//   node scripts/verify-deploy.mjs [--dist dist] [--origin https://learncivicsense.in]
//   node scripts/verify-deploy.mjs --origin http://localhost:4322 --no-policy
//     (against `npm run preview`: file checks only; the policy is Apache's)

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const DIST = opt('dist', 'dist');
const ORIGIN = opt('origin', 'https://learncivicsense.in').replace(/\/+$/, '');
const POLICY = !argv.includes('--no-policy');
const CONCURRENCY = 6;
const BUST = `verify=${process.env.GITHUB_RUN_ID ?? Date.now()}`;

const TYPES = {
  '.html': /^text\/html/,
  '.css': /^text\/css/,
  '.js': /javascript/,
  '.json': /^application\/json/,
  '.webmanifest': /json/,
  '.svg': /^image\/svg\+xml/,
  '.xml': /xml/,
  '.txt': /^text\/plain/,
  '.woff2': /^font\/woff2/,
};

const failures = [];
const fail = (msg) => failures.push(msg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function request(url, init = {}, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        ...init,
        headers: { 'user-agent': 'lcs-deploy-verify', ...(init.headers ?? {}) },
      });
      if ((res.status >= 500 || res.status === 429) && attempt < tries) {
        await sleep(1500 * attempt);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(1500 * attempt);
    }
  }
}

/** Every file under dir, relative, skipping dotfiles (Apache never serves them). */
async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function urlPathFor(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

async function checkFile(rel) {
  const local = await readFile(path.join(DIST, rel));
  const urlPath = urlPathFor(rel);
  const res = await request(`${ORIGIN}${urlPath}?${BUST}`);
  if (res.status !== 200) return fail(`${urlPath}: HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (sha256(body) !== sha256(local)) {
    return fail(
      `${urlPath}: served bytes differ from the build (${body.length} vs ${local.length} bytes)`,
    );
  }
  const want = TYPES[path.extname(rel)];
  const type = res.headers.get('content-type') ?? '';
  if (want && !want.test(type)) fail(`${urlPath}: content-type '${type}'`);
}

async function checkFiles() {
  const files = await walk(DIST);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length) {
      const rel = files[next++];
      try {
        await checkFile(rel);
      } catch (err) {
        fail(`${urlPathFor(rel)}: ${err.message}`);
      }
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${files.length} files checked`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return files.length;
}

async function expectRedirect(from, to) {
  const res = await request(from);
  const location = res.headers.get('location') ?? '';
  // Apache's own trailing-slash redirect may send a relative Location; what
  // matters is where it resolves to.
  const target = location ? new URL(location, from).href : '';
  if (res.status !== 301 || target !== to) {
    fail(`${from} → expected 301 to ${to}, got ${res.status} ${location}`);
  }
}

async function expectHeader(urlPath, name, pattern, init) {
  const res = await request(`${ORIGIN}${urlPath}`, init);
  const value = res.headers.get(name) ?? '';
  if (!pattern.test(value)) fail(`${urlPath}: header ${name} '${value}' does not match ${pattern}`);
}

async function checkPolicy(files) {
  const host = new URL(ORIGIN).host;
  await expectRedirect(`http://${host}/traffic/?q=1`, `${ORIGIN}/traffic/?q=1`);
  await expectRedirect(`http://www.${host}/`, `${ORIGIN}/`);
  await expectRedirect(`${ORIGIN.replace('://', '://www.')}/search/`, `${ORIGIN}/search/`);
  await expectRedirect(`${ORIGIN}/traffic`, `${ORIGIN}/traffic/`);

  // The status must be 404. The body is informational: GoDaddy currently
  // replaces every error body with its own 13-byte text, whatever ErrorDocument
  // says (tested 2026-09-26, PR #28), so the site's 404 page cannot show yet.
  const missing = await request(`${ORIGIN}/no-such-page-${BUST.replace('=', '-')}/`);
  const missingBody = await missing.text();
  if (missing.status !== 404) fail(`unknown path: HTTP ${missing.status}, expected 404`);
  console.log(
    missingBody.includes('Page not found')
      ? 'Missing pages show the site 404 page.'
      : `Missing pages show the host's own error body (${missingBody.trim().slice(0, 40)}); status 404 is correct.`,
  );
  const designed = await request(`${ORIGIN}/404.html?${BUST}`);
  if (designed.status !== 200 || !(await designed.text()).includes('Page not found')) {
    fail('/404.html: the designed 404 page is not served');
  }

  for (const hidden of ['/.ftp-deploy-sync-state.json', '/.ftpquota', '/.htaccess']) {
    const res = await request(`${ORIGIN}${hidden}`);
    if (res.status === 200) fail(`${hidden}: served (HTTP 200), should be hidden`);
  }

  await expectHeader('/', 'x-content-type-options', /^nosniff$/);
  await expectHeader('/', 'x-frame-options', /^DENY$/);
  await expectHeader('/', 'referrer-policy', /strict-origin-when-cross-origin/);
  await expectHeader('/', 'permissions-policy', /camera=\(\)/);
  await expectHeader('/', 'strict-transport-security', /max-age=31536000/);
  await expectHeader('/', 'cache-control', /max-age=300/);
  await expectHeader('/build-info.json', 'cache-control', /no-store/);
  await expectHeader('/', 'content-encoding', /gzip|br/, {
    headers: { 'accept-encoding': 'gzip, br' },
  });
  const asset = files.find((f) => f.startsWith('_astro/') && f.endsWith('.css'));
  if (asset) await expectHeader(`/${asset}`, 'cache-control', /immutable/);
}

const started = Date.now();
console.log(
  `Verifying ${ORIGIN} against ${DIST}/ ${POLICY ? '(files + Apache policy)' : '(files only)'}`,
);
const live = await request(`${ORIGIN}/build-info.json?${BUST}`);
if (live.status === 200) console.log(`Live build: ${(await live.text()).trim()}`);

const count = await checkFiles();
if (POLICY) await checkPolicy(await walk(DIST));

const secs = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.error(`\n${failures.length} problem(s) after checking ${count} files in ${secs}s:`);
  for (const f of failures.slice(0, 100)) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\n✓ ${count} files served byte-for-byte${POLICY ? ', redirects, 404, hidden files, headers, caching and compression as configured' : ''} (${secs}s)`,
);
