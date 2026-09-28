// Search helpers shared by the two search surfaces — the top-bar overlay
// (src/islands/SearchOverlay.tsx) and the /search/ page (src/islands/SearchPage.tsx):
// loading the Pagefind runtime on demand, and turning its result records into the
// one row both surfaces render. Everything but loadPagefind is pure.

export interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

export interface PagefindResultData {
  url: string;
  /** `title` comes from the page's h1; the rest are our `data-pagefind-meta` spans. */
  meta: { title?: string } & Record<string, string>;
  /** Keyword window as HTML: the matched terms are wrapped in `<mark>`. */
  excerpt: string;
  filters?: Record<string, string[]>;
}

export interface PagefindAPI {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
}

declare global {
  interface Window {
    __pagefind?: PagefindAPI | Promise<PagefindAPI>;
  }
}

/** Written by `pagefind --site dist` after the Astro build; absent in `astro dev`. */
const PAGEFIND_URL = '/pagefind/pagefind.js';

/** Load the Pagefind runtime once per page; null when the index is not there. */
export async function loadPagefind(): Promise<PagefindAPI | null> {
  if (window.__pagefind) {
    return (await window.__pagefind) as PagefindAPI;
  }
  try {
    // Vite needs to leave this path alone — Pagefind writes this file post-build.
    const mod = (await import(/* @vite-ignore */ PAGEFIND_URL)) as PagefindAPI;
    window.__pagefind = mod;
    return mod;
  } catch (err) {
    console.warn('[search] Pagefind not available yet (run a production build).', err);
    return null;
  }
}

export interface ResultRow {
  url: string;
  title: string;
  /** The topic the lesson lives in. Empty when the page carries no meta. */
  where: string;
  /** Pagefind's keyword window (HTML with `<mark>`); empty for coming-soon stubs. */
  excerpt: string;
  /** Display word for the lesson's format ("Scenario"), when the page carries it. */
  format?: string;
  /** Reading time in minutes, when the page carries it. */
  minutes?: number;
  /** Category id, so a row can carry its cluster's colour (`data-cluster`). */
  clusterId?: string;
  /** The lesson's illustration at row size, when it has one (`thumb` meta). */
  thumb?: { src: string; srcset?: string };
  comingSoon: boolean;
}

/** "Traffic and roads": the topic, from the article template's `cluster` meta. */
export function whereOf(d: PagefindResultData): string {
  return d.meta.cluster ?? '';
}

export function isComingSoon(d: PagefindResultData): boolean {
  return (d.meta.status ?? '').toLowerCase().includes('coming-soon');
}

/** One result record → the row. A stub's excerpt is its placeholder text, so it is dropped. */
export function toRow(d: PagefindResultData): ResultRow {
  const comingSoon = isComingSoon(d);
  const minutes = Number.parseInt(d.meta.minutes ?? '', 10);
  return {
    url: d.url,
    title: d.meta.title ?? d.url,
    where: whereOf(d),
    excerpt: comingSoon ? '' : (d.excerpt ?? ''),
    format: d.meta.format || undefined,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
    clusterId: d.meta.clusterId || undefined,
    thumb:
      !comingSoon && d.meta.thumb
        ? { src: d.meta.thumb, srcset: d.meta.thumb_srcset || undefined }
        : undefined,
    comingSoon,
  };
}

/**
 * Published lessons before coming-soon stubs, keeping Pagefind's relevance order
 * inside each group: a stub that outranks a real lesson on words alone still
 * cannot be read today.
 */
export function sortStubsLast(rows: ResultRow[]): ResultRow[] {
  return [...rows].sort((a, b) => Number(a.comingSoon) - Number(b.comingSoon));
}

/** Picks the `_one`/`_other` form of a string and fills `{count}`. */
export function plural(count: number, one: string, other: string): string {
  return (count === 1 ? one : other).replace('{count}', String(count));
}

/** The `q` of a `?q=` query string, trimmed; empty when absent. */
export function queryFromSearch(search: string): string {
  return new URLSearchParams(search).get('q')?.trim() ?? '';
}

/** Words in an address that say nothing about what the reader was after. */
const PATH_NOISE = new Set([
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'are',
  'not',
  'how',
  'why',
  'what',
  'when',
  'where',
  'who',
  'its',
  'can',
  'from',
  'into',
  'html',
  'htm',
  'php',
  'index',
  'www',
]);

/**
 * The words of a missing page's address, most specific first (the last path
 * segment leads), for the 404 page's "closest matches": at most `max`, each
 * three letters or more, no numbers or filler words, no repeats.
 * `/traffic/honking-disciplin/the-case-against-honkng/` gives
 * `case against honkng honking disciplin traffic`.
 */
export function queryWordsFromPath(pathname: string, max = 6): string[] {
  const segments = pathname.split('/').filter(Boolean).reverse();
  const words: string[] = [];
  for (const segment of segments) {
    let text = segment;
    try {
      text = decodeURIComponent(segment);
    } catch {
      // A malformed escape: use the raw segment.
    }
    // Letters, combining marks (the vowel signs of Devanagari and other Indian
    // scripts) and digits make a word; anything else separates words.
    for (const word of text.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)) {
      if (word.length < 3 || /^\p{N}+$/u.test(word) || PATH_NOISE.has(word)) continue;
      if (!words.includes(word)) words.push(word);
      if (words.length === max) return words;
    }
  }
  return words;
}

/**
 * Whether a search result plausibly answers a missing page's address: its title
 * or URL shares a word stem (the first four letters) with the address. Pagefind
 * forgives typos generously enough to "match" a nonsense address to some lesson,
 * and a suggestion that shares nothing with the address would only mislead.
 */
export function sharesAddressWord(row: Pick<ResultRow, 'title' | 'url'>, words: string[]): boolean {
  const text = `${row.title} ${row.url}`.toLowerCase();
  return words.some((word) => text.includes(word.slice(0, 4)));
}

/** The shareable URL of a search; the bare page when the query is empty. */
export function searchUrl(q: string): string {
  const query = q.trim();
  return query ? `/search/?q=${encodeURIComponent(query)}` : '/search/';
}
