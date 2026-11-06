// SEO helper: produce a consistent meta-tag set + JSON-LD per page type.
//
// Used by BaseLayout (every page) and the article template (which extends with
// Article-typed JSON-LD). Keeping it pure-functional makes it trivially testable
// and keeps SEO concerns out of the layout's render tree.

import type { Lesson, NavCategory } from './content';
import { stripMarkdownToText } from './markdown';

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
  ogImage: string;
  /** Set for the site's share image, whose size and content are known. */
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  twitterCard: 'summary_large_image';
}

const SITE_ORIGIN = 'https://learncivicsense.in';
const SITE_NAME = 'Learn Civic Sense';
const SITE_TAGLINE = 'Practical civic sense for India';

/**
 * Past about 60 characters a search result cuts the title short. The site's
 * name already shows above each result (search engines read it from the
 * homepage's WebSite JSON-LD), so a long title drops the suffix rather than
 * lose its last words.
 */
const TITLE_BUDGET = 60;

/** The site's two schema.org entities; every page's JSON-LD points at them. */
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** The lessons' licence, as /terms/ states it. */
export const CONTENT_LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';

/**
 * The share image of every page without its own (a lesson's illustration is
 * its own): the logo over the site's name, 1200x630. Built from the logo by
 * scripts/build-brand-assets.mjs into public/og-image.png.
 */
export const SITE_SHARE_IMAGE = `${SITE_ORIGIN}/og-image.png`;
const SITE_SHARE_IMAGE_ALT = `The ${SITE_NAME} logo, a hand-drawn figure in a frame, above the site's name`;

/** The logo as an image for structured data: public/logo.png, 512x512. */
export const SITE_LOGO = `${SITE_ORIGIN}/logo.png`;

export function buildMeta(input: MetaInput): RenderedMeta {
  const type = input.type ?? 'website';
  const suffixed = `${input.title} — ${SITE_NAME}`;
  const fullTitle = !input.title
    ? `${SITE_NAME} — ${SITE_TAGLINE}`
    : suffixed.length <= TITLE_BUDGET
      ? suffixed
      : input.title;
  return {
    fullTitle,
    canonicalUrl: new URL(input.path, SITE_ORIGIN).toString(),
    description: input.description,
    ogType: type,
    ogTitle: input.ogTitle || fullTitle,
    ogDescription: input.ogDescription || input.description,
    ogImage: input.image ?? SITE_SHARE_IMAGE,
    ...(input.image
      ? {}
      : { ogImageAlt: SITE_SHARE_IMAGE_ALT, ogImageWidth: 1200, ogImageHeight: 630 }),
    // Every page has an image now, so every card is the large one.
    twitterCard: 'summary_large_image',
  };
}

/** Longest description a search result shows before cutting it short. */
const DESCRIPTION_BUDGET = 160;

/**
 * A page's own blurb as a meta description: its opening sentences, as many as
 * fit in a search snippet, so the snippet ends on a full stop instead of being
 * cut mid-thought. A first sentence that is already too long is cut at a word.
 */
export function snippetDescription(text: string, max = DESCRIPTION_BUDGET): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let out = '';
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

// ---------- JSON-LD builders ----------

/** The publisher, as a node every page's JSON-LD can point at. */
const organizationRef = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_ORIGIN}/`,
};
const logo = { '@type': 'ImageObject', url: SITE_LOGO, width: 512, height: 512 };

export interface ArticleJsonLdInput {
  category: NavCategory;
  lesson: Lesson;
  /** The lesson's absolute, canonical URL. */
  url: string;
  /** The title the page shows as its h1, so the markup describes the page. */
  headline: string;
  /** Absolute URLs of the lesson's illustration; none for a lesson without one. */
  images?: string[];
}

/** Build a schema.org Article JSON-LD blob for a published lesson. */
export function articleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const { category, lesson, url, headline, images } = input;
  // Prefer the authored meta_description; fall back to tldr[0] for un-backfilled
  // articles, then the category description as a last resort.
  const description = lesson.meta_description || lesson.tldr[0] || category.description;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    url,
    headline,
    description,
    datePublished: lesson.last_updated || undefined,
    dateModified: lesson.last_updated || undefined,
    author: organizationRef,
    publisher: { ...organizationRef, logo },
    isPartOf: { '@id': WEBSITE_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: category.title,
    inLanguage: 'en-IN',
    wordCount: countWords(lesson.body),
    license: CONTENT_LICENSE,
  };
  if (images && images.length > 0) ld.image = images;
  if (lesson.length_min) ld.timeRequired = `PT${lesson.length_min}M`;
  // Tags become functional SEO metadata: schema.org `keywords` is a comma-separated
  // string by convention. Only emit when there are tags to avoid an empty property.
  if (lesson.tags.length > 0) ld.keywords = lesson.tags.join(', ');
  // The TL;DR the page shows above the body: the lesson's answer in brief.
  const abstract = lesson.tldr.map((item) => stripMarkdownToText(item)).join(' ');
  if (abstract) ld.abstract = abstract;
  // The sources the page lists, as the works the lesson cites.
  const citation = lesson.sources
    .filter((src) => src.url)
    .map((src) => ({
      '@type': 'CreativeWork',
      name: src.title || src.url,
      url: src.url,
      ...(src.publisher ? { publisher: { '@type': 'Organization', name: src.publisher } } : {}),
      ...(src.year ? { datePublished: String(src.year) } : {}),
    }));
  if (citation.length > 0) ld.citation = citation;
  return ld;
}

/**
 * The site as an organisation, with its logo: the homepage's JSON-LD, where
 * search engines look for a site's logo. Other pages point at it by @id.
 */
export function organizationJsonLd(description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    ...organizationRef,
    description,
    logo,
  };
}

/**
 * The site itself, by name: the homepage's JSON-LD, which search engines read
 * for the site name they show above each result.
 */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    inLanguage: 'en-IN',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export interface CollectionJsonLdInput {
  name: string;
  description: string;
  /** The page's absolute URL. */
  url: string;
  /** The readable lessons, in the order the page lists them. */
  items: Array<{ name: string; url: string }>;
}

/** Build a schema.org CollectionPage JSON-LD blob for a listing page (a topic's lessons). */
export function collectionJsonLd(input: CollectionJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': input.url,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: 'en-IN',
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: input.items.length,
      itemListElement: input.items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: new URL(it.url, SITE_ORIGIN).toString(),
      })),
    },
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
