#!/usr/bin/env node
// The site's Content-Security-Policy, written into dist/.htaccess after each
// build (the last step of `npm run build`).
//
// A page may run only the site's own files and the inline scripts and styles
// the build produced, each allowed by its SHA-256 hash, so the policy is
// recomputed whenever they change. It may show images from the site, ImageKit
// and data: URLs, talk only to the site, and be framed by no one. Anything
// else a page is made to load or run is blocked, including the monitoring
// script GoDaddy inserts into every page (scripts/host-injection.mjs), which
// would otherwise set three cookies (src/pages/privacy.astro says so).
// Search compiles WebAssembly (Pagefind), hence 'wasm-unsafe-eval'.
//
// The build stops if a page has an inline event handler, a style attribute or
// a javascript: link: the policy would block them, so they would silently
// break. tests/e2e/smoke.spec.ts runs the pages under this policy.
//
// Adding anything that loads from another site (analytics, an embed, a font)
// means adding its origin here, and saying so on the privacy page.
//
// Usage: node scripts/csp.mjs [dist]

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The line in public/.htaccess that this script replaces with the header. */
export const MARKER = '# @content-security-policy';
const EXECUTABLE = new Set(['', 'module', 'text/javascript', 'application/javascript']);

const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/**
 * The hashes a page's inline scripts and styles need, and anything on it the
 * policy would block. Data blocks (JSON-LD, JSON) never run, so need none.
 */
export function inspectHtml(html) {
  const scripts = new Set();
  const styles = new Set();
  const problems = [];
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\stype\s*=\s*"([^"]*)"/i)?.[1] ?? '').trim().toLowerCase();
    if (EXECUTABLE.has(type)) scripts.add(sha256(body));
  }
  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.add(sha256(body));
  }
  for (const [tag] of html.matchAll(/<[a-z][^<>]*>/gi)) {
    if (/\son[a-z]+\s*=/i.test(tag)) problems.push(`inline event handler: ${tag.slice(0, 80)}`);
    if (/\sstyle\s*=/i.test(tag)) problems.push(`style attribute: ${tag.slice(0, 80)}`);
    if (/\s(href|src|action)\s*=\s*"\s*javascript:/i.test(tag)) {
      problems.push(`javascript: URL: ${tag.slice(0, 80)}`);
    }
  }
  return { scripts, styles, problems };
}

export function buildPolicy(scripts, styles) {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' 'report-sample' ${[...scripts].sort().join(' ')}`,
    `style-src 'self' 'report-sample' ${[...styles].sort().join(' ')}`,
    "img-src 'self' data: https://ik.imagekit.io",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function main() {
  const dist = process.argv[2] ?? 'dist';
  const scripts = new Set();
  const styles = new Set();
  const problems = [];
  const files = await htmlFiles(dist);
  for (const file of files) {
    const found = inspectHtml(await readFile(file, 'utf8'));
    found.scripts.forEach((h) => scripts.add(h));
    found.styles.forEach((h) => styles.add(h));
    problems.push(...found.problems.map((p) => `${path.relative(dist, file)}: ${p}`));
  }
  if (problems.length > 0) {
    console.error(`The Content-Security-Policy would block these:\n${problems.join('\n')}`);
    process.exit(1);
  }
  const htaccess = path.join(dist, '.htaccess');
  const source = await readFile(htaccess, 'utf8');
  const line = source.split('\n').find((l) => l.trim() === MARKER);
  if (!line) {
    console.error(`${htaccess} has no "${MARKER}" line to replace`);
    process.exit(1);
  }
  const indent = line.slice(0, line.indexOf('#'));
  const header = `${indent}Header always set Content-Security-Policy "${buildPolicy(scripts, styles)}"`;
  // Apache reads a configuration line of at most 8,192 bytes; past that the
  // whole .htaccess fails and every page answers 500.
  if (header.length > 7_500) {
    console.error(
      `The Content-Security-Policy line is ${header.length} bytes, near Apache's limit`,
    );
    process.exit(1);
  }
  await writeFile(htaccess, source.replace(line, header));
  console.log(
    `Content-Security-Policy: ${scripts.size} inline script and ${styles.size} inline style hash(es) from ${files.length} pages.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
