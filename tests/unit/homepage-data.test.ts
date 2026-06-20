import { describe, it, expect } from 'vitest';
import {
  getHomepageStats,
  resolveHeroChips,
  getFeaturedClusters,
} from '../../src/lib/homepage-data';

// Integration test: runs the homepage assembly against the real content repo (same
// pattern as content.test.ts). The PUBLISH-MANIFEST may or may not be present; these
// assertions hold either way, because the rotation degrades gracefully without it.

const BUILD = new Date('2026-06-22T00:00:00Z');

describe('getHomepageStats()', () => {
  it('counts published lessons and India clusters within sane bounds', () => {
    const { lessonCount, clusterCount } = getHomepageStats();
    expect(lessonCount).toBeGreaterThanOrEqual(3);
    expect(clusterCount).toBeGreaterThanOrEqual(3);
    expect(clusterCount).toBeLessThanOrEqual(11); // there are 11 India clusters
  });
});

describe('resolveHeroChips()', () => {
  it('resolves curated chips to canonical article URLs', () => {
    const chips = resolveHeroChips();
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.length).toBeLessThanOrEqual(5);
    for (const chip of chips) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.href).toMatch(/^\/.+\/$/); // site-relative, trailing slash
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
