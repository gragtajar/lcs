// Sync src/data/article-images.json from the ImageKit Media Library.
//
// Runs before `astro build` (see package.json). It lists the files in the ImageKit
// account and rebuilds the article -> image registry so uploading an image and
// rebuilding is all it takes for an article's image to appear — no code edits.
//
// Convention: an uploaded image whose filename WITHOUT extension equals an article id
// (e.g. `sacred-001.png`, `traffic-014.jpg`) is auto-registered for that article. Files
// that don't match an article-id pattern are ignored.
//
// Safety: this NEVER fails the build. Without IMAGEKIT_PRIVATE_KEY (a secret), or if the
// API call fails, it keeps the committed registry as-is (the fallback). The private key
// is read from the process env (CI secret) or the local, gitignored .env file.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REGISTRY_PATH = path.join(ROOT, 'src', 'data', 'article-images.json');
const API_URL = 'https://api.imagekit.io/v1/files';
const PAGE_LIMIT = 1000;
/** Only files named like an article id, e.g. `sacred-001`, `traffic-014`. */
const ARTICLE_ID_RE = /^[a-z]+-\d{2,4}$/;

/** Resolve the private key from the process env, falling back to a local .env line. */
function resolvePrivateKey() {
  if (process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_PRIVATE_KEY.trim()) {
    return process.env.IMAGEKIT_PRIVATE_KEY.trim();
  }
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('IMAGEKIT_PRIVATE_KEY='));
  if (!line) return '';
  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/** List every image file in the media library, paginating through the API. */
async function listImageFiles(privateKey) {
  const auth = 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64');
  const files = [];
  for (let skip = 0; skip < 50 * PAGE_LIMIT; skip += PAGE_LIMIT) {
    const url = `${API_URL}?limit=${PAGE_LIMIT}&skip=${skip}&fileType=image`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`ImageKit API responded ${res.status} ${res.statusText}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    files.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
  }
  return files;
}

/** Map ImageKit files to { articleId: filePath }, keyed by the filename stem. */
function buildRegistry(files) {
  const images = {};
  for (const file of files) {
    const name = file?.name || (file?.filePath ? path.posix.basename(file.filePath) : '');
    if (!name) continue;
    const stem = name.replace(/\.[^.]+$/, '');
    if (!ARTICLE_ID_RE.test(stem)) continue;
    // Path within the endpoint (no leading slash); imagekit.ts's imagekitUrl() adds tr:.
    images[stem] = String(file.filePath || name).replace(/^\/+/, '');
  }
  // Sorted for deterministic, minimal diffs.
  return Object.fromEntries(
    Object.keys(images)
      .sort()
      .map((k) => [k, images[k]]),
  );
}

async function main() {
  const privateKey = resolvePrivateKey();
  if (!privateKey) {
    console.log('[imagekit] IMAGEKIT_PRIVATE_KEY not set — keeping the committed registry.');
    return;
  }

  let files;
  try {
    files = await listImageFiles(privateKey);
  } catch (err) {
    console.warn(
      `[imagekit] Media Library sync skipped (${err instanceof Error ? err.message : err}) — keeping the committed registry.`,
    );
    return;
  }

  const images = buildRegistry(files);
  const existing = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) : {};
  const out = {
    _note:
      existing._note ||
      'Article id -> ImageKit file path. Auto-generated from the ImageKit Media Library; a file named <article-id>.<ext> auto-registers its article. Committed copy is the no-key fallback.',
    _generatedBy: 'scripts/sync-imagekit-registry.mjs',
    images,
  };
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `[imagekit] Synced ${Object.keys(images).length} article image(s) from the Media Library.`,
  );
}

main();
