// SEO helper: produce a consistent meta-tag set + JSON-LD per page type.
//
// Used by BaseLayout (every page) and the article template (which extends with
// Article-typed JSON-LD). Keeping it pure-functional makes it trivially testable
// and keeps SEO concerns out of the layout's render tree.

import type { Lesson, NavCategory, NavSubtopic } from './content';

export interface MetaInput {
  /** Page title shown in browser tab + OG; bare, without site name suffix. */
  title: string;
  /** Description for <meta description>, OG:description, Twitter:description. */
  description: string;
  /** Site-relative path. Used to build the canonical absolute URL. */
  path: string;
  /** Page type — drives og:type and the schema.org bucket. */
  type?: 'website' | 'article';
  /** Optional absolute image URL for OG / Twitter card. */
  image?: string;
  /**
   * Optional OG/Twitter title override. Defaults to the suffixed `fullTitle`.
   * Articles pass the bare lesson title (or its `og_title`) here so social cards
   * read cleanly without the "— site name" tail.
   */
  ogTitle?: string;
  /** Optional OG/Twitter description override. Defaults to `description`. */
  ogDescription?: string;
}

export interface RenderedMeta {
  fullTitle: string;
  canonicalUrl: string;
  description: string;
  ogType: 'website' | 'article';
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  twitterCard: 'summary' | 'summary_large_image';
}

const SITE_ORIGIN = 'https://learncivicsense.in';
const SITE_NAME = 'learncivicsense.in';
const SITE_TAGLINE = 'Practical civic sense for India';

export function buildMeta(input: MetaInput): RenderedMeta {
  const type = input.type ?? 'website';
  const fullTitle = input.title
    ? `${input.title} — ${SITE_NAME}`
    : `${SITE_NAME} — ${SITE_TAGLINE}`;
  return {
    fullTitle,
    canonicalUrl: new URL(input.path, SITE_ORIGIN).toString(),
    description: input.description,
    ogType: type,
    ogTitle: input.ogTitle || fullTitle,
    ogDescription: input.ogDescription || input.description,
    ogImage: input.image,
    twitterCard: input.image ? 'summary_large_image' : 'summary',
  };
}

// ---------- JSON-LD builders ----------

export interface ArticleJsonLdInput {
  category: NavCategory;
  subtopic: NavSubtopic;
  lesson: Lesson;
  url: string;
}

/** Build a schema.org Article JSON-LD blob for a published lesson. */
export function articleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const { category, lesson, url } = input;
  // Prefer the authored meta_description; fall back to tldr[0] for un-backfilled
  // articles, then the category description as a last resort.
  const description = lesson.meta_description || lesson.tldr[0] || category.description;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: lesson.title,
    description,
    datePublished: lesson.last_updated || undefined,
    dateModified: lesson.last_updated || undefined,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    articleSection: category.title,
    inLanguage: 'en-IN',
    wordCount: countWords(lesson.body),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  // Tags become functional SEO metadata: schema.org `keywords` is a comma-separated
  // string by convention. Only emit when there are tags to avoid an empty property.
  if (lesson.tags.length > 0) ld.keywords = lesson.tags.join(', ');
  // A truncated, markdown-stripped body excerpt gives crawlers richer indexing
  // signal without duplicating the full article in the head.
  const body = summariseBody(lesson.body);
  if (body) ld.articleBody = body;
  return ld;
}

export interface CollectionJsonLdInput {
  name: string;
  description: string;
  url: string;
  items: Array<{ name: string; url: string }>;
}

/** Build a schema.org CollectionPage JSON-LD blob for category + subcategory pages. */
export function collectionJsonLd(input: CollectionJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: 'en-IN',
    hasPart: input.items.map((it) => ({
      '@type': 'WebPage',
      name: it.name,
      url: it.url,
    })),
  };
}

export interface BreadcrumbJsonLdItem {
  name: string;
  url: string;
}

/** Build a schema.org BreadcrumbList for use anywhere with breadcrumb UI. */
export function breadcrumbJsonLd(items: BreadcrumbJsonLdItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.url, SITE_ORIGIN).toString(),
    })),
  };
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/u).length;
}

/** Max characters of body excerpt to embed in Article JSON-LD `articleBody`. */
const ARTICLE_BODY_SUMMARY_CHARS = 600;

/**
 * Produce a plain-text, truncated excerpt of a markdown lesson body for the
 * Article JSON-LD `articleBody`. Strips headings, emphasis, links, list markers,
 * blockquotes, and tables down to readable prose, collapses whitespace, and caps
 * the length (cutting on a word boundary with an ellipsis when truncated).
 */
function summariseBody(md: string): string {
  if (!md) return '';
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered-list markers
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // table rows
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/[*_`~]/g, '') // emphasis / code marks
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= ARTICLE_BODY_SUMMARY_CHARS) return plain;
  const slice = plain.slice(0, ARTICLE_BODY_SUMMARY_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
