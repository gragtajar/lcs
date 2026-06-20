// Homepage data assembly (brief CLAUDE-CODE-BRIEF-HOMEPAGE-2026-06-20 §10).
//
// Bridges three sources into render-ready data for src/pages/index.astro:
//   - content.ts  — the site's source of truth for what renders + correct (taxonomy)
//                   URLs + cluster metadata + per-article display fields.
//   - PUBLISH-MANIFEST.json (workflow repo) — quality_score + published_at signals
//                   for the rotation. OPTIONAL: CI's build job clones only lcs-content,
//                   so we degrade gracefully to content-derived signals when absent.
//   - homepage-rotation.ts — the pure scoring/selection logic.
//
// Why content.ts and not the manifest's url_path for links: the site routes by taxonomy
// slug (ADR-006); the manifest's url_path can differ (spelling, /abroad/ prefix). Linking
// via content.ts guarantees the card hrefs match the actual pages. Featured cards are drawn
// from the 11 India clusters (the manifest tags abroad packs with mismatched ids, and the
// brief frames the cards as the "11 topics").

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getNavCategories,
  loadLessonForArticle,
  findArticleById,
  articleUrl,
  type NavCategory,
  type PlannedArticle,
  type Lesson,
} from './content';
import { WORKFLOW_REPO_PATH, DEFAULT_LOCALE, type Locale } from '../config.ts';
import {
  pickFeaturedClusters,
  pickArticles,
  type ClusterStats,
  type ArticleStat,
} from './homepage-rotation';
import heroChipsData from '../data/hero-chips.json' with { type: 'json' };
import { createLogger } from './logger';

const log = createLogger('homepage-data');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(HERE, '..', '..', WORKFLOW_REPO_PATH, 'PUBLISH-MANIFEST.json');

/** Baseline quality score used when the manifest (and thus quality_score) is unavailable. */
const DEFAULT_QUALITY_SCORE = 33;

interface ManifestEntry {
  id?: string;
  format?: string;
  quality_score?: number;
  published_at?: string;
}

/**
 * Read PUBLISH-MANIFEST.json and index its published entries by id. Returns an empty
 * map (not an error) when the manifest is absent — the rotation still works off
 * content-derived recency, volume, and jitter.
 */
function loadManifestIndex(): Map<string, ManifestEntry> {
  const index = new Map<string, ManifestEntry>();
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as {
      previously_built_in?: ManifestEntry[];
      newly_published_since_last_build?: ManifestEntry[];
    };
    const entries = [
      ...(manifest.previously_built_in ?? []),
      ...(manifest.newly_published_since_last_build ?? []),
    ];
    for (const e of entries) if (e?.id) index.set(e.id, e);
  } catch {
    log.warn('PUBLISH-MANIFEST.json not found; using content-derived rotation signals', {
      path: MANIFEST_PATH,
    });
  }
  return index;
}

/**
 * Assemble per-cluster stats for the 11 India clusters from content.ts (published set)
 * enriched with manifest quality_score/published_at where available. Also returns an
 * id -> PlannedArticle map so the selected ids can be resolved back to URLs + lessons.
 */
function buildClusterStats(locale: Locale): {
  stats: ClusterStats[];
  byId: Map<string, PlannedArticle>;
} {
  const manifest = loadManifestIndex();
  const byId = new Map<string, PlannedArticle>();
  const stats: ClusterStats[] = [];

  for (const cat of getNavCategories(locale)) {
    if (cat.group !== 'india') continue;
    const articles: ArticleStat[] = [];
    for (const sub of cat.subtopics) {
      for (const a of sub.articles) {
        if (!a.published) continue;
        byId.set(a.id, a);
        const entry = manifest.get(a.id);
        let publishedAt = entry?.published_at ? new Date(entry.published_at) : undefined;
        if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
          // Fall back to the article's last_updated when the manifest lacks a date.
          const lesson = loadLessonForArticle(a, locale) ?? loadLessonForArticle(a, DEFAULT_LOCALE);
          const lu = lesson?.last_updated ? new Date(lesson.last_updated) : undefined;
          publishedAt = lu && !Number.isNaN(lu.getTime()) ? lu : new Date(0);
        }
        articles.push({
          id: a.id,
          format: entry?.format ?? a.format,
          qualityScore:
            typeof entry?.quality_score === 'number' ? entry.quality_score : DEFAULT_QUALITY_SCORE,
          publishedAt,
        });
      }
    }
    if (articles.length === 0) continue;
    const avgQualityScore = articles.reduce((sum, x) => sum + x.qualityScore, 0) / articles.length;
    const latestPublishDate = new Date(Math.max(...articles.map((x) => x.publishedAt.getTime())));
    stats.push({
      id: cat.id,
      publishedCount: articles.length,
      avgQualityScore,
      latestPublishDate,
      articles,
    });
  }
  return { stats, byId };
}

export interface FeaturedArticle {
  lesson: Lesson;
  url: string;
  /** True when a non-English locale falls back to the English lesson file. */
  englishOnly: boolean;
}

export interface FeaturedCluster {
  category: NavCategory;
  articles: FeaturedArticle[];
}

/** Resolve a planned article to its localised lesson, falling back to English. */
function localisedLesson(
  planned: PlannedArticle,
  locale: Locale,
): { lesson: Lesson | null; englishOnly: boolean } {
  if (locale !== DEFAULT_LOCALE) {
    const localised = loadLessonForArticle(planned, locale);
    if (localised) return { lesson: localised, englishOnly: false };
    return { lesson: loadLessonForArticle(planned, DEFAULT_LOCALE), englishOnly: true };
  }
  return { lesson: loadLessonForArticle(planned, DEFAULT_LOCALE), englishOnly: false };
}

/**
 * The featured cluster cards: top clusters by the rotation score, each with 3 articles
 * resolved to localised lessons + canonical URLs. Deterministic per (build week, content).
 */
export function getFeaturedClusters(locale: Locale, buildDate: Date): FeaturedCluster[] {
  const { stats, byId } = buildClusterStats(locale);
  const navById = new Map(getNavCategories(locale).map((c) => [c.id, c]));
  const out: FeaturedCluster[] = [];

  for (const clusterStat of pickFeaturedClusters(stats, buildDate)) {
    const category = navById.get(clusterStat.id);
    if (!category) continue;
    const articles: FeaturedArticle[] = [];
    for (const stat of pickArticles(clusterStat, buildDate)) {
      const planned = byId.get(stat.id);
      if (!planned) continue;
      const { lesson, englishOnly } = localisedLesson(planned, locale);
      if (!lesson) {
        log.error('Featured article has no readable lesson file; skipping', { id: stat.id });
        continue;
      }
      articles.push({ lesson, url: articleUrl(planned), englishOnly });
    }
    if (articles.length > 0) out.push({ category, articles });
  }
  return out;
}

export interface HeroChip {
  href: string;
  label: string;
}

/**
 * Resolve the curated hero chips to hrefs. Drops (with a warning) any chip whose article
 * is not published, so the hero gracefully shows fewer chips rather than dead links.
 */
export function resolveHeroChips(locale: Locale = DEFAULT_LOCALE): HeroChip[] {
  const out: HeroChip[] = [];
  for (const chip of heroChipsData.chips) {
    const planned = findArticleById(chip.article_id, locale);
    if (!planned || !planned.published) {
      log.warn('hero chip dropped (article not published)', { id: chip.article_id });
      continue;
    }
    out.push({ href: articleUrl(planned), label: chip.label });
  }
  return out;
}

/** Total published lessons + the number of India clusters with content, for the scroll cue. */
export function getHomepageStats(locale: Locale = DEFAULT_LOCALE): {
  lessonCount: number;
  clusterCount: number;
} {
  let lessonCount = 0;
  const indiaClusters = new Set<string>();
  for (const cat of getNavCategories(locale)) {
    for (const sub of cat.subtopics) {
      for (const a of sub.articles) {
        if (!a.published) continue;
        lessonCount++;
        if (cat.group === 'india') indiaClusters.add(cat.id);
      }
    }
  }
  return { lessonCount, clusterCount: indiaClusters.size };
}
