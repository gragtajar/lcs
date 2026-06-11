// Shared magic-number-free constants (addendum item 5 / mapping table #5).
// Import these instead of inlining literals so the future `no-magic-numbers`
// ESLint rule (T2) has a home for the values it would otherwise flag.

/** Words-per-minute used to estimate reading time (English). */
export const READING_WPM = 200;

/** Debounce before firing a search query, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 150;

/** Default network timeout for client-side fetches, in milliseconds. */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/** Max entries kept in any in-memory LRU cache. */
export const MAX_CACHE_ENTRIES = 100;
