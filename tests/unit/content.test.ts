import { describe, it, expect } from 'vitest';
import {
  loadTaxonomy,
  getNavCategories,
  getCategory,
  getSubtopic,
  findPlannedArticle,
  loadVisitorsModule,
  resolveRelated,
  articleUrl,
  subtopicUrl,
  categoryUrl,
  visitorsUrl,
} from '../../src/lib/content';

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
    const a = findPlannedArticle(
      'traffic',
      'honking-discipline',
      'honking-at-red-lights-and-what-it-costs-everyone',
    );
    expect(a?.published).toBe(false);
  });

  it('returns undefined for unknown slugs / categories', () => {
    expect(getCategory('nonexistent')).toBeUndefined();
    expect(getSubtopic('traffic', 'nonexistent')).toBeUndefined();
    expect(findPlannedArticle('traffic', 'honking-discipline', 'nonexistent')).toBeUndefined();
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
