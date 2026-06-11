import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectConnectionTier } from '../../src/lib/network';
import { fetchWithTimeout } from '../../src/lib/fetch-with-timeout';
import { NetworkTimeoutError } from '../../src/lib/errors';
import { createLogger } from '../../src/lib/logger';
import {
  track,
  trackArticleRead,
  trackQuizAttempt,
  trackRelatedLinkClick,
  trackSearchQuery,
  trackLanguageSwitch,
  initAnalytics,
} from '../../src/lib/analytics';
import {
  READING_WPM,
  SEARCH_DEBOUNCE_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
  MAX_CACHE_ENTRIES,
} from '../../src/lib/constants';

describe('detectConnectionTier()', () => {
  const nav = globalThis.navigator as Navigator & { connection?: unknown };
  afterEach(() => {
    // Remove any stub we set.
    if ('connection' in nav) delete (nav as { connection?: unknown }).connection;
  });

  it("returns 'unknown' when the Network Information API is absent", () => {
    expect(detectConnectionTier()).toBe('unknown');
  });

  it("returns 'slow' when Data Saver is on", () => {
    Object.defineProperty(nav, 'connection', { value: { saveData: true }, configurable: true });
    expect(detectConnectionTier()).toBe('slow');
  });

  it("returns 'slow' on 2g effectiveType", () => {
    Object.defineProperty(nav, 'connection', {
      value: { effectiveType: '2g' },
      configurable: true,
    });
    expect(detectConnectionTier()).toBe('slow');
  });

  it("returns 'fast' on 4g", () => {
    Object.defineProperty(nav, 'connection', {
      value: { effectiveType: '4g' },
      configurable: true,
    });
    expect(detectConnectionTier()).toBe('fast');
  });
});

describe('fetchWithTimeout()', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves with the response on success', async () => {
    const res = { ok: true } as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(res)),
    );
    await expect(fetchWithTimeout('/x')).resolves.toBe(res);
  });

  it('wraps an AbortError in NetworkTimeoutError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))),
    );
    await expect(fetchWithTimeout('/slow', {}, 5)).rejects.toBeInstanceOf(NetworkTimeoutError);
  });

  it('re-throws non-abort errors unchanged', async () => {
    const boom = new TypeError('network down');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(boom)),
    );
    await expect(fetchWithTimeout('/x')).rejects.toBe(boom);
  });
});

describe('createLogger()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('exposes the four level methods', () => {
    const log = createLogger('test.module');
    expect(Object.keys(log).sort()).toEqual(['debug', 'error', 'info', 'warn']);
  });

  it('prefixes the message with the logger name and includes context', () => {
    const log = createLogger('lib.thing');
    log.info('hello', { a: 1 });
    expect(console.info).toHaveBeenCalledWith(
      '[lib.thing] hello',
      expect.objectContaining({ logger: 'lib.thing', a: 1 }),
    );
  });

  it('does not throw on error level (Sentry forwarding is guarded off in tests)', () => {
    const log = createLogger('lib.thing');
    expect(() => log.error('boom')).not.toThrow();
  });
});

describe('analytics safe surface (uninitialised)', () => {
  it('track and named helpers are no-ops that never throw', async () => {
    expect(() => track('x', { a: 1 })).not.toThrow();
    expect(() => trackArticleRead({ articleId: 'a', locale: 'en', timeOnPageMs: 1 })).not.toThrow();
    expect(() =>
      trackQuizAttempt({ articleId: 'a', questionId: 'q1', optionId: 'b', correct: true }),
    ).not.toThrow();
    expect(() => trackRelatedLinkClick({ fromArticleId: 'a', toArticleId: 'b' })).not.toThrow();
    expect(() => trackSearchQuery({ query: 'honking', resultCount: 3 })).not.toThrow();
    expect(() => trackLanguageSwitch({ from: 'en', to: 'hi' })).not.toThrow();
  });

  it('initAnalytics resolves and stays uninitialised without an API key', async () => {
    await expect(initAnalytics()).resolves.toBeUndefined();
  });
});

describe('constants', () => {
  it('exposes sane values', () => {
    expect(READING_WPM).toBe(200);
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MAX_CACHE_ENTRIES).toBeGreaterThan(0);
  });
});
