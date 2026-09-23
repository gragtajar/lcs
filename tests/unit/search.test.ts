import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadPagefind,
  plural,
  toRow,
  whereOf,
  isComingSoon,
  sortStubsLast,
  queryFromSearch,
  searchUrl,
  type PagefindResultData,
  type PagefindAPI,
} from '../../src/lib/search';

function record(meta: Record<string, string>, excerpt = '<mark>Honking</mark> at red lights') {
  return { url: '/traffic/honking-discipline/x/', meta, excerpt } as PagefindResultData;
}

describe('whereOf()', () => {
  it('joins cluster and subtopic with an interpunct', () => {
    expect(whereOf(record({ cluster: 'Traffic and roads', subtopic: 'Honking discipline' }))).toBe(
      'Traffic and roads · Honking discipline',
    );
  });
  it('falls back to whichever part exists', () => {
    expect(whereOf(record({ cluster: 'Traffic and roads' }))).toBe('Traffic and roads');
    expect(whereOf(record({ subtopic: 'Honking discipline' }))).toBe('Honking discipline');
    expect(whereOf(record({}))).toBe('');
  });
});

describe('toRow()', () => {
  it('maps a published lesson with its format and reading time', () => {
    const row = toRow(
      record({
        title: 'Honking at red lights',
        cluster: 'Traffic and roads',
        subtopic: 'Honking discipline',
        format: 'Scenario',
        minutes: '3',
        clusterId: 'traffic',
      }),
    );
    expect(row).toEqual({
      url: '/traffic/honking-discipline/x/',
      title: 'Honking at red lights',
      where: 'Traffic and roads · Honking discipline',
      excerpt: '<mark>Honking</mark> at red lights',
      format: 'Scenario',
      minutes: 3,
      clusterId: 'traffic',
      comingSoon: false,
    });
  });

  it('drops the placeholder excerpt and reading time of a coming-soon stub', () => {
    const row = toRow(record({ title: 'UAE PDAs', status: 'coming-soon', minutes: '' }));
    expect(isComingSoon(record({ status: 'coming-soon' }))).toBe(true);
    expect(row.comingSoon).toBe(true);
    expect(row.excerpt).toBe('');
    expect(row.minutes).toBeUndefined();
    expect(row.format).toBeUndefined();
  });

  it('falls back to the url when the page has no title', () => {
    expect(toRow(record({})).title).toBe('/traffic/honking-discipline/x/');
  });
});

describe('sortStubsLast()', () => {
  it('moves stubs after published lessons without reordering either group', () => {
    const rows = [
      toRow(record({ title: 'a', status: 'coming-soon' })),
      toRow(record({ title: 'b' })),
      toRow(record({ title: 'c', status: 'coming-soon' })),
      toRow(record({ title: 'd' })),
    ];
    expect(sortStubsLast(rows).map((r) => r.title)).toEqual(['b', 'd', 'a', 'c']);
    expect(rows.map((r) => r.title)).toEqual(['a', 'b', 'c', 'd']); // input untouched
  });
});

describe('plural()', () => {
  it('picks the form by count and fills {count}', () => {
    expect(plural(1, 'Show 1 more', 'Show {count} more')).toBe('Show 1 more');
    expect(plural(3, 'Show 1 more', 'Show {count} more')).toBe('Show 3 more');
    expect(plural(0, '{count} lesson', '{count} lessons')).toBe('0 lessons');
  });
});

describe('queryFromSearch() / searchUrl()', () => {
  it('reads and trims ?q=, and round-trips through the shareable URL', () => {
    expect(queryFromSearch('?q=%20honking%20')).toBe('honking');
    expect(queryFromSearch('?x=1')).toBe('');
    expect(queryFromSearch('')).toBe('');
    expect(searchUrl('queue jumping')).toBe('/search/?q=queue%20jumping');
    expect(searchUrl('   ')).toBe('/search/');
    expect(queryFromSearch(new URL(searchUrl('a&b'), 'https://x.test').search)).toBe('a&b');
  });
});

describe('loadPagefind()', () => {
  afterEach(() => {
    delete window.__pagefind;
    vi.restoreAllMocks();
  });

  it('returns the runtime already on the window, awaiting a pending load', async () => {
    const api: PagefindAPI = { search: async () => ({ results: [] }) };
    window.__pagefind = Promise.resolve(api);
    expect(await loadPagefind()).toBe(api);
  });

  it('returns null (and warns) when the index is not built', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadPagefind()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
