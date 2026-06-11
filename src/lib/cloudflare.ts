// Cloudflare integration helpers (brief Item 1).
//
// This module is intentionally side-effect free: it never calls the Cloudflare
// API at import time, and it never throws on missing env. The build must succeed
// locally with no Cloudflare vars set (images fall back to placeholders).
//
// Env contract (see .env.example):
//   PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH  — public delivery-URL hash (browser-safe)
//   CLOUDFLARE_IMAGES_ACCOUNT_HASH         — same, server-side fallback
//   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_ZONE_ID / *_API_TOKEN — management only,
//                                            not used at request time.

/** Public account hash, preferring the PUBLIC_ (browser-exposed) var. */
function imagesAccountHash(): string | undefined {
  const pub = import.meta.env.PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH as string | undefined;
  const srv = import.meta.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH as string | undefined;
  return (pub && pub.trim()) || (srv && srv.trim()) || undefined;
}

/**
 * Build a Cloudflare Images delivery URL.
 *
 * Shape: `https://imagedelivery.net/<account-hash>/<image-id>/<variant>`.
 * Returns `undefined` when the account hash isn't configured, so callers can
 * fall back to a local placeholder (see `src/lib/images.ts`).
 *
 * @param imageId - Image identifier in Cloudflare Images (e.g. `articles/sacred-014/hero`).
 * @param variant - Named variant configured in the dashboard (`thumbnail`|`card`|`hero`|`og`).
 */
export function cloudflareImagesDeliveryUrl(imageId: string, variant: string): string | undefined {
  const hash = imagesAccountHash();
  if (!hash) return undefined;
  const safeId = imageId.replace(/^\/+/, '');
  return `https://imagedelivery.net/${hash}/${safeId}/${variant}`;
}

/** Whether Cloudflare Images delivery is configured (account hash present). */
export function cloudflareImagesEnabled(): boolean {
  return imagesAccountHash() !== undefined;
}

/**
 * Health check the build script can call to refuse to build when a critical
 * Cloudflare env is missing. Does NOT throw — returns a report.
 *
 * `required` lists only the vars that must exist for a *production* build that
 * serves real Cloudflare-hosted images. Local/dev builds can ignore the report
 * (images fall back to placeholders).
 */
export function cloudflareEnvOk(): { ok: boolean; missing: string[] } {
  const required: Array<[string, string | undefined]> = [
    [
      'PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH',
      import.meta.env.PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH as string | undefined,
    ],
  ];
  const missing = required.filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  return { ok: missing.length === 0, missing };
}
