// The site's logo is the owner's artwork, src/assets/logo.svg, kept byte for
// byte: a hand-inked frame and figure (#232323) on paper (#E8E8E7), drawn on an
// artboard of the same paper. Every use of it is derived here, so a new version
// of the file updates them all:
//   - inlineLogo(): the mark in the pages' top bar and footer. The artboard is
//     dropped (the frame's own edge meets the page) and ink and paper take
//     classes, so CSS can colour them from the theme (tokens.css swaps them in
//     the dark theme, where dark ink would vanish into the page).
//   - faviconSvg(): the browser-tab icon, centred on a square, swapping ink and
//     paper itself when the browser's own UI is dark.
//   - markSvg(): the mark with fixed colours, for the raster icons and the share
//     image (scripts/build-brand-assets.mjs).
// parseLogo() refuses a file of another shape, so a changed logo fails the
// build loudly instead of rendering wrongly.

export const LOGO_INK = '#232323';
export const LOGO_PAPER = '#E8E8E7';

/**
 * @typedef {{ d: string, attrs: string }} LogoPath
 * @typedef {{ viewBox: string, width: number, height: number, ink: LogoPath, paper: LogoPath[] }} Logo
 */

/**
 * Read the artwork: its viewBox, the one ink path and the paper paths (the
 * artboard rectangle is checked and left out).
 * @param {string} svg
 * @returns {Logo}
 */
export function parseLogo(svg) {
  const viewBox = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) throw new Error('logo.svg: no viewBox on <svg>');
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  if (x !== 0 || y !== 0 || !(width > 0) || !(height > 0)) {
    throw new Error(`logo.svg: unexpected viewBox "${viewBox}"`);
  }

  const body = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const rects = body.match(/<rect\b[^>]*\/>/g) ?? [];
  if (
    rects.length !== 1 ||
    !rects[0].includes(`fill="${LOGO_PAPER}"`) ||
    !rects[0].includes(`width="${width}"`) ||
    !rects[0].includes(`height="${height}"`)
  ) {
    throw new Error('logo.svg: expected one paper-coloured artboard covering the viewBox');
  }

  /** @type {LogoPath[]} */
  const ink = [];
  /** @type {LogoPath[]} */
  const paper = [];
  for (const el of body.match(/<path\b[^>]*\/>/g) ?? []) {
    const d = /\bd="([^"]+)"/.exec(el)?.[1];
    const fill = /\bfill="([^"]+)"/.exec(el)?.[1];
    if (!d) throw new Error('logo.svg: a <path> has no d');
    // Keep the attributes that shape the path (the head is a hole: evenodd).
    const attrs = ['fill-rule', 'clip-rule']
      .map((name) => new RegExp(`\\b${name}="([^"]+)"`).exec(el))
      .filter((m) => m !== null)
      .map((m) => ` ${m[0]}`)
      .join('');
    if (fill === LOGO_INK) ink.push({ d, attrs });
    else if (fill === LOGO_PAPER) paper.push({ d, attrs });
    else throw new Error(`logo.svg: a <path> has an unexpected fill "${fill}"`);
  }
  const rest = body
    .replace(/<rect\b[^>]*\/>/g, '')
    .replace(/<path\b[^>]*\/>/g, '')
    .trim();
  if (rest) throw new Error('logo.svg: unexpected content besides the artboard and paths');
  if (ink.length !== 1 || paper.length === 0) {
    throw new Error('logo.svg: expected one ink path and at least one paper path');
  }
  return { viewBox, width, height, ink: ink[0], paper };
}

/** @param {LogoPath} p @param {string} extra */
const pathEl = (p, extra) => `<path${extra} d="${p.d}"${p.attrs}/>`;

/**
 * The mark for a page: no artboard, ink and paper as classes, decorative (the
 * site's name beside it is the link's text).
 * @param {string} svg
 * @param {string} [className]
 */
export function inlineLogo(svg, className = '') {
  const logo = parseLogo(svg);
  const cls = ['logo', className].filter(Boolean).join(' ');
  return (
    `<svg class="${cls}" viewBox="${logo.viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">` +
    pathEl(logo.ink, ' class="logo-ink"') +
    logo.paper.map((p) => pathEl(p, ' class="logo-paper"')).join('') +
    '</svg>'
  );
}

/**
 * The mark with fixed colours on a transparent ground, for rasterising.
 * @param {string} svg
 * @param {{ ink?: string, paper?: string }} [colours]
 */
export function markSvg(svg, colours = {}) {
  const logo = parseLogo(svg);
  const ink = colours.ink ?? LOGO_INK;
  const paper = colours.paper ?? LOGO_PAPER;
  return (
    `<svg viewBox="${logo.viewBox}" xmlns="http://www.w3.org/2000/svg">` +
    pathEl(logo.ink, ` fill="${ink}"`) +
    logo.paper.map((p) => pathEl(p, ` fill="${paper}"`)).join('') +
    '</svg>'
  );
}

/**
 * The browser-tab icon: the mark centred on a square (a tab draws icons
 * square), in its own colours, and swapped when the browser's UI is dark.
 * @param {string} svg
 */
export function faviconSvg(svg) {
  const logo = parseLogo(svg);
  const side = Math.max(logo.width, logo.height);
  const x = (logo.width - side) / 2;
  const y = (logo.height - side) / 2;
  const ink = LOGO_INK.toLowerCase();
  const paper = LOGO_PAPER.toLowerCase();
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}">`,
    '  <style>',
    `    .ink { fill: ${ink}; }`,
    `    .paper { fill: ${paper}; }`,
    '    @media (prefers-color-scheme: dark) {',
    `      .ink { fill: ${paper}; }`,
    `      .paper { fill: ${ink}; }`,
    '    }',
    '  </style>',
    `  ${pathEl(logo.ink, ' class="ink"')}`,
    ...logo.paper.map((p) => `  ${pathEl(p, ' class="paper"')}`),
    '</svg>',
    '',
  ].join('\n');
}
