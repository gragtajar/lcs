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
  /** "Cluster · Subtopic": where the lesson lives. Empty when the page carries no meta. */
  where: string;
  /** Pagefind's keyword window (HTML with `<mark>`); empty for coming-soon stubs. */
  excerpt: string;
  /** Display word for the lesson's format ("Scenario"), when the page carries it. */
  format?: string;
  /** Reading time in minutes, when the page carries it. */
  minutes?: number;
  /** Category id, so a row can carry its cluster's colour (`data-cluster`). */
  clusterId?: string;
  comingSoon: boolean;
}

/** "Traffic and roads · Honking discipline" from the article template's meta spans. */
export function whereOf(d: PagefindResultData): string {
  const cluster = d.meta.cluster ?? '';
  const subtopic = d.meta.subtopic ?? '';
  if (cluster && subtopic) return `${cluster} · ${subtopic}`;
  return cluster || subtopic || '';
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

/** The shareable URL of a search; the bare page when the query is empty. */
export function searchUrl(q: string): string {
  const query = q.trim();
  return query ? `/search/?q=${encodeURIComponent(query)}` : '/search/';
}
