// Amplitude product analytics (brief Item 2). BROWSER ONLY.
//
// Privacy stance — DO NOT relax without explicit owner sign-off:
//   - defaultTracking is OFF; we opt into page-views explicitly.
//   - Page-view URLs are stripped of query strings (no PII in URLs).
//   - Do-Not-Track is honoured: if the browser sends DNT, Amplitude is NOT
//     initialised at all.
//   - Never send PII as event props. Article id, locale, option id = fine.
//     Email, IP, free-text = never.
//   - No session replay, no Experiment, no server-side events.
//
// All functions are safe to call before init (no-op) and on the server (no-op).

// Minimal surface of the Amplitude browser SDK we actually call. Avoids an
// inline `import()` type annotation (forbidden by consistent-type-imports) and
// keeps the SDK out of the type graph until it's dynamically imported.
interface AmplitudeLike {
  init: (apiKey: string, options?: Record<string, unknown>) => unknown;
  track: (eventName: string, props?: Record<string, unknown>) => unknown;
}

let initialised = false;
let amplitude: AmplitudeLike | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** True when the user has Do-Not-Track enabled in any of the common forms. */
function doNotTrack(): boolean {
  if (!isBrowser()) return true;
  const nav = navigator as Navigator & { msDoNotTrack?: string; doNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/** Strip query + hash so no PII rides along in the tracked page location. */
function cleanLocation(): string {
  if (!isBrowser()) return '';
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Initialise Amplitude. Idempotent. Bails silently when:
 *   - not in a browser, or
 *   - PUBLIC_AMPLITUDE_API_KEY is unset, or
 *   - Do-Not-Track is on.
 */
export async function initAnalytics(): Promise<void> {
  if (initialised || !isBrowser()) return;
  const apiKey = import.meta.env.PUBLIC_AMPLITUDE_API_KEY as string | undefined;
  if (!apiKey || !apiKey.trim()) return;
  if (doNotTrack()) return;

  initialised = true;
  const serverUrl = import.meta.env.PUBLIC_AMPLITUDE_SERVER_URL as string | undefined;

  // Dynamic import so the SDK never lands in the server/build bundle.
  const mod = (await import('@amplitude/analytics-browser')) as unknown as AmplitudeLike;
  amplitude = mod;
  amplitude.init(apiKey, {
    defaultTracking: false,
    ...(serverUrl ? { serverUrl } : {}),
  });

  // Opt into a single, query-stripped page view.
  amplitude.track('page-view', { location: cleanLocation() });
}

/** Safe event track: no-op until Amplitude is initialised. */
export function track(eventName: string, props: Record<string, unknown> = {}): void {
  if (!initialised || !amplitude) return;
  amplitude.track(eventName, props);
}

// ---- Named event helpers (only non-PII fields) ----

export function trackArticleRead(p: {
  articleId: string;
  locale: string;
  timeOnPageMs: number;
}): void {
  track('article-read', p);
}

export function trackQuizAttempt(p: {
  articleId: string;
  questionId: string;
  optionId: string;
  correct: boolean;
}): void {
  track('quiz-attempt', p);
  if (p.correct) track('quiz-correct', { articleId: p.articleId, questionId: p.questionId });
}

export function trackRelatedLinkClick(p: { fromArticleId: string; toArticleId: string }): void {
  track('related-link-click', p);
}

export function trackSearchQuery(p: { query: string; resultCount: number }): void {
  // The query string is the user's own input; treat as low-sensitivity but keep
  // it short. Do not attach any identity.
  track('search-query', { queryLength: p.query.length, resultCount: p.resultCount });
}

export function trackLanguageSwitch(p: { from: string; to: string }): void {
  track('language-switch', p);
}
