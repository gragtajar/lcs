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
}

export interface RenderedMeta {
  fullTitle: string;
  canonicalUrl: string;
  description: string;
  ogType: 'website' | 'article';
  ogImage?: string;
  twitterCard: 'summary' | 'summary_large_image';
}

const SITE_ORIGIN = 'https://learncivicsense.in';
const SITE_NAME = 'learncivicsense.in';
const SITE_TAGLINE = 'Practical civic sense for India';

export function buildMeta(input: MetaInput): RenderedMeta {
  const type = input.type ?? 'website';
  return {
    fullTitle: input.title ? `${input.title} — ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`,
    canonicalUrl: new URL(input.path, SITE_ORIGIN).toString(),
    description: input.description,
    ogType: type,
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
  const description = lesson.tldr[0] ?? category.description;
  return {
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
