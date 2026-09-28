import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadPagefind,
  plural,
  toRow,
  whereOf,
  isComingSoon,
  sortStubsLast,
  queryFromSearch,
  queryWordsFromPath,
  sharesAddressWord,
  searchUrl,
  type PagefindResultData,
  type PagefindAPI,
} from '../../src/lib/search';

function record(meta: Record<string, string>, excerpt = '<mark>Honking</mark> at red lights') {
  return { url: '/traffic/x/', meta, excerpt } as PagefindResultData;
}

describe('whereOf()', () => {
  it('names the topic the lesson lives in (the site has no subtopics, ADR 011)', () => {
    expect(whereOf(record({ cluster: 'Traffic and roads' }))).toBe('Traffic and roads');
    // A stray subtopic meta from an old index is not shown.
    expect(whereOf(record({ cluster: 'Traffic and roads', subtopic: 'Honking' }))).toBe(
      'Traffic and roads',
    );
    expect(whereOf(record({}))).toBe('');
  });
});

describe('toRow()', () => {
  it('maps a published lesson with its format and reading time', () => {
    const row = toRow(
      record({
        title: 'Honking at red lights',
        cluster: 'Traffic and roads',
        format: 'Scenario',
        minutes: '3',
        clusterId: 'traffic',
      }),
    );
    expect(row).toEqual({
      url: '/traffic/x/',
      title: 'Honking at red lights',
      where: 'Traffic and roads',
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

  it('carries the illustration of a lesson that has one, never of a stub', () => {
    const src = 'https://ik.imagekit.io/civic/tr:w-320,f-auto/sacred-004.png';
    const srcset = `${src} 320w, https://ik.imagekit.io/civic/tr:w-640,f-auto/sacred-004.png 640w`;
    expect(toRow(record({ title: 'Gurdwara', thumb: src, thumb_srcset: srcset })).thumb).toEqual({
      src,
      srcset,
    });
    expect(toRow(record({ title: 'Gurdwara' })).thumb).toBeUndefined();
    expect(
      toRow(record({ title: 'Soon', status: 'coming-soon', thumb: src })).thumb,
    ).toBeUndefined();
  });

  it('falls back to the url when the page has no title', () => {
    expect(toRow(record({})).title).toBe('/traffic/x/');
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

describe('queryWordsFromPath()', () => {
  it('reads a broken lesson address most-specific first, without filler', () => {
    expect(queryWordsFromPath('/traffic/honking-disciplin/the-case-against-honkng/')).toEqual([
      'case',
      'against',
      'honkng',
      'honking',
      'disciplin',
      'traffic',
    ]);
  });

  it('drops numbers, short words, file endings and repeats, and caps the count', () => {
    expect(queryWordsFromPath('/2024/03/queue-queue-at-an-atm.html')).toEqual(['queue', 'atm']);
    expect(queryWordsFromPath('/a/b/c/d-e-f-g-h-i-jjj-kkk-lll-mmm-nnn-ooo-ppp/', 3)).toEqual([
      'jjj',
      'kkk',
      'lll',
    ]);
  });

  it('decodes escapes, and keeps a malformed one as written', () => {
    expect(queryWordsFromPath('/search%20terms/')).toEqual(['search', 'terms']);
    expect(queryWordsFromPath('/bad%E0%A4escape/')).toEqual(['bad', 'a4escape']);
  });

  it('keeps words in Indian scripts whole, vowel signs included', () => {
    expect(queryWordsFromPath('/%E0%A4%B9%E0%A5%89%E0%A4%B0%E0%A5%8D%E0%A4%A8-bajana/')).toEqual([
      'हॉर्न',
      'bajana',
    ]);
  });

  it('finds nothing to search in the 404 page’s own address or the root', () => {
    expect(queryWordsFromPath('/404.html')).toEqual([]);
    expect(queryWordsFromPath('/')).toEqual([]);
  });
});

describe('sharesAddressWord()', () => {
  const lesson = {
    title: 'The case against honking, yes, even in Bengaluru',
    url: '/traffic/the-case-against-honking/',
  };

  it('accepts a result that shares a word stem with the address, typos included', () => {
    expect(sharesAddressWord(lesson, ['honkng'])).toBe(true);
    expect(sharesAddressWord(lesson, ['trafic'])).toBe(true);
  });

  it('rejects a result that shares nothing with the address', () => {
    expect(sharesAddressWord(lesson, ['zzqq', 'xxyy'])).toBe(false);
    expect(sharesAddressWord(lesson, [])).toBe(false);
  });
});
