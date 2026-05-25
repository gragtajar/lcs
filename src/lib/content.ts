// Content loader. Reads the sibling learncivicsense-content repo at build time.
// Exposes: taxonomy, lessons (filtered to launch), counts, lookups, related-resolver.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import {
  CONTENT_REPO_PATH,
  DEFAULT_LOCALE,
  HIDE_EMPTY_CATEGORIES,
  LAUNCH_LESSON_IDS,
  PUBLISH_MODE,
  SHOW_EMPTY_SUBCATEGORIES,
  type Locale,
} from '../config.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = path.resolve(HERE, '..', '..', CONTENT_REPO_PATH);
const TAXONOMY_PATH = path.join(CONTENT_ROOT, '01-taxonomy', 'taxonomy.json');
const CLUSTERS_ROOT = path.join(CONTENT_ROOT, '02-clusters');

// ---------- Taxonomy types ----------

export interface RawTaxonomy {
  platform: { name: string; default_locale: string };
  clusters: RawCluster[];
}

export interface RawCluster {
  id: string;
  title: Record<string, string>;
  icon: string;
  lesson_id_prefix: string;
  estimated_lessons: number;
  description: Record<string, string>;
  subtopics: RawSubtopic[];
}

export interface RawSubtopic {
  id: string;
  title: Record<string, string>;
  default_format: string;
  estimated_lessons: number;
  planned_lessons: string[];
}

// ---------- Lesson types ----------

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
  locale: Locale;
  status: string;
  tldr: string[];
  sources: LessonSource[];
  related: string[];
  tags: string[];
  body: string; // markdown body, without the quiz block
  quiz: QuizQuestion[] | null;
  filename: string;
}

// ---------- Loader ----------

let cachedTaxonomy: RawTaxonomy | null = null;

export function loadTaxonomy(): RawTaxonomy {
  if (cachedTaxonomy) return cachedTaxonomy;
  const raw = readFileSync(TAXONOMY_PATH, 'utf8');
  cachedTaxonomy = JSON.parse(raw) as RawTaxonomy;
  return cachedTaxonomy;
}

let cachedLessons: Lesson[] | null = null;

/**
 * Walk every cluster's lessons/ folder, parse frontmatter + markdown,
 * filter to publishable per PUBLISH_MODE, return the launch lesson set.
 */
export function loadAllLessons(): Lesson[] {
  if (cachedLessons) return cachedLessons;

  const lessons: Lesson[] = [];

  if (!existsSync(CLUSTERS_ROOT)) {
    console.warn(`[content] Clusters root not found: ${CLUSTERS_ROOT}`);
    return [];
  }

  for (const clusterDir of readdirSync(CLUSTERS_ROOT)) {
    const clusterPath = path.join(CLUSTERS_ROOT, clusterDir);
    if (!statSync(clusterPath).isDirectory()) continue;

    const lessonsDir = path.join(clusterPath, 'lessons');
    if (!existsSync(lessonsDir)) continue;

    for (const file of readdirSync(lessonsDir)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(lessonsDir, file);
      const lesson = parseLessonFile(filePath, file);
      if (!lesson) continue;
      if (!isPublishable(lesson)) continue;
      if (lesson.tldr.length === 0) {
        console.warn(`[content] Warning: ${lesson.id} (publishable) has no tldr field (spec §17.1)`);
      }
      lessons.push(lesson);
    }
  }

  cachedLessons = lessons;
  return lessons;
}

function isPublishable(lesson: Lesson): boolean {
  if (lesson.status === 'published') return true;
  if (PUBLISH_MODE === 'allowlist' && LAUNCH_LESSON_IDS.has(lesson.id)) return true;
  return false;
}

function parseLessonFile(filePath: string, filename: string): Lesson | null {
  // Filename: `{prefix}-{NNN}-{slug}.{locale}.md`
  const m = filename.match(/\.([a-z]{2,3})\.md$/);
  const locale = (m ? m[1] : DEFAULT_LOCALE) as Locale;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;

  // The lesson body may contain a second YAML block (the quiz) appended after a `---`.
  // gray-matter only parses the *first* frontmatter at the very top, so the quiz block
  // ends up as text in parsed.content. Split it out.
  const { markdownBody, quiz } = splitBodyAndQuiz(parsed.content);

  if (!fm.id || !fm.slug || !fm.title) {
    console.warn(`[content] Skipping ${filename}: missing id/slug/title`);
    return null;
  }

  const lesson: Lesson = {
    id: String(fm.id),
    slug: String(fm.slug),
    title: String(fm.title),
    cluster: String(fm.cluster ?? ''),
    subtopic: String(fm.subtopic ?? ''),
    format: (fm.format as LessonFormat) ?? 'scenario',
    length_min: typeof fm.length_min === 'number' ? fm.length_min : 3,
    last_updated: String(fm.last_updated ?? ''),
    locale,
    status: String(fm.status ?? 'draft'),
    tldr: Array.isArray(fm.tldr) ? (fm.tldr as string[]) : [],
    sources: Array.isArray(fm.sources) ? (fm.sources as LessonSource[]) : [],
    related: Array.isArray(fm.related) ? (fm.related as string[]) : [],
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    body: markdownBody,
    quiz,
    filename,
  };

  return lesson;
}

/**
 * Split a lesson's content into the prose body and the quiz YAML block.
 * The quiz block is recognized as a `---`-fenced YAML doc starting with `quiz:`.
 */
function splitBodyAndQuiz(content: string): {
  markdownBody: string;
  quiz: QuizQuestion[] | null;
} {
  // The pattern used in the launch lessons: prose, then `\n---\n`, then `quiz:\n  - ...`
  // Find the last `---` followed (perhaps after whitespace) by `quiz:`.
  const fenceRegex = /\n---\s*\n([\s\S]*?quiz:[\s\S]*)$/;
  const m = content.match(fenceRegex);
  if (!m) {
    return { markdownBody: content.trimEnd(), quiz: null };
  }

  const markdownBody = content.slice(0, m.index).trimEnd();
  const quizYaml = m[1];

  try {
    const obj = yaml.load(quizYaml) as { quiz?: QuizQuestion[] };
    return { markdownBody, quiz: obj?.quiz ?? null };
  } catch (err) {
    console.warn('[content] Failed to parse quiz block:', err);
    return { markdownBody, quiz: null };
  }
}

// ---------- Derived helpers ----------

export interface ClusterView {
  id: string;
  title: string;
  description: string;
  icon: string;
  subtopics: SubtopicView[];
  publishedCount: number; // total published lessons in this cluster
}

export interface SubtopicView {
  id: string;
  title: string;
  publishedCount: number;
  empty: boolean;
}

/** Build the cluster/subcategory tree for the launch locale, in taxonomy order. */
export function buildClusterTree(locale: Locale = DEFAULT_LOCALE): ClusterView[] {
  const taxonomy = loadTaxonomy();
  const lessons = loadAllLessons().filter((l) => l.locale === locale);

  const lessonsByCluster = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const arr = lessonsByCluster.get(l.cluster) ?? [];
    arr.push(l);
    lessonsByCluster.set(l.cluster, arr);
  }

  const views: ClusterView[] = [];
  for (const c of taxonomy.clusters) {
    const clusterLessons = lessonsByCluster.get(c.id) ?? [];
    const publishedCount = clusterLessons.length;
    if (HIDE_EMPTY_CATEGORIES && publishedCount === 0) continue;

    const subs: SubtopicView[] = [];
    for (const s of c.subtopics) {
      const subPublishedCount = clusterLessons.filter((l) => l.subtopic === s.id).length;
      const empty = subPublishedCount === 0;
      if (empty && !SHOW_EMPTY_SUBCATEGORIES) continue;
      subs.push({
        id: s.id,
        title: s.title[locale] ?? s.title.en,
        publishedCount: subPublishedCount,
        empty,
      });
    }

    views.push({
      id: c.id,
      title: c.title[locale] ?? c.title.en,
      description: c.description[locale] ?? c.description.en,
      icon: c.icon,
      subtopics: subs,
      publishedCount,
    });
  }

  return views;
}

export function getLessonsForSubtopic(
  clusterId: string,
  subtopicId: string,
  locale: Locale = DEFAULT_LOCALE,
): Lesson[] {
  return loadAllLessons()
    .filter(
      (l) => l.locale === locale && l.cluster === clusterId && l.subtopic === subtopicId,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findLessonBySlug(
  clusterId: string,
  subtopicId: string,
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Lesson | undefined {
  return loadAllLessons().find(
    (l) =>
      l.locale === locale &&
      l.cluster === clusterId &&
      l.subtopic === subtopicId &&
      l.slug === slug,
  );
}

export function findLessonById(id: string, locale: Locale = DEFAULT_LOCALE): Lesson | undefined {
  return loadAllLessons().find((l) => l.locale === locale && l.id === id);
}

/**
 * Resolve related lesson IDs into linkable views. Drops IDs that aren't published
 * (so we never render dead links from the published 6 to the unpublished rest).
 */
export interface RelatedLink {
  id: string;
  title: string;
  url: string;
}

export function resolveRelated(
  related: string[],
  locale: Locale = DEFAULT_LOCALE,
): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const id of related) {
    const l = findLessonById(id, locale);
    if (!l) continue;
    out.push({
      id: l.id,
      title: l.title,
      url: lessonUrl(l),
    });
  }
  return out;
}

export function lessonUrl(l: Lesson): string {
  return `/${l.cluster}/${l.subtopic}/${l.slug}/`;
}

export function subtopicUrl(clusterId: string, subtopicId: string): string {
  return `/${clusterId}/${subtopicId}/`;
}

export function categoryUrl(clusterId: string): string {
  return `/${clusterId}/`;
}
