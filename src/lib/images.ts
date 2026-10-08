// Article image helpers (ImageKit.io).
//
// One high-resolution source per article is uploaded to ImageKit; the CDN derives
// every responsive/optimised variant from URL transformations (see imagekit.ts).
// Only articles present in `src/data/article-images.json` have an image; for every
// other article the URL falls back to the site's share image (the logo over the
// site's name, public/og-image.png), so an unlisted id never yields a broken image
// or a share card without one. Filename stem == article id (e.g. `sacred-001` ->
// `sacred-001.png`).

import { imagekitUrl } from './imagekit';
import articleImagesData from '../data/article-images.json' with { type: 'json' };

export type ImageVariant = 'hero' | 'og';

const SITE_ORIGIN = 'https://learncivicsense.in';

/** The site's share image, for articles without an uploaded image (a PNG: share cards take no SVG). */
const FALLBACK_PATH = '/og-image.png';

/** article id -> ImageKit file path. */
const registry: Record<string, string> = articleImagesData.images;

/** Single-URL width per variant (the CDN resizes the one source to this width). */
const VARIANT_WIDTH: Record<ImageVariant, number> = {
  hero: 1200,
  og: 1200,
};

/** Responsive srcset ladder for the hero — the browser picks by slot width × DPR. */
const HERO_SRCSET_WIDTHS = [400, 640, 800, 1080, 1200, 1600];

/** Whether the given article has an image uploaded to ImageKit. */
export function hasArticleImage(articleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, articleId);
}

function fallback(absolute: boolean): string {
  return absolute ? `${SITE_ORIGIN}${FALLBACK_PATH}` : FALLBACK_PATH;
}

/**
 * Resolve one article image variant to a delivery URL, or the site's share image when
 * the article has no uploaded image.
 *
 * @param articleId - Lesson id, e.g. `sacred-001`.
 * @param variant - Named size role.
 * @param absolute - Only affects the fallback (ImageKit URLs are already absolute).
 *   Needed for og:image, which must be absolute.
 */
export function getArticleImage(
  articleId: string,
  variant: ImageVariant = 'hero',
  absolute = false,
): string {
  const path = registry[articleId];
  if (!path) return fallback(absolute);
  if (variant === 'og') {
    // Social cards: fixed 1200x630 (default maintain_ratio centre-crop), JPEG for the
    // widest scraper compatibility.
    return imagekitUrl(path, { width: 1200, height: 630, format: 'jpg', quality: 80 });
  }
  return imagekitUrl(path, { width: VARIANT_WIDTH[variant], format: 'auto' });
}

/**
 * Responsive `srcset` for the hero from a single source (f-auto per width), or undefined
 * when the article has no uploaded image.
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

/**
 * Widths of the lesson thumbnail beside a row's text (lesson lists, search
 * results): its largest slot is 272px, so 320w
 * serves it at 1x and 640w at 2x; the browser picks by slot × DPR.
 */
const THUMB_1X = 320;
const THUMB_2X = 640;

export interface ArticleThumb {
  src: string;
  srcset: string;
}

/** A lesson row's thumbnail, or undefined when the article has no uploaded image. */
export function getArticleThumb(articleId: string): ArticleThumb | undefined {
  const path = registry[articleId];
  if (!path) return undefined;
  const at = (width: number) => imagekitUrl(path, { width, format: 'auto' });
  return {
    src: at(THUMB_1X),
    srcset: `${at(THUMB_1X)} ${THUMB_1X}w, ${at(THUMB_2X)} ${THUMB_2X}w`,
  };
}

/**
 * Widths of the picture a homepage topic leads with: the lesson lists' size,
 * up to 240px on a desktop and 40% of the column on a phone (about 130-160px),
 * so up to 560 for a 3x phone or a 2x desktop. The browser picks the first
 * width at or above slot × DPR, so the steps stay under ~20%: Lighthouse's
 * desktop (240px at 1x) gets 240, its phone (152px at 1.75x, 266px) gets 280;
 * a wider gap there downloads unseen bytes that Lighthouse fails as an
 * oversized image.
 */
const LEAD_WIDTHS = [240, 280, 320, 360, 400, 480, 560];

/** A featured topic's lead picture, or undefined when the article has no uploaded image. */
export function getArticleLeadPicture(articleId: string): ArticleThumb | undefined {
  const path = registry[articleId];
  if (!path) return undefined;
  const at = (width: number) => imagekitUrl(path, { width, format: 'auto' });
  return {
    src: at(320),
    srcset: LEAD_WIDTHS.map((w) => `${at(w)} ${w}w`).join(', '),
  };
}
