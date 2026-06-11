import { describe, it, expect } from 'vitest';
import { t, formatDate } from '../../src/lib/i18n';

describe('t()', () => {
  it('returns the literal string for simple keys', () => {
    expect(t('siteName')).toBe('learncivicsense.in');
  });

  it('walks dotted paths into nested objects', () => {
    expect(t('article.tldr')).toBe('TL;DR');
    expect(t('article.format.scenario')).toBe('Scenario');
  });

  it('interpolates {var}-style placeholders', () => {
    expect(t('list.minRead', { n: 3 })).toBe('3 min read');
    expect(t('list.lastUpdated', { date: '11 May 2026' })).toBe('Updated 11 May 2026');
  });

  it('chooses the singular form when count === 1', () => {
    expect(t('home.subcategoryCount', { count: 1 })).toBe('1 subcategory');
    expect(t('home.articleCount', { count: 1 })).toBe('1 article');
  });

  it('chooses the plural form when count !== 1', () => {
    expect(t('home.subcategoryCount', { count: 0 })).toBe('0 subcategories');
    expect(t('home.subcategoryCount', { count: 11 })).toBe('11 subcategories');
    expect(t('home.articleCount', { count: 24 })).toBe('24 articles');
  });

  it('falls back to the bare key when no plural variant exists', () => {
    expect(t('siteName', { count: 5 })).toBe('learncivicsense.in');
  });

  it('returns the key when a path is missing entirely', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('leaves unresolved placeholders intact', () => {
    expect(t('list.minRead')).toBe('{n} min read');
  });
});

describe('formatDate()', () => {
  it('formats an ISO date in en-IN', () => {
    expect(formatDate('2026-05-11')).toBe('May 11, 2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns the raw input when unparseable', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('uses Intl for a non-English locale (covers the locale branch)', () => {
    // The routing Locale union is still 'en'; cast to exercise the future-locale path.
    const fd = formatDate as (iso: string, locale?: string) => string;
    const out = fd('2026-05-11', 'hi');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe('2026-05-11');
  });
});

describe('t() locale fallback (i18n stubs)', () => {
  const tt = t as (key: string, vars?: Record<string, string | number>, locale?: string) => string;

  it('falls back to English for an untranslated stub locale', () => {
    // hi.json is a stub with _translated:false → English value is returned.
    expect(tt('article.tldr', {}, 'hi')).toBe('TL;DR');
    expect(tt('siteName', {}, 'ta')).toBe('learncivicsense.in');
  });

  it('falls back to English for an unknown locale code', () => {
    expect(tt('article.tldr', {}, 'zz')).toBe('TL;DR');
  });
});
