// Homepage cluster/article auto-rotation (brief CLAUDE-CODE-BRIEF-HOMEPAGE-2026-06-20 §3).
//
// Pure, deterministic, stateless selection logic. Given a set of cluster stats and
// a build date, it picks which clusters to feature and which 3 articles per cluster.
// No fs, no manifest, no content access here — that lives in homepage-data.ts. Keeping
// this module pure makes every function trivially unit-testable.
//
// Determinism comes from a per-(id, year, ISO-week) hash jitter: the same inputs on
// the same calendar week produce the same selection for every visitor, and the mix
// rotates week to week without any stored history.

export interface ArticleStat {
  id: string;
  /** scenario | comparison | rule */
  format: string;
  /** 0..35 editorial quality score. */
  qualityScore: number;
  publishedAt: Date;
}

export interface ClusterStats {
  id: string;
  publishedCount: number;
  /** 0..35 average across the cluster's published articles. */
  avgQualityScore: number;
  latestPublishDate: Date;
  articles: ArticleStat[];
}

/** Minimum published articles for a cluster to qualify for a featured card. */
export const MIN_ARTICLES_PER_CLUSTER = 3;
/** Maximum featured cluster cards on the homepage. */
export const MAX_FEATURED_CLUSTERS = 5;
/** Articles shown per featured cluster card. */
export const ARTICLES_PER_CARD = 3;

/**
 * Stable, non-cryptographic hash (FNV-1a) normalised to [0, 1). Deterministic
 * across builds and platforms.
 */
export function normalisedHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0x100000000; // divide by 2^32 so the result is strictly < 1
}

/** ISO 8601 week number (1..53) for a date, computed in UTC. */
export function weekOfYear(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Shift to the Thursday of this ISO week (ISO weeks are Mon-Sun, numbered by Thursday).
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  // Find the first Thursday of the target's ISO year.
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
}

/** Whole days between two dates (a is expected earlier than b). */
export function daysBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / (24 * 3600 * 1000);
}

/** Recency band: 1.0 (<=7d), 0.7 (<=30d), 0.4 (<=90d), else 0.1. */
export function recencyScore(latestPublishDate: Date, buildDate: Date): number {
  const days = Math.max(0, daysBetween(latestPublishDate, buildDate));
  if (days <= 7) return 1.0;
  if (days <= 30) return 0.7;
  if (days <= 90) return 0.4;
  return 0.1;
}

const CLUSTER_JITTER_WEIGHT = 0.15;
const VOLUME_CAP = 6;

/** Composite cluster score in roughly [0, 1.05]: quality + recency + volume + jitter. */
export function scoreCluster(cluster: ClusterStats, buildDate: Date): number {
  const quality = cluster.avgQualityScore / 35; // 0..1
  const recency = recencyScore(cluster.latestPublishDate, buildDate); // 0..1
  const volume = Math.min(1, cluster.publishedCount / VOLUME_CAP); // 0..1
  const base = 0.4 * quality + 0.3 * recency + 0.2 * volume;
  const seed = `${cluster.id}|${buildDate.getUTCFullYear()}|${weekOfYear(buildDate)}`;
  const jitter = normalisedHash(seed);
  return base + jitter * CLUSTER_JITTER_WEIGHT;
}

/**
 * Pick the featured clusters: only those with >= MIN_ARTICLES_PER_CLUSTER published,
 * sorted by score (with a stable id tiebreak), top MAX_FEATURED_CLUSTERS. Gracefully
 * returns fewer when fewer qualify.
 */
export function pickFeaturedClusters(clusters: ClusterStats[], buildDate: Date): ClusterStats[] {
  return clusters
    .filter((c) => c.publishedCount >= MIN_ARTICLES_PER_CLUSTER)
    .map((c) => ({ c, score: scoreCluster(c, buildDate) }))
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .slice(0, MAX_FEATURED_CLUSTERS)
    .map((x) => x.c);
}

const ARTICLE_JITTER_WEIGHT = 0.2;

/**
 * Pick ARTICLES_PER_CARD articles from a cluster: quality + recency + jitter, then a
 * greedy pass that prefers distinct formats (1 scenario + 1 rule + 1 comparison when
 * available) while always returning the requested count if enough candidates exist.
 */
export function pickArticles(cluster: ClusterStats, buildDate: Date): ArticleStat[] {
  const scored = cluster.articles
    .map((article) => {
      const quality = article.qualityScore / 35;
      const recency = recencyScore(article.publishedAt, buildDate);
      const seed = `${article.id}|${buildDate.getUTCFullYear()}|${weekOfYear(buildDate)}`;
      const jitter = normalisedHash(seed);
      return { article, score: 0.5 * quality + 0.3 * recency + ARTICLE_JITTER_WEIGHT * jitter };
    })
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id));

  const picked: ArticleStat[] = [];
  const formatsUsed = new Set<string>();
  const want = Math.min(ARTICLES_PER_CARD, scored.length);

  // First pass: take the highest-scored article whose format hasn't been used yet.
  for (const { article } of scored) {
    if (picked.length >= want) break;
    if (!formatsUsed.has(article.format)) {
      picked.push(article);
      formatsUsed.add(article.format);
    }
  }
  // Second pass: backfill with the next highest-scored articles regardless of format.
  for (const { article } of scored) {
    if (picked.length >= want) break;
    if (!picked.includes(article)) picked.push(article);
  }
  return picked;
}
