// ImageKit.io URL builder (replaces the Cloudflare Images delivery-URL helper).
//
// Docs consulted (2026-07):
//   - https://imagekit.io/docs/transformations        (URL syntax: path `tr:` vs query `?tr=`)
//   - https://imagekit.io/docs/image-resize-and-crop  (w-, h-, crop modes; width-only keeps ratio)
//   - https://imagekit.io/docs/image-optimization     (f-auto format, q- default 80)
//
// ImageKit is URL-based: ONE high-resolution source is uploaded per article, and the
// CDN derives every responsive/optimised variant on the fly from URL transformations.
// That is exactly the "single HD source for all devices + networks" model — the browser
// picks the right width from a srcset, and `f-auto` serves WebP/AVIF (via the Accept
// header) so low-bandwidth clients get a small file from the same source.
//
// We build PATH-form transformation URLs (`.../tr:w-800,f-auto/<path>`) rather than the
// query form so nothing collides with query strings, and we keep the URLs stable (no
// `updatedAt` cache-buster) so the CDN caches each variant; ImageKit purges on re-upload.

/** Fallback delivery endpoint (public; the project's ImageKit id). */
const DEFAULT_ENDPOINT = 'https://ik.imagekit.io/civic';

/** Public ImageKit delivery endpoint, e.g. `https://ik.imagekit.io/civic` (no trailing slash). */
export function imagekitEndpoint(): string {
  const env = import.meta.env.PUBLIC_IMAGEKIT_URL_ENDPOINT as string | undefined;
  const value = env && env.trim() ? env.trim() : DEFAULT_ENDPOINT;
  return value.replace(/\/+$/, '');
}

export interface ImagekitTransform {
  /** Target width in px. Width-only auto-scales height, preserving aspect ratio. */
  width?: number;
  /** Target height in px (with width, default crop `maintain_ratio` fills + centre-crops). */
  height?: number;
  /** Output format. `auto` (default) negotiates WebP/AVIF/original via the Accept header. */
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  /** Quality 1-100. ImageKit's documented default is 80; only emitted when set. */
  quality?: number;
  /** Crop token minus the `c-` prefix, e.g. `maintain_ratio`, `at_max`, `force`. */
  crop?: string;
}

/** Serialise a transform to ImageKit's comma-separated token string (e.g. `w-800,f-auto`). */
export function serialiseTransform(t: ImagekitTransform): string {
  const parts: string[] = [];
  if (t.width) parts.push(`w-${Math.round(t.width)}`);
  if (t.height) parts.push(`h-${Math.round(t.height)}`);
  parts.push(`f-${t.format ?? 'auto'}`);
  if (typeof t.quality === 'number') parts.push(`q-${t.quality}`);
  if (t.crop) parts.push(`c-${t.crop}`);
  return parts.join(',');
}

/**
 * Build a path-form ImageKit delivery URL:
 *   `https://ik.imagekit.io/<id>/tr:w-800,f-auto/<path>`
 *
 * @param path - File path within the endpoint (e.g. `sacred-001.png`).
 * @param transform - Resize/format/quality transformation.
 */
export function imagekitUrl(path: string, transform: ImagekitTransform): string {
  const clean = path.replace(/^\/+/, '');
  return `${imagekitEndpoint()}/tr:${serialiseTransform(transform)}/${clean}`;
}
