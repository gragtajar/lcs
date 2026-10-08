#!/usr/bin/env node
// Post-deploy verification for learncivicsense.in, run by the Deploy workflow
// right after the FTPS upload (and runnable by hand at any time).
//
// 1. Every file in dist/ is served at its URL with status 200, the expected
//    content type, and the same bytes (sha256). The live site is then exactly
//    the build CI tested: no partial upload, no stale file, nothing rewritten
//    (apart from the host's own script, recognised narrowly below).
// 2. The Apache policy from public/.htaccess holds: one HTTPS origin (http and
//    www redirect), every address from before the site had two levels
//    redirecting to its lesson or topic (ADR 011), the site's own 404 page with
//    status 404 for every address it has no page for (404.php), hidden
//    dotfiles, security headers, cache lifetimes and compression.
//
// Usage:
//   node scripts/verify-deploy.mjs [--dist dist] [--origin https://learncivicsense.in]
//   node scripts/verify-deploy.mjs --origin http://localhost:4322 --no-policy
//     (against `npm run preview`: file checks only; the policy is Apache's)

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { parseLegacyAddresses } from './legacy-addresses.mjs';

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
  '.ico': /^image\/(x-icon|vnd\.microsoft\.icon)/,
  '.png': /^image\/png/,
  '.xml': /xml/,
  '.txt': /^text\/plain/,
  '.woff2': /^font\/woff2/,
};

// GoDaddy inserts its TCCL performance-monitoring loader into every HTML
// response, immediately before </html>: an inline <script> that queues
// `_trfd` settings and a <script src> from img1.wsimg.com (found by the first
// deploy, 2026-09-26; the snippet says opting out means contacting GoDaddy
// support). It is recognised this narrowly and reported on every run; any other
// difference between a served page and the build still fails the check.
const HOST_INJECTION =
  /<script>'undefined'=== typeof _trfq \|\| \(window\._trfq = \[\]\);[^<]*<\/script><script src='https:\/\/img1\.wsimg\.com\/traffic-assets\/js\/tccl\.min\.js'><\/script>(?=<\/html>)/;
let hostInjected = 0;

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

/**
 * Every file under dir, relative, skipping dotfiles (Apache never serves them)
 * and PHP (the host runs it; 404.php is checked by what it answers, below).
 */
async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.php')) continue;
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

/**
 * Whether served HTML is the built file byte for byte, allowing only the host's
 * recognised script injection. Returns 'same', 'injected' or 'different'.
 */
function compareHtml(body, local) {
  if (sha256(body) === sha256(local)) return 'same';
  const withoutHost = Buffer.from(body.toString('utf8').replace(HOST_INJECTION, ''), 'utf8');
  if (withoutHost.length !== body.length && sha256(withoutHost) === sha256(local)) {
    return 'injected';
  }
  return 'different';
}

async function checkFile(rel) {
  const local = await readFile(path.join(DIST, rel));
  const urlPath = urlPathFor(rel);
  const res = await request(`${ORIGIN}${urlPath}?${BUST}`);
  if (res.status !== 200) return fail(`${urlPath}: HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (sha256(body) !== sha256(local)) {
    const verdict = rel.endsWith('.html') ? compareHtml(body, local) : 'different';
    if (verdict === 'different') {
      return fail(
        `${urlPath}: served bytes differ from the build (${body.length} vs ${local.length} bytes)`,
      );
    }
    hostInjected++;
  }
  const want = TYPES[path.extname(rel)];
  const type = res.headers.get('content-type') ?? '';
  if (want && !want.test(type)) fail(`${urlPath}: content-type '${type}'`);
}

/** Run `fn` over `items`, CONCURRENCY at a time; an error becomes a failure. */
async function inPool(items, fn, label) {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (err) {
        fail(`${label(item)}: ${err.message}`);
      }
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${items.length} checked`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function checkFiles() {
  const files = await walk(DIST);
  await inPool(files, checkFile, urlPathFor);
  return files.length;
}

/** The [old, new] address pairs in the built .htaccess's frozen block (ADR 011). */
async function legacyAddresses() {
  const { pairs, unparsed } = parseLegacyAddresses(
    await readFile(path.join(DIST, '.htaccess'), 'utf8'),
  );
  for (const line of unparsed) fail(`.htaccess: legacy rule not understood: ${line}`);
  return pairs;
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

/**
 * A request exactly as written, Origin header included (node:https, not fetch,
 * so no header is ever dropped). Resolves with { status, headers, body }.
 */
function rawRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method, headers: { 'user-agent': 'lcs-deploy-verify', ...headers } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error('timed out')));
    if (body) req.write(body);
    req.end();
  });
}

/**
 * The feedback endpoint (ADR 012), checked without sending an email: every
 * request here is refused, or is the trap a bot falls into (answered "sent",
 * nothing sent). What the endpoint itself decides is tested in CI by
 * scripts/test-feedback-endpoint.mjs; this proves the host's side.
 */
async function checkFeedback(page404) {
  const url = `${ORIGIN}/feedback.php`;
  const origin = new URL(ORIGIN).origin;
  const formHeaders = {
    Origin: origin,
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const expect = (label, res, status, code) => {
    let json = null;
    try {
      json = JSON.parse(res.body.toString('utf8'));
    } catch {
      // not JSON
    }
    if (res.status !== status || (code && json?.code !== code)) {
      fail(
        `feedback: ${label}: expected ${status}${code ? ` "${code}"` : ''}, got ${res.status} ${res.body.toString('utf8').slice(0, 80)}`,
      );
    }
    if (res.headers['x-powered-by']) fail(`feedback: ${label}: sends X-Powered-By`);
  };

  let res = await rawRequest(url, { headers: { Accept: 'application/json' } });
  expect('GET', res, 405, 'method');
  if (!/no-store/.test(res.headers['cache-control'] ?? '')) {
    fail(`feedback: cache-control '${res.headers['cache-control']}', expected no-store`);
  }
  res = await rawRequest(url, {
    method: 'POST',
    headers: { ...formHeaders, Origin: 'https://example.com' },
    body: 'type=other&message=from+another+site',
  });
  expect('a post from another site', res, 403, 'origin');
  res = await rawRequest(url, {
    method: 'POST',
    headers: { ...formHeaders, 'Content-Type': 'multipart/form-data; boundary=x' },
    body: '--x\r\nContent-Disposition: form-data; name="f"; filename="a.txt"\r\n\r\nfile\r\n--x--\r\n',
  });
  // Apache's rule answers before PHP (the endpoint would say 415 "media").
  expect('a multipart post (a file)', res, 403);
  res = await rawRequest(url, {
    method: 'POST',
    headers: formHeaders,
    body: `message=${'a'.repeat(20000)}`,
  });
  expect('a 20 KB post', res, 413);
  res = await rawRequest(url, {
    method: 'POST',
    headers: formHeaders,
    body: 'type=praise&message=an+unknown+type',
  });
  expect('an unknown type', res, 400, 'type');
  res = await rawRequest(url, {
    method: 'POST',
    headers: formHeaders,
    body: 'type=other&message=from+a+bot&website=http%3A%2F%2Fspam.example',
  });
  expect('the trap field', res, 200, 'sent');

  // The private settings and the rate-limit state are never served: each is a
  // dotted path, answered by the site's 404 page.
  for (const privatePath of [
    '/.lcs-private/',
    '/.lcs-private/feedback-config.php',
    '/.lcs-private/feedback-rate.json',
    '/.lcs-private/feedback-key',
  ]) {
    const r = await rawRequest(`${ORIGIN}${privatePath}`);
    if (r.status !== 404 || compareHtml(r.body, page404) === 'different') {
      fail(`${privatePath}: HTTP ${r.status}, expected the site's 404 page`);
    }
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

  // Every lesson and subtopic address from before the site had two levels
  // moves in one step to its lesson or topic; also without the trailing slash,
  // with the query string kept.
  const legacy = await legacyAddresses();
  if (legacy.length === 0) fail('.htaccess: no legacy addresses between the BEGIN/END markers');
  await inPool(
    legacy,
    ([from, to]) => expectRedirect(`${ORIGIN}${from}`, `${ORIGIN}${to}`),
    ([from]) => from,
  );
  const lessonMove = legacy.find(([from]) => from.split('/').length === 5);
  if (lessonMove) {
    const [from, to] = lessonMove;
    await expectRedirect(`${ORIGIN}${from.slice(0, -1)}?q=1`, `${ORIGIN}${to}?q=1`);
  }
  console.log(`  ${legacy.length} addresses from before ADR 011 redirect to their lesson or topic`);

  // Every address the site has no page for answers 404 with the site's own
  // page, sent by 404.php (the host replaces any error body Apache generates;
  // ADR 010): a missing page, a folder with no page of its own, a dotfile, and
  // 404.php itself. The page is dist/404.html byte for byte, never cached, and
  // does not advertise the PHP version.
  const page404 = await readFile(path.join(DIST, '404.html'));
  const notFound = [
    `/no-such-page-${BUST.replace('=', '-')}/`,
    `/no-such-lesson-${BUST.replace('=', '-')}.html`,
    '/_astro/',
    '/.ftp-deploy-sync-state.json',
    '/404.php',
  ];
  for (const urlPath of notFound) {
    const res = await request(`${ORIGIN}${urlPath}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (res.status !== 404) fail(`${urlPath}: HTTP ${res.status}, expected 404`);
    if (compareHtml(body, page404) === 'different') {
      fail(
        `${urlPath}: not the site's 404 page (${body.length} bytes: ${body.toString('utf8').trim().slice(0, 40)})`,
      );
    }
    if (res.headers.get('x-powered-by')) fail(`${urlPath}: sends X-Powered-By`);
    if (!/no-store/.test(res.headers.get('cache-control') ?? '')) {
      fail(`${urlPath}: cache-control '${res.headers.get('cache-control')}', expected no-store`);
    }
  }
  const designed = await request(`${ORIGIN}/404.html?${BUST}`);
  if (designed.status !== 200 || !(await designed.text()).includes('Page not found')) {
    fail('/404.html: the designed 404 page is not served');
  }

  for (const hidden of ['/.ftpquota', '/.htaccess']) {
    const res = await request(`${ORIGIN}${hidden}`);
    if (res.status === 200) fail(`${hidden}: served (HTTP 200), should be hidden`);
  }

  await checkFeedback(page404);

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
if (hostInjected) {
  const note = `${hostInjected} HTML page(s) are served with GoDaddy's injected monitoring script (img1.wsimg.com/traffic-assets/js/tccl.min.js) before </html>; apart from that they match the build byte for byte. Opting out is done through GoDaddy support.`;
  console.log(note);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Host injects a script::${note}`);
}
if (POLICY) await checkPolicy(await walk(DIST));

const secs = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.error(`\n${failures.length} problem(s) after checking ${count} files in ${secs}s:`);
  for (const f of failures.slice(0, 100)) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\n✓ ${count} files served byte-for-byte${POLICY ? ', redirects (old addresses included), the 404 page for missing addresses, the feedback endpoint’s guards, hidden files, headers, caching and compression as configured' : ''} (${secs}s)`,
);
