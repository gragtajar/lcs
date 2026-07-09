// Article image helpers (ImageKit.io).
//
// One high-resolution source per article is uploaded to ImageKit; the CDN derives
// every responsive/optimised variant from URL transformations (see imagekit.ts).
// Only articles present in `src/data/article-images.json` have an image — every other
// article renders the bundled placeholder, so an unlisted id never yields a broken
// image. Filename stem == article id (e.g. `sacred-001` -> `sacred-001.png`).

import { imagekitUrl } from './imagekit';
import articleImagesData from '../data/article-images.json' with { type: 'json' };

export type ImageVariant = 'thumbnail' | 'card' | 'hero' | 'og';

const SITE_ORIGIN = 'https://learncivicsense.in';

/** Local placeholder used for articles without an uploaded image. */
const PLACEHOLDER_PATH = '/placeholders/default-article.svg';

/** article id -> ImageKit file path. */
const registry: Record<string, string> = articleImagesData.images;

/** Single-URL width per variant (the CDN resizes the one source to this width). */
const VARIANT_WIDTH: Record<ImageVariant, number> = {
  thumbnail: 200,
  card: 600,
  hero: 1200,
  og: 1200,
};

/** Responsive srcset ladder for the hero — the browser picks by slot width × DPR. */
const HERO_SRCSET_WIDTHS = [400, 640, 800, 1080, 1200, 1600];

/** Whether the given article has an image uploaded to ImageKit. */
export function hasArticleImage(articleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, articleId);
}

function placeholder(absolute: boolean): string {
  return absolute ? `${SITE_ORIGIN}${PLACEHOLDER_PATH}` : PLACEHOLDER_PATH;
}

/**
 * Resolve one article image variant to a delivery URL, or the local placeholder when
 * the article has no uploaded image.
 *
 * @param articleId - Lesson id, e.g. `sacred-001`.
 * @param variant - Named size role.
 * @param absolute - Only affects the placeholder (ImageKit URLs are already absolute).
 *   Needed for og:image, which must be absolute.
 */
export function getArticleImage(
  articleId: string,
  variant: ImageVariant = 'hero',
  absolute = false,
): string {
  const path = registry[articleId];
  if (!path) return placeholder(absolute);
  if (variant === 'og') {
    // Social cards: fixed 1200x630 (default maintain_ratio centre-crop), JPEG for the
    // widest scraper compatibility.
    return imagekitUrl(path, { width: 1200, height: 630, format: 'jpg', quality: 80 });
  }
  return imagekitUrl(path, { width: VARIANT_WIDTH[variant], format: 'auto' });
}

/**
 * Responsive `srcset` for the hero from a single source (f-auto per width), or undefined
 * when the article has no uploaded image (the caller then renders the placeholder src).
 */
export function getArticleImageSrcset(articleId: string): string | undefined {
  const path = registry[articleId];
  if (!path) return undefined;
  return HERO_SRCSET_WIDTHS.map(
    (w) => `${imagekitUrl(path, { width: w, format: 'auto' })} ${w}w`,
  ).join(', ');
}

/** The `sizes` attribute that pairs with `getArticleImageSrcset`. */
export function getArticleImageSizes(): string {
  return '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 800px';
}
