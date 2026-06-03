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
    expect(formatDate('2026-05-11')).toBe('11 May 2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns the raw input when unparseable', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
