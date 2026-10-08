// Builds the site's icons and share image from the logo, src/assets/logo.svg
// (the owner's artwork), into public/. Run after the logo changes:
//
//   npm run brand:assets
//
// The outputs are committed (the build does not regenerate them), so a deploy
// needs no browser. Rasterised by Playwright's Chromium (a dev dependency),
// which draws the SVG exactly as the site's own pages do.
//
//   favicon.svg            browser tab: the mark on a square, swapped in a dark UI
//   favicon.ico            16, 32, 48 px (PNG entries), for browsers without SVG icons
//   apple-touch-icon.png   180 px, iOS home screen (iOS fills transparency black)
//   icon-192.png           192 px, web app manifest
//   icon-512.png           512 px, web app manifest
//   icon-maskable-512.png  512 px, Android's masked icon: the mark inside the 80% safe circle
//   logo.png               512 px on transparent, the logo for structured data (JSON-LD)
//   og-image.png           1200x630, the share image of pages without their own
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { faviconSvg, markSvg, parseLogo, LOGO_INK, LOGO_PAPER } from '../src/lib/logo-svg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const source = readFileSync(path.join(ROOT, 'src/assets/logo.svg'), 'utf8');
const logo = parseLogo(source);
const mark = markSvg(source);
const ratio = logo.width / logo.height;

const hind700 = readFileSync(path.join(PUBLIC, 'fonts/hind/hind-700-latin.woff2')).toString(
  'base64',
);

/**
 * Draw `content` centred on a width x height stage and return the PNG.
 * @param {import('@playwright/test').Page} page
 * @param {{ width: number, height: number, background?: string, content: string, css?: string }} o
 */
async function render(page, { width, height, background, content, css = '' }) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Hind; font-weight: 700; src: url(data:font/woff2;base64,${hind700}) format('woff2'); }
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${background ?? 'transparent'}; }
    .stage { width: ${width}px; height: ${height}px; display: flex; flex-direction: column;
             align-items: center; justify-content: center; }
    .stage svg { display: block; width: auto; }
    ${css}
  </style></head><body><div class="stage">${content}</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({
    type: 'png',
    omitBackground: !background,
    clip: { x: 0, y: 0, width, height },
  });
}

/** The mark at a given height (px), centred. */
const markAt = (h) => ({ content: mark, css: `.stage svg { height: ${h}px; }` });

/**
 * An .ico of PNG entries (supported by every browser that reads .ico).
 * @param {Array<{ size: number, png: Buffer }>} images
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // width (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    dir.writeUInt8(0, o + 2); // palette size
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...images.map((im) => im.png)]);
}

const written = [];
const write = (name, data) => {
  writeFileSync(path.join(PUBLIC, name), data);
  written.push(`${name} (${data.length} bytes)`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
try {
  write('favicon.svg', faviconSvg(source));

  // Tab icons: the mark at full height on transparent, the sides left clear.
  const tab = [];
  for (const size of [16, 32, 48]) {
    tab.push({ size, png: await render(page, { width: size, height: size, ...markAt(size) }) });
  }
  write('favicon.ico', ico(tab));

  // App icons: the logo's own paper as the tile, the mark at 80% of its height.
  for (const [name, size] of [
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    write(
      name,
      await render(page, {
        width: size,
        height: size,
        background: LOGO_PAPER,
        ...markAt(Math.round(size * 0.8)),
      }),
    );
  }

  // Android masks icons to a circle (or a squircle) of 80% of the tile: the
  // mark's diagonal stays inside it.
  const safe = 512 * 0.8;
  const maskableHeight = Math.floor(safe / Math.hypot(1, ratio));
  write(
    'icon-maskable-512.png',
    await render(page, {
      width: 512,
      height: 512,
      background: LOGO_PAPER,
      ...markAt(maskableHeight),
    }),
  );

  write('logo.png', await render(page, { width: 512, height: 512, ...markAt(480) }));

  // The share image: the mark over the site's name, on the logo's paper, both
  // inside the central 630px square that link previews crop to.
  write(
    'og-image.png',
    await render(page, {
      width: 1200,
      height: 630,
      background: LOGO_PAPER,
      content: `${mark}<div class="name">Learn Civic Sense</div>`,
      css: `.stage { gap: 32px; }
            .stage svg { height: 340px; }
            .name { font: 700 58px/1 Hind, sans-serif; letter-spacing: -0.012em; color: ${LOGO_INK}; }`,
    }),
  );
} finally {
  await browser.close();
}

console.log(`Wrote to public/:\n  ${written.join('\n  ')}`);
