import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseLogo,
  inlineLogo,
  markSvg,
  faviconSvg,
  LOGO_INK,
  LOGO_PAPER,
} from '../../src/lib/logo-svg.mjs';

// The logo is the owner's artwork (src/assets/logo.svg); every use of it is
// derived from it (src/lib/logo-svg.mjs, scripts/build-brand-assets.mjs).
// Vitest runs from the project root (as tests/unit/legacy-addresses.test.ts).
const source = readFileSync(path.resolve('src/assets/logo.svg'), 'utf8');
const publicFile = (name: string) => readFileSync(path.resolve('public', name));

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe('the logo artwork', () => {
  it('is one ink path and three paper paths on a paper artboard, portrait 168x236', () => {
    const logo = parseLogo(source);
    expect(logo.viewBox).toBe('0 0 168 236');
    expect(logo.paper).toHaveLength(3);
    // The figure's head is a hole in the paper: its fill rule survives.
    expect(logo.paper.some((p) => p.attrs.includes('fill-rule="evenodd"'))).toBe(true);
    expect(LOGO_INK).toBe('#232323');
    expect(LOGO_PAPER).toBe('#E8E8E7');
  });

  it('refuses a file of another shape instead of drawing it wrongly', () => {
    expect(() => parseLogo(source.replace('</svg>', '<circle r="4"/></svg>'))).toThrow(
      /unexpected content/,
    );
    expect(() => parseLogo(source.replace('fill="#232323"', 'fill="#ff0000"'))).toThrow(
      /unexpected fill/,
    );
    expect(() => parseLogo(source.replace(/<rect\b[^>]*\/>/, ''))).toThrow(/artboard/);
  });
});

describe('inlineLogo()', () => {
  it('drops the artboard and lets the theme colour the ink and paper', () => {
    const svg = inlineLogo(source, 'brand-logo');
    expect(svg).toMatch(/^<svg class="logo brand-logo" viewBox="0 0 168 236" aria-hidden="true"/);
    expect(svg).not.toContain('<rect');
    expect(svg).not.toContain('fill="#');
    expect(svg.match(/class="logo-ink"/g)).toHaveLength(1);
    expect(svg.match(/class="logo-paper"/g)).toHaveLength(3);
  });
});

describe('markSvg() / faviconSvg()', () => {
  it('draws the mark in its own colours with no artboard', () => {
    const svg = markSvg(source);
    expect(svg).not.toContain('<rect');
    expect(svg.match(/fill="#232323"/g)).toHaveLength(1);
    expect(svg.match(/fill="#E8E8E7"/g)).toHaveLength(3);
  });

  it('centres the favicon on a square and swaps ink and paper in a dark UI', () => {
    const svg = faviconSvg(source);
    expect(svg).toContain('viewBox="-34 0 236 236"');
    expect(svg).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*\.ink \{ fill: #e8e8e7; \}\s*\.paper \{ fill: #232323; \}/,
    );
  });
});

describe('the committed brand assets (npm run brand:assets)', () => {
  it('match the current logo: public/favicon.svg is rebuilt from it', () => {
    // A new logo.svg without a rebuild fails here.
    expect(publicFile('favicon.svg').toString('utf8')).toBe(faviconSvg(source));
  });

  it('are the sizes the page and the manifest declare', () => {
    const ico = publicFile('favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1); // an icon
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico.readUInt8(6 + 16 * i));
    expect(sizes).toEqual([16, 32, 48]);
    expect(pngSize(publicFile('apple-touch-icon.png'))).toEqual([180, 180]);
    expect(pngSize(publicFile('icon-192.png'))).toEqual([192, 192]);
    expect(pngSize(publicFile('icon-512.png'))).toEqual([512, 512]);
    expect(pngSize(publicFile('icon-maskable-512.png'))).toEqual([512, 512]);
    expect(pngSize(publicFile('logo.png'))).toEqual([512, 512]);
    expect(pngSize(publicFile('og-image.png'))).toEqual([1200, 630]);

    const manifest = JSON.parse(publicFile('manifest.webmanifest').toString('utf8')) as {
      icons: Array<{ src: string; sizes: string; purpose: string }>;
    };
    expect(manifest.icons.map((i) => `${i.src} ${i.sizes} ${i.purpose}`)).toEqual([
      '/icon-192.png 192x192 any',
      '/icon-512.png 512x512 any',
      '/icon-maskable-512.png 512x512 maskable',
    ]);
  });
});
