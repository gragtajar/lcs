import { describe, it, expect } from 'vitest';
import {
  normalisedHash,
  weekOfYear,
  daysBetween,
  recencyScore,
  scoreCluster,
  pickArticles,
  pickFeaturedClusters,
  type ClusterStats,
  type ArticleStat,
} from '../../src/lib/homepage-rotation';

const D = (s: string) => new Date(s + 'T00:00:00Z');

function article(id: string, format: string, q: number, publishedAt: string): ArticleStat {
  return { id, format, qualityScore: q, publishedAt: D(publishedAt) };
}

function cluster(id: string, articles: ArticleStat[]): ClusterStats {
  const avg = articles.reduce((s, a) => s + a.qualityScore, 0) / Math.max(1, articles.length);
  const latest = new Date(Math.max(...articles.map((a) => a.publishedAt.getTime())));
  return {
    id,
    publishedCount: articles.length,
    avgQualityScore: avg,
    latestPublishDate: latest,
    articles,
  };
}

describe('normalisedHash()', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (const s of ['traffic|2026|26', 'sacred-014|2026|1', '', 'x']) {
      const a = normalisedHash(s);
      expect(a).toBe(normalisedHash(s));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('differs for different inputs', () => {
    expect(normalisedHash('traffic|2026|26')).not.toBe(normalisedHash('traffic|2026|27'));
  });
});

describe('weekOfYear()', () => {
  it('matches ISO 8601 week numbers for known dates', () => {
    expect(weekOfYear(D('2026-01-01'))).toBe(1);
    expect(weekOfYear(D('2026-06-22'))).toBe(26);
    expect(weekOfYear(D('2026-12-31'))).toBe(53);
    expect(weekOfYear(D('2024-12-30'))).toBe(1); // belongs to ISO 2025-W01
    expect(weekOfYear(D('2021-01-01'))).toBe(53); // belongs to ISO 2020-W53
  });
});

describe('daysBetween() / recencyScore()', () => {
  it('returns expected recency bands', () => {
    const build = D('2026-06-22');
    expect(recencyScore(D('2026-06-20'), build)).toBe(1.0); // 2 days
    expect(recencyScore(D('2026-06-01'), build)).toBe(0.7); // 21 days
    expect(recencyScore(D('2026-05-01'), build)).toBe(0.4); // 52 days
    expect(recencyScore(D('2026-01-01'), build)).toBe(0.1); // ~172 days
    // Future publish date clamps to 0 days -> top band.
    expect(recencyScore(D('2026-07-01'), build)).toBe(1.0);
  });

  it('daysBetween is signed earlier->later', () => {
    expect(daysBetween(D('2026-06-20'), D('2026-06-22'))).toBe(2);
  });
});

describe('scoreCluster()', () => {
  const build = D('2026-06-22');
  it('ranks higher quality + recency + volume above a weak cluster', () => {
    const strong = cluster('strong', [
      article('s1', 'scenario', 35, '2026-06-20'),
      article('s2', 'rule', 35, '2026-06-19'),
      article('s3', 'comparison', 35, '2026-06-18'),
      article('s4', 'scenario', 35, '2026-06-17'),
      article('s5', 'rule', 35, '2026-06-16'),
      article('s6', 'scenario', 35, '2026-06-15'),
    ]);
    const weak = cluster('weak', [
      article('w1', 'scenario', 30, '2026-01-01'),
      article('w2', 'rule', 30, '2026-01-02'),
      article('w3', 'comparison', 30, '2026-01-03'),
    ]);
    expect(scoreCluster(strong, build)).toBeGreaterThan(scoreCluster(weak, build));
  });

  it('is deterministic for the same cluster + build date', () => {
    const c = cluster('traffic', [
      article('t1', 'scenario', 33, '2026-06-10'),
      article('t2', 'rule', 34, '2026-06-11'),
      article('t3', 'comparison', 35, '2026-06-12'),
    ]);
    expect(scoreCluster(c, build)).toBe(scoreCluster(c, build));
  });
});

describe('pickArticles()', () => {
  const build = D('2026-06-22');
  it('returns 3 articles preferring format diversity when available', () => {
    const c = cluster('traffic', [
      article('a1', 'scenario', 35, '2026-06-20'),
      article('a2', 'scenario', 34, '2026-06-19'),
      article('a3', 'rule', 33, '2026-06-18'),
      article('a4', 'comparison', 33, '2026-06-17'),
      article('a5', 'scenario', 32, '2026-06-16'),
    ]);
    const picked = pickArticles(c, build);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((p) => p.format)).size).toBe(3); // one of each format
  });

  it('still returns 3 when only one format exists', () => {
    const c = cluster('mono', [
      article('m1', 'scenario', 35, '2026-06-20'),
      article('m2', 'scenario', 34, '2026-06-19'),
      article('m3', 'scenario', 33, '2026-06-18'),
      article('m4', 'scenario', 32, '2026-06-17'),
    ]);
    expect(pickArticles(c, build)).toHaveLength(3);
  });

  it('is deterministic for a fixed build date', () => {
    const c = cluster('traffic', [
      article('a1', 'scenario', 35, '2026-06-20'),
      article('a2', 'rule', 34, '2026-06-19'),
      article('a3', 'comparison', 33, '2026-06-18'),
      article('a4', 'scenario', 32, '2026-06-17'),
    ]);
    expect(pickArticles(c, build).map((a) => a.id)).toEqual(
      pickArticles(c, build).map((a) => a.id),
    );
  });
});

describe('pickFeaturedClusters()', () => {
  const build = D('2026-06-22');
  const mk = (id: string, n: number, q = 33) =>
    cluster(
      id,
      Array.from({ length: n }, (_, i) =>
        article(`${id}-${i}`, ['scenario', 'rule', 'comparison'][i % 3]!, q, '2026-06-10'),
      ),
    );

  it('filters out clusters with fewer than 3 articles', () => {
    const picked = pickFeaturedClusters([mk('a', 3), mk('b', 2), mk('c', 1)], build);
    expect(picked.map((c) => c.id).sort()).toEqual(['a']);
  });

  it('caps at 5 featured clusters', () => {
    const clusters = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((id) => mk(id, 4));
    expect(pickFeaturedClusters(clusters, build)).toHaveLength(5);
  });

  it('is deterministic for a fixed build date', () => {
    const clusters = ['traffic', 'sacred', 'hygiene', 'spaces', 'queues', 'air', 'transit'].map(
      (id) => mk(id, 4),
    );
    const a = pickFeaturedClusters(clusters, build).map((c) => c.id);
    const b = pickFeaturedClusters(clusters, build).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('every qualifying cluster appears at least once across 12 weekly builds', () => {
    const ids = ['traffic', 'sacred', 'hygiene', 'spaces', 'queues', 'air', 'transit'];
    const clusters = ids.map((id) => mk(id, 4));
    const seen = new Set<string>();
    let day = D('2026-06-22');
    for (let w = 0; w < 12; w++) {
      for (const c of pickFeaturedClusters(clusters, day)) seen.add(c.id);
      day = new Date(day.getTime() + 7 * 24 * 3600 * 1000);
    }
    expect([...seen].sort()).toEqual([...ids].sort());
  });
});
