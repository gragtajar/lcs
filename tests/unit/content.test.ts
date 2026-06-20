import { describe, it, expect } from 'vitest';
import {
  loadTaxonomy,
  getNavCategories,
  getCategory,
  getSubtopic,
  findPlannedArticle,
  loadLessonForArticle,
  loadVisitorsModule,
  resolveRelated,
  articleUrl,
  subtopicUrl,
  categoryUrl,
  visitorsUrl,
  trimmedString,
  optionalTrimmedString,
  normaliseDate,
} from '../../src/lib/content';

describe('frontmatter string coercion helpers', () => {
  it('trimmedString trims strings and returns "" for non-strings', () => {
    expect(trimmedString('  hi  ')).toBe('hi');
    expect(trimmedString('')).toBe('');
    expect(trimmedString(undefined)).toBe('');
    expect(trimmedString(42)).toBe('');
  });

  it('optionalTrimmedString returns the trimmed value or undefined when empty/non-string', () => {
    expect(optionalTrimmedString('  Override  ')).toBe('Override');
    expect(optionalTrimmedString('   ')).toBeUndefined();
    expect(optionalTrimmedString('')).toBeUndefined();
    expect(optionalTrimmedString(123)).toBeUndefined();
  });

  it('normaliseDate formats a Date (UTC parts) to ISO YYYY-MM-DD', () => {
    // js-yaml stores `last_updated: 2026-06-04` as UTC midnight.
    expect(normaliseDate(new Date(Date.UTC(2026, 5, 4)))).toBe('2026-06-04');
    // Zero-padding for single-digit month/day.
    expect(normaliseDate(new Date(Date.UTC(2026, 0, 9)))).toBe('2026-01-09');
  });

  it('normaliseDate passes an ISO string through (trimmed) and rejects garbage', () => {
    expect(normaliseDate('2026-06-04')).toBe('2026-06-04');
    expect(normaliseDate('  2026-06-04  ')).toBe('2026-06-04');
    expect(normaliseDate('')).toBe('');
    expect(normaliseDate(undefined)).toBe('');
    expect(normaliseDate(42)).toBe('');
    expect(normaliseDate(new Date('not-a-date'))).toBe('');
  });
});

describe('loadTaxonomy()', () => {
  it('parses taxonomy.json with v2 shape', () => {
    const tax = loadTaxonomy();
    expect(tax.clusters.length).toBeGreaterThan(0);
    expect(tax.abroad_packs.length).toBeGreaterThan(0);
    expect(tax.visitors_module).toBeDefined();
  });

  it('memoises subsequent reads', () => {
    expect(loadTaxonomy()).toBe(loadTaxonomy());
  });
});

describe('getNavCategories()', () => {
  it('returns 11 India + 3 abroad = 14 navigable categories', () => {
    const nav = getNavCategories();
    expect(nav).toHaveLength(14);
    expect(nav.filter((c) => c.group === 'india')).toHaveLength(11);
    expect(nav.filter((c) => c.group === 'abroad')).toHaveLength(3);
  });

  it('each category has a positive lessonCount and subtopicCount', () => {
    for (const c of getNavCategories()) {
      expect(c.lessonCount).toBeGreaterThan(0);
      expect(c.subtopicCount).toBeGreaterThan(0);
      expect(c.subtopics).toHaveLength(c.subtopicCount);
    }
  });

  it('exposes planned articles with category + subtopic back-references', () => {
    const traffic = getCategory('traffic');
    const a = traffic?.subtopics[0]?.articles[0];
    expect(a?.category.id).toBe('traffic');
    expect(a?.subtopic.id).toBe(traffic?.subtopics[0]?.id);
  });
});

describe('getCategory() / getSubtopic() / findPlannedArticle()', () => {
  it('finds Traffic > Honking discipline > traffic-001', () => {
    const ctx = getSubtopic('traffic', 'honking-discipline');
    expect(ctx?.category.title).toBe('Traffic and roads');
    expect(ctx?.subtopic.articles).toContainEqual(
      expect.objectContaining({ id: 'traffic-001', published: true }),
    );
  });

  it('flags the 6 launch lessons as published via allowlist', () => {
    const launchIds = [
      'traffic-001',
      'traffic-005',
      'traffic-009',
      'transit-001',
      'transit-003',
      'transit-013',
    ];
    for (const id of launchIds) {
      const a = getNavCategories()
        .flatMap((c) => c.subtopics)
        .flatMap((s) => s.articles)
        .find((a) => a.id === id);
      expect(a?.published, `${id} should be published`).toBe(true);
    }
  });

  it('flags planned-but-not-written lessons as not published', () => {
    // This water-pools lesson remains unwritten (no .md on disk) → coming-soon.
    const a = findPlannedArticle('water-pools', 'pool-hygiene', 'what-chlorine-does-and-doesnt-do');
    expect(a?.published).toBe(false);
  });

  it('returns undefined for unknown slugs / categories', () => {
    expect(getCategory('nonexistent')).toBeUndefined();
    expect(getSubtopic('traffic', 'nonexistent')).toBeUndefined();
    expect(findPlannedArticle('traffic', 'honking-discipline', 'nonexistent')).toBeUndefined();
  });
});

describe('loadLessonForArticle()', () => {
  it('parses a published launch lesson: body, TL;DR, and quiz', () => {
    const a = findPlannedArticle('traffic', 'honking-discipline', 'the-case-against-honking');
    expect(a?.published).toBe(true);
    const lesson = loadLessonForArticle(a!);
    expect(lesson).not.toBeNull();
    expect(lesson!.id).toBe('traffic-001');
    expect(lesson!.body.length).toBeGreaterThan(0);
    expect(lesson!.tldr.length).toBeGreaterThan(0);
    // The case-against-honking lesson ships a quiz block.
    expect(Array.isArray(lesson!.quiz)).toBe(true);
    expect(lesson!.quiz!.length).toBeGreaterThan(0);
    // SEO fields (added 2026-06-20) parse with correct types even before the
    // meta_description backfill lands — meta_description is always a string,
    // og_title / og_description stay undefined until authored.
    expect(typeof lesson!.meta_description).toBe('string');
    expect(['undefined', 'string']).toContain(typeof lesson!.og_title);
    expect(['undefined', 'string']).toContain(typeof lesson!.og_description);
  });

  it('returns null for a coming-soon (unwritten) article', () => {
    const a = findPlannedArticle('water-pools', 'pool-hygiene', 'what-chlorine-does-and-doesnt-do');
    expect(a?.published).toBe(false);
    expect(loadLessonForArticle(a!)).toBeNull();
  });

  it('memoises repeat loads of the same article', () => {
    const a = findPlannedArticle('traffic', 'honking-discipline', 'the-case-against-honking');
    expect(loadLessonForArticle(a!)).toBe(loadLessonForArticle(a!));
  });

  it('parses a published abroad-pack lesson (exercises the 03-abroad path)', () => {
    const a = findPlannedArticle(
      'universal-core',
      'queues-and-waiting-globally',
      'queueing-in-international-contexts-the-global-default',
    );
    expect(a?.published).toBe(true);
    expect(a?.category.group).toBe('abroad');
    const lesson = loadLessonForArticle(a!);
    expect(lesson?.id).toBe('global-001');
    expect(lesson!.body.length).toBeGreaterThan(0);
  });
});

describe('loadVisitorsModule()', () => {
  it('returns a single module with 10 subtopics and a phase-4 status', () => {
    const v = loadVisitorsModule();
    expect(v.id).toBe('visitors');
    expect(v.phase).toBe(4);
    expect(v.subtopicCount).toBe(v.subtopics.length);
    expect(v.lessonCount).toBeGreaterThan(0);
  });
});

describe('resolveRelated()', () => {
  it('resolves known IDs to articleUrl-linked entries', () => {
    const links = resolveRelated(['traffic-001', 'traffic-005']);
    expect(links).toHaveLength(2);
    expect(links[0]?.url).toBe('/traffic/honking-discipline/the-case-against-honking/');
  });

  it('drops unknown IDs silently', () => {
    expect(resolveRelated(['nonexistent-999'])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(resolveRelated([])).toEqual([]);
  });
});

describe('URL helpers', () => {
  it('articleUrl uses category id + subtopic id + slug with trailing slash', () => {
    const c = getCategory('traffic')!;
    const s = c.subtopics[0]!;
    const a = s.articles[0]!;
    expect(articleUrl(a)).toBe(`/${c.id}/${s.id}/${a.slug}/`);
  });

  it('subtopicUrl and categoryUrl format consistently', () => {
    expect(subtopicUrl('traffic', 'honking-discipline')).toBe('/traffic/honking-discipline/');
    expect(categoryUrl('traffic')).toBe('/traffic/');
    expect(visitorsUrl()).toBe('/visitors/');
  });
});
