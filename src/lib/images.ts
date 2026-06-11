// Article image helpers (brief Item 5).
//
// Storage model (per brief): originals live in Cloudflare R2 at
// `articles/<lesson-id>/hero.png`; Cloudflare Images sits in front and serves
// named variants (thumbnail | card | hero | og) via delivery URLs. When the
// Cloudflare env is absent (local dev), every helper falls back to a bundled
// placeholder so the build still succeeds and pages still render.
//
// NOTE: this supersedes the addendum T10 local-`<Picture>`/sharp approach. The
// 2026-06-11 brief explicitly chose Cloudflare R2 + Images (remote delivery
// URLs), so there is no build-time sharp/LQIP step and no local source files.

import { cloudflareImagesDeliveryUrl } from './cloudflare';

export type ImageVariant = 'thumbnail' | 'card' | 'hero' | 'og';

const SITE_ORIGIN = 'https://learncivicsense.in';

/** Local placeholder used when Cloudflare Images isn't configured. */
const PLACEHOLDER_PATH = '/placeholders/default-article.svg';

/** Approx intrinsic widths of each variant (kept in sync with the dashboard config). */
const VARIANT_WIDTH: Record<ImageVariant, number> = {
  thumbnail: 200,
  card: 600,
  hero: 1200,
  og: 1200,
};

/** The Cloudflare Images image-id convention for an article's hero. */
function heroImageId(articleId: string): string {
  return `articles/${articleId}/hero`;
}

/**
 * Resolve the delivery URL for one article image variant, or the local
 * placeholder when Cloudflare Images is not configured.
 *
 * @param articleId - Lesson id, e.g. `sacred-014`.
 * @param variant - Named Cloudflare Images variant.
 * @param absolute - When true, always return an absolute URL (needed for og:image).
 */
export function getArticleImage(
  articleId: string,
  variant: ImageVariant,
  absolute = false,
): string {
  const url = cloudflareImagesDeliveryUrl(heroImageId(articleId), variant);
  if (url) return url;
  return absolute ? `${SITE_ORIGIN}${PLACEHOLDER_PATH}` : PLACEHOLDER_PATH;
}

/**
 * Build a responsive `srcset` string for an article hero, smallest → largest.
 * Falls back to a single placeholder entry when Cloudflare Images is absent.
 */
export function getArticleImageSrcset(articleId: string): string {
  const variants: ImageVariant[] = ['thumbnail', 'card', 'hero'];
  const entries = variants.map((v) => `${getArticleImage(articleId, v)} ${VARIANT_WIDTH[v]}w`);
  return entries.join(', ');
}

/** The `sizes` attribute that pairs with `getArticleImageSrcset`. */
export function getArticleImageSizes(): string {
  return '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 800px';
}

/** Whether real (non-placeholder) images are being served. */
export { cloudflareImagesEnabled as articleImagesEnabled } from './cloudflare';
