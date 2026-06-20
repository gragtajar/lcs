// Share helpers (ShareBar brief §9).
//
// buildShareLinks is pure and runs at build time to produce the per-platform
// fallback hrefs. canNativeShare / invokeNativeShare / copyToClipboard are the
// client-side handlers, kept here (not inline in the .astro script) so they're
// unit-testable with a mocked navigator.

export interface ShareTarget {
  /** Canonical absolute URL of the article. */
  url: string;
  /** Article title. */
  title: string;
}

export interface ShareLinks {
  whatsapp: string;
  twitter: string;
  linkedin: string;
  telegram: string;
  email: string;
}

export type SharePlatform =
  | 'native'
  | 'whatsapp'
  | 'twitter'
  | 'linkedin'
  | 'telegram'
  | 'email'
  | 'copy_link';

/** Build per-platform share-intent URLs (all params percent-encoded). */
export function buildShareLinks({ url, title }: ShareTarget): ShareLinks {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    whatsapp: `https://api.whatsapp.com/send?text=${t}%20${u}`,
    twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}&via=learncivicsense`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    email: `mailto:?subject=${t}&body=${u}`,
  };
}

/** Whether the Web Share API is available in this browser. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Invoke the Web Share API. Returns true when the share completes, false when the
 * API is unavailable OR the user dismisses the sheet (AbortError). A dismissal is
 * not an error and is never surfaced.
 */
export async function invokeNativeShare(data: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

/** Copy text to the clipboard. Returns true on success, false when unavailable/blocked. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard blocked (permissions / insecure context) — fall through */
  }
  return false;
}
