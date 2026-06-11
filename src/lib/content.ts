// Content loader (v2).
//
// Source-of-truth contract per WEBSITE-BUILD-SPEC-v2-ADDENDUM.md §1:
//   - taxonomy.json drives navigation. Every planned_lessons[] entry has
//     {id, slug, title, format} and is rendered — either as a real article
//     (file exists + status published, or in the launch allowlist) or as a
//     coming-soon placeholder.
//   - 11 India clusters AND 3 abroad packs share the article routing shape
//     /{category}/{subtopic}/{slug}. The visitors module is a separate flow.
//   - All counts come from taxonomy. We never recompute "published vs planned"
//     for navigation — only for the "is this single article live?" check.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import {
  CONTENT_REPO_PATH,
  DEFAULT_LOCALE,
  LAUNCH_LESSON_IDS,
  PUBLISH_MODE,
  type Locale,
} from '../config.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = path.resolve(HERE, '..', '..', CONTENT_REPO_PATH);
const TAXONOMY_PATH = path.join(CONTENT_ROOT, '01-taxonomy', 'taxonomy.json');
const CLUSTERS_ROOT = path.join(CONTENT_ROOT, '02-clusters');
const ABROAD_ROOT = path.join(CONTENT_ROOT, '03-abroad');

// ---------- Raw taxonomy shapes (v2) ----------

export interface RawPlannedLesson {
  id: string;
  slug: string;
  title: string;
  format: LessonFormat;
}

export interface RawSubtopic {
  id: string;
  title: Record<string, string>;
  default_format: LessonFormat;
  estimated_lessons: number;
  planned_lessons: RawPlannedLesson[];
  lesson_count?: number;
}

export interface RawCluster {
  id: string;
  title: Record<string, string>;
  icon: string;
  lesson_id_prefix: string;
  estimated_lessons: number;
  description: Record<string, string>;
  subtopics: RawSubtopic[];
  lesson_count?: number;
  subtopic_count?: number;
}

export interface RawVisitorsSubtopic {
  id: string;
  title: Record<string, string>;
  planned_lessons: RawPlannedLesson[];
  estimated_lessons: number;
}

export interface RawVisitorsModule {
  id: string;
  title: Record<string, string>;
  icon: string;
  phase: number;
  status: string;
  description: Record<string, string>;
  subtopics: RawVisitorsSubtopic[];
  lesson_count?: number;
  subtopic_count?: number;
}

export interface RawTaxonomy {
  version: string;
  platform: { name: string; default_locale: string };
  clusters: RawCluster[];
  abroad_packs: RawCluster[];
  visitors_module: RawVisitorsModule;
}

// ---------- Lesson shapes (parsed from .md frontmatter) ----------

export type LessonFormat = 'scenario' | 'comparison' | 'rule';

export interface QuizOption {
  id: string;
  text: string;
  feedback?: string;
  correct?: boolean;
}

export interface QuizQuestion {
  question: string;
  type?: 'single_choice' | 'multi_choice';
  options: QuizOption[];
  explanation?: string;
  sources?: Array<{ id: string }>;
}

export interface LessonSource {
  id?: string;
  type?: string;
  title?: string;
  publisher?: string;
  year?: number | string;
  jurisdiction?: string;
  url?: string;
  accessed?: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  cluster: string;
  subtopic: string;
  format: LessonFormat;
  length_min: number;
  last_updated: string;
  /**
   * Article version. Convention from 2026-06-07 onward: quoted string with "v" prefix,
   * e.g. `"v1.0"` on first publish, `"v1.1"` on minor edit, `"v2.0"` on major edit.
   * Pre-2026-06-07 articles (the original 28) initially carried the legacy unquoted form `"1.0"` (retrofitted to `"v1.0"` on 2026-06-11);
   * the renderer normalises both to display as `v1.0`.
   * Bump rules: `learncivicsense-workflow/05-editorial-checklists.md`.
   */
  version: string;
  locale: Locale;
  status: string;
  tldr: string[];
  sources: LessonSource[];
  related: string[];
  tags: string[];
  body: string;
  quiz: QuizQuestion[] | null;
  filename: string;
}

// ---------- Loading the taxonomy ----------

let cachedTaxonomy: RawTaxonomy | null = null;

export function loadTaxonomy(): RawTaxonomy {
  if (cachedTaxonomy) return cachedTaxonomy;
  const raw = readFileSync(TAXONOMY_PATH, 'utf8');
  cachedTaxonomy = JSON.parse(raw) as RawTaxonomy;
  return cachedTaxonomy;
}

// ---------- Navigable Category (cluster OR abroad pack) ----------
//
// Both India clusters and abroad packs share the same {category}/{subtopic}/{slug}
// routing. We unify them as `NavCategory` for the sidebar, category page, and
// article route. The visitors module is intentionally NOT a NavCategory.

export type NavCategoryGroup = 'india' | 'abroad';

export interface NavCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  lessonIdPrefix: string;
  /** Directory under content repo where .md files for this category live. */
  contentDir: string;
  /** Which homepage section / sidebar group this belongs to. */
  group: NavCategoryGroup;
  subtopics: NavSubtopic[];
  /** Total planned articles across all subtopics. */
  lessonCount: number;
  /** Total subtopics (taxonomy-derived). */
  subtopicCount: number;
}

export interface NavSubtopic {
  id: string;
  title: string;
  defaultFormat: LessonFormat;
  estimatedLessons: number;
  /** Planned articles, enriched with `published` (real .md) detection. */
  articles: PlannedArticle[];
}

export interface PlannedArticle {
  id: string;
  slug: string;
  title: string;
  format: LessonFormat;
  /** True if a backing .md file exists AND it counts as published. */
  published: boolean;
  /** Parent links — handy for ArticleListItem / search index meta. */
  category: NavCategory;
  subtopic: NavSubtopic;
}

// ---------- File-existence detection ----------
//
// Filenames in the content repo don't always match the taxonomy slug 1:1.
// E.g. taxonomy says `queue-001.slug = the-gate-rush-and-why-the-plane-...`
// but the file on disk is `queue-001-the-gate-rush.en.md`. So we can't build
// the path from the slug alone — we scan the lessons/ dir per category and
// map by lesson id (`{prefix}-{NNN}`), which is the stable key.

/** Cache: `category.id::locale` → ( `lesson_id` → full file path ). */
const lessonFileIndex = new Map<string, Map<string, string>>();

function getLessonFileIndex(cat: NavCategory, locale: Locale): Map<string, string> {
  const cacheKey = `${cat.id}::${locale}`;
  const cached = lessonFileIndex.get(cacheKey);
  if (cached) return cached;

  const index = new Map<string, string>();
  const dir = path.join(cat.contentDir, 'lessons');
  if (existsSync(dir)) {
    // Match `{prefix}-{digits}-anything.{locale}.md` — the id is `{prefix}-{NNN}`.
    const idRegex = new RegExp(
      `^(${escapeRegex(cat.lessonIdPrefix)}-\\d+)-.*\\.${escapeRegex(locale)}\\.md$`,
    );
    for (const file of readdirSync(dir)) {
      const m = file.match(idRegex);
      if (m?.[1]) index.set(m[1], path.join(dir, file));
    }
  }
  lessonFileIndex.set(cacheKey, index);
  return index;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pull a locale value from a {en: "...", hi: "...", ...} map with sensible fallback.
 * Returns the requested locale, then English, then the empty string. Keeps strict
 * `noUncheckedIndexedAccess` happy without sprinkling `as string` casts.
 */
function pickI18n(map: Record<string, string>, locale: Locale): string {
  return map[locale] ?? map.en ?? '';
}

/**
 * "Is this planned article actually live?" per addendum §2.1:
 *   - allowlist mode + id in LAUNCH_LESSON_IDS → yes (handles the 6 draft launch lessons)
 *   - a backing .md file (matched by id, not by exact slug) exists AND its
 *     frontmatter has status: published → yes
 *   - else no
 */
function isArticlePublished(cat: NavCategory, planned: RawPlannedLesson, locale: Locale): boolean {
  if (PUBLISH_MODE === 'allowlist' && LAUNCH_LESSON_IDS.has(planned.id)) return true;
  const fp = getLessonFileIndex(cat, locale).get(planned.id);
  if (!fp) return false;
  try {
    const raw = readFileSync(fp, 'utf8');
    const fm = matter(raw).data as Record<string, unknown>;
    return fm.status === 'published';
  } catch {
    return false;
  }
}

// ---------- Building the nav tree ----------

let cachedNav: NavCategory[] | null = null;

function buildNavCategory(
  raw: RawCluster,
  group: NavCategoryGroup,
  contentRoot: string,
  locale: Locale,
): NavCategory {
  const contentDir = path.join(contentRoot, raw.id);
  // Build the category shell first so subtopic→article construction can reference it.
  const cat: NavCategory = {
    id: raw.id,
    title: pickI18n(raw.title, locale),
    description: pickI18n(raw.description, locale),
    icon: raw.icon,
    lessonIdPrefix: raw.lesson_id_prefix,
    contentDir,
    group,
    subtopics: [],
    lessonCount: 0,
    subtopicCount: raw.subtopic_count ?? raw.subtopics.length,
  };

  let total = 0;
  for (const s of raw.subtopics) {
    const sub: NavSubtopic = {
      id: s.id,
      title: pickI18n(s.title, locale),
      defaultFormat: s.default_format,
      estimatedLessons: s.estimated_lessons,
      articles: [],
    };
    for (const p of s.planned_lessons) {
      sub.articles.push({
        id: p.id,
        slug: p.slug,
        title: p.title,
        format: p.format,
        published: isArticlePublished(cat, p, locale),
        category: cat,
        subtopic: sub,
      });
    }
    total += sub.articles.length;
    cat.subtopics.push(sub);
  }
  cat.lessonCount = raw.lesson_count ?? total;
  return cat;
}

/**
 * All navigable categories (11 India clusters + 3 abroad packs), in taxonomy order.
 * Excludes the visitors module by design.
 */
export function getNavCategories(locale: Locale = DEFAULT_LOCALE): NavCategory[] {
  if (cachedNav) return cachedNav;
  const tax = loadTaxonomy();
  const out: NavCategory[] = [];
  for (const c of tax.clusters) out.push(buildNavCategory(c, 'india', CLUSTERS_ROOT, locale));
  for (const p of tax.abroad_packs) out.push(buildNavCategory(p, 'abroad', ABROAD_ROOT, locale));
  cachedNav = out;
  return out;
}

export function getCategory(id: string, locale: Locale = DEFAULT_LOCALE): NavCategory | undefined {
  return getNavCategories(locale).find((c) => c.id === id);
}

export function getSubtopic(
  categoryId: string,
  subtopicId: string,
  locale: Locale = DEFAULT_LOCALE,
): { category: NavCategory; subtopic: NavSubtopic } | undefined {
  const cat = getCategory(categoryId, locale);
  if (!cat) return undefined;
  const sub = cat.subtopics.find((s) => s.id === subtopicId);
  if (!sub) return undefined;
  return { category: cat, subtopic: sub };
}

export function findPlannedArticle(
  categoryId: string,
  subtopicId: string,
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): PlannedArticle | undefined {
  return getSubtopic(categoryId, subtopicId, locale)?.subtopic.articles.find(
    (a) => a.slug === slug,
  );
}

// ---------- Visitors module (separate flow) ----------

export interface VisitorsView {
  id: string;
  title: string;
  description: string;
  icon: string;
  phase: number;
  subtopics: Array<{ id: string; title: string; estimatedLessons: number }>;
  lessonCount: number;
  subtopicCount: number;
}

export function loadVisitorsModule(locale: Locale = DEFAULT_LOCALE): VisitorsView {
  const vm = loadTaxonomy().visitors_module;
  return {
    id: vm.id,
    title: pickI18n(vm.title, locale),
    description: pickI18n(vm.description, locale),
    icon: vm.icon,
    phase: vm.phase,
    subtopics: vm.subtopics.map((s) => ({
      id: s.id,
      title: pickI18n(s.title, locale),
      estimatedLessons: s.estimated_lessons,
    })),
    lessonCount: vm.lesson_count ?? vm.subtopics.reduce((n, s) => n + s.estimated_lessons, 0),
    subtopicCount: vm.subtopic_count ?? vm.subtopics.length,
  };
}

// ---------- Lesson file loading (for real articles only) ----------

const lessonCache = new Map<string, Lesson | null>();

/**
 * Parse the .md file that backs a given planned article. Returns null when there's
 * no file or the file is unreadable. The caller is responsible for first checking
 * `planned.published` before deciding how to render.
 */
export function loadLessonForArticle(
  planned: PlannedArticle,
  locale: Locale = DEFAULT_LOCALE,
): Lesson | null {
  const cacheKey = `${planned.category.id}/${planned.id}/${locale}`;
  if (lessonCache.has(cacheKey)) return lessonCache.get(cacheKey) ?? null;

  const fp = getLessonFileIndex(planned.category, locale).get(planned.id);
  let parsed: Lesson | null = null;
  if (fp) {
    parsed = parseLessonFile(fp, path.basename(fp), locale);
    if (parsed && parsed.tldr.length === 0) {
      console.warn(`[content] Published lesson ${parsed.id} has no tldr (spec §17.1)`);
    }
  }
  lessonCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Coerce a raw `tldr` frontmatter value into a clean `string[]`.
 *
 * Guards against a common YAML authoring bug: an unquoted bullet that contains
 * a `colon-space` (e.g. `- Scan before any big move: laps in progress?`) parses
 * as a single-key MAP `{ "Scan before any big move": "laps in progress?" }`
 * instead of a string. Left unhandled, that object reaches marked.parseInline
 * and throws, which would crash the ENTIRE static build over one typo.
 *
 * We reconstruct `"key: value"` from such maps so the line still renders with
 * its intended text, stringify any other non-string, and log a warning so the
 * underlying content can be fixed at source (quote the offending line).
 */
/**
 * Normalises the frontmatter `version` field to the display form `v<major>.<minor>`.
 *
 * Two on-disk formats coexist in the content repo:
 *   - New (2026-06-07 onward): quoted string with "v" prefix, e.g. `version: "v1.0"`.
 *     YAML parses this as the string `"v1.0"`.
 *   - Legacy (originally the 28 pre-2026-06-07 articles, retrofitted on 2026-06-11): formerly unquoted number, e.g. `version: 1.0`. Helper retained for defensive parsing in case any draft drifts back to the unquoted form.
 *     YAML parses this as the number `1` (drops the trailing `.0`). The unquoted form
 *     also loses the distinction between `1.0` and `1.10` (both become `1.1`), which is
 *     one of the reasons we moved to quoted strings.
 *
 * This function accepts both and always returns the canonical `v<x>.<y>` display string.
 * Falls back to `v1.0` if absent or unparseable, so the header always renders something
 * sensible even on a malformed file.
 */
function normaliseVersion(raw: unknown): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 'v1.0';
    // Already "v1.0" or "V1.0" form
    if (/^v\d+(\.\d+)?$/i.test(trimmed)) {
      return 'v' + trimmed.slice(1);
    }
    // Bare "1.0" string form
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return 'v' + (trimmed.includes('.') ? trimmed : trimmed + '.0');
    }
    return trimmed;
  }
  if (typeof raw === 'number') {
    // Legacy unquoted YAML number like 1.0 → 1
    return Number.isInteger(raw) ? `v${raw}.0` : `v${raw}`;
  }
  return 'v1.0';
}

function normalizeTldr(raw: unknown, filename: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const entries = Object.entries(item as Record<string, unknown>);
      const recovered = entries.map(([k, v]) => `${k}: ${v}`).join(' ');
      console.warn(
        `[content] ${filename}: a tldr bullet parsed as an object (likely an unquoted ` +
          `colon in YAML). Recovered as "${recovered}". Quote that line in the source.`,
      );
      return recovered;
    }
    return String(item);
  });
}

function parseLessonFile(filePath: string, filename: string, locale: Locale): Lesson | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;

  const { markdownBody, quiz } = splitBodyAndQuiz(parsed.content);

  if (!fm.id || !fm.slug || !fm.title) {
    console.warn(`[content] Skipping ${filename}: missing id/slug/title`);
    return null;
  }

  return {
    id: String(fm.id),
    slug: String(fm.slug),
    title: String(fm.title),
    cluster: String(fm.cluster ?? ''),
    subtopic: String(fm.subtopic ?? ''),
    format: (fm.format as LessonFormat) ?? 'scenario',
    length_min: typeof fm.length_min === 'number' ? fm.length_min : 3,
    last_updated: String(fm.last_updated ?? ''),
    version: normaliseVersion(fm.version),
    locale,
    status: String(fm.status ?? 'draft'),
    tldr: normalizeTldr(fm.tldr, filename),
    sources: Array.isArray(fm.sources) ? (fm.sources as LessonSource[]) : [],
    related: Array.isArray(fm.related) ? (fm.related as string[]) : [],
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    body: markdownBody,
    quiz,
    filename,
  };
}

function splitBodyAndQuiz(content: string): {
  markdownBody: string;
  quiz: QuizQuestion[] | null;
} {
  const fenceRegex = /\n---\s*\n([\s\S]*?quiz:[\s\S]*)$/;
  const m = content.match(fenceRegex);
  if (!m) {
    return { markdownBody: content.trimEnd(), quiz: null };
  }
  const markdownBody = content.slice(0, m.index).trimEnd();
  const quizYaml = m[1] ?? '';
  try {
    const obj = yaml.load(quizYaml) as { quiz?: QuizQuestion[] };
    return { markdownBody, quiz: obj?.quiz ?? null };
  } catch (err) {
    console.warn('[content] Failed to parse quiz block:', err);
    return { markdownBody, quiz: null };
  }
}

// ---------- Related-link resolution ----------

export interface RelatedLink {
  id: string;
  title: string;
  url: string;
}

/**
 * Resolve a lesson's `related: [id, ...]` to linkable views by looking up each id
 * in the taxonomy (any category). Drops unknown IDs silently.
 */
export function resolveRelated(related: string[], locale: Locale = DEFAULT_LOCALE): RelatedLink[] {
  if (!related?.length) return [];
  const nav = getNavCategories(locale);
  const byId = new Map<string, PlannedArticle>();
  for (const cat of nav)
    for (const s of cat.subtopics) for (const a of s.articles) byId.set(a.id, a);

  const out: RelatedLink[] = [];
  for (const id of related) {
    const a = byId.get(id);
    if (!a) continue;
    out.push({ id: a.id, title: a.title, url: articleUrl(a) });
  }
  return out;
}

// ---------- URL helpers ----------

export function articleUrl(a: {
  category: NavCategory;
  subtopic: NavSubtopic;
  slug: string;
}): string {
  return `/${a.category.id}/${a.subtopic.id}/${a.slug}/`;
}

export function subtopicUrl(categoryId: string, subtopicId: string): string {
  return `/${categoryId}/${subtopicId}/`;
}

export function categoryUrl(categoryId: string): string {
  return `/${categoryId}/`;
}

export function visitorsUrl(): string {
  return `/visitors/`;
}
