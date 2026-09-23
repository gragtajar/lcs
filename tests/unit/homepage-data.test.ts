import { describe, it, expect } from 'vitest';
import {
  getHomepageStats,
  resolveHeroChips,
  getFeaturedClusters,
  getTopicIndex,
} from '../../src/lib/homepage-data';

// Integration test: runs the homepage assembly against the real content repo (same
// pattern as content.test.ts). The PUBLISH-MANIFEST may or may not be present; these
// assertions hold either way, because the rotation degrades gracefully without it.

const BUILD = new Date('2026-06-22T00:00:00Z');

describe('getHomepageStats()', () => {
  it('counts published lessons and topics with content within sane bounds', () => {
    const { lessonCount, clusterCount } = getHomepageStats();
    expect(lessonCount).toBeGreaterThanOrEqual(3);
    expect(clusterCount).toBeGreaterThanOrEqual(3);
    expect(clusterCount).toBeLessThanOrEqual(14); // 11 India clusters + 3 abroad packs
  });

  it('counts the same lesson set the topic index sums to', () => {
    const { lessonCount } = getHomepageStats();
    const indexed = getTopicIndex()
      .flatMap((g) => g.items)
      .reduce((sum, item) => sum + item.published, 0);
    expect(indexed).toBe(lessonCount);
  });
});

describe('resolveHeroChips()', () => {
  it('resolves curated chips to canonical article URLs with their cluster and length', () => {
    const chips = resolveHeroChips();
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.length).toBeLessThanOrEqual(5);
    for (const chip of chips) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.href).toMatch(/^\/.+\/$/); // site-relative, trailing slash
      expect(chip.href.startsWith(`/${chip.category}/`)).toBe(true);
      expect(chip.minutes).toBeGreaterThan(0);
    }
  });
});

describe('getTopicIndex()', () => {
  it('lists every navigable topic in the India and abroad groups', () => {
    const groups = getTopicIndex();
    expect(groups.map((g) => g.key)).toEqual(['india', 'abroad']);
    const india = groups[0]!.items;
    const abroad = groups[1]!.items;
    expect(india).toHaveLength(11);
    expect(abroad).toHaveLength(3);
    for (const item of [...india, ...abroad]) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.url).toBe(`/${item.id}/`);
      expect(item.published).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('getFeaturedClusters()', () => {
  it('returns 3-5 clusters, each with up to 3 resolved articles', () => {
    const featured = getFeaturedClusters('en', BUILD);
    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(featured.length).toBeLessThanOrEqual(5);
    for (const f of featured) {
      expect(f.category.group).toBe('india');
      expect(f.articles.length).toBeGreaterThanOrEqual(1);
      expect(f.articles.length).toBeLessThanOrEqual(3);
      for (const a of f.articles) {
        expect(a.lesson.title.length).toBeGreaterThan(0);
        expect(a.url).toMatch(/^\/.+\/$/);
        expect(a.englishOnly).toBe(false); // en locale never falls back
      }
    }
  });

  it('is deterministic for a fixed build date', () => {
    const ids1 = getFeaturedClusters('en', BUILD).map((f) => f.category.id);
    const ids2 = getFeaturedClusters('en', BUILD).map((f) => f.category.id);
    expect(ids1).toEqual(ids2);
  });

  it('only features clusters with at least 3 published articles', () => {
    // Every featured cluster must have >= 3 published articles in the nav tree.
    for (const f of getFeaturedClusters('en', BUILD)) {
      const published = f.category.subtopics
        .flatMap((s) => s.articles)
        .filter((a) => a.published).length;
      expect(published).toBeGreaterThanOrEqual(3);
    }
  });
});
