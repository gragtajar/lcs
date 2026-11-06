import { describe, it, expect } from 'vitest';
import {
  buildMeta,
  articleJsonLd,
  collectionJsonLd,
  snippetDescription,
  breadcrumbJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '../../src/lib/seo';
import type { Lesson, NavCategory } from '../../src/lib/content';

describe('buildMeta()', () => {
  it('suffixes the title with the site name when title provided', () => {
    const m = buildMeta({ title: 'Honking', description: 'd', path: '/x' });
    expect(m.fullTitle).toBe('Honking — Learn Civic Sense');
  });

  it('falls back to site name + tagline when title is empty', () => {
    const m = buildMeta({ title: '', description: 'd', path: '/' });
    expect(m.fullTitle).toBe('Learn Civic Sense — Practical civic sense for India');
  });

  it('builds an absolute canonical URL', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/traffic/' }).canonicalUrl).toBe(
      'https://learncivicsense.in/traffic/',
    );
  });

  it("uses a page's own image as is, in the large twitter card", () => {
    const m = buildMeta({ title: 't', description: 'd', path: '/', image: 'x.jpg' });
    expect(m.ogImage).toBe('x.jpg');
    expect(m.twitterCard).toBe('summary_large_image');
    // Its size and content are not known here, so neither is claimed.
    expect(m.ogImageAlt).toBeUndefined();
    expect(m.ogImageWidth).toBeUndefined();
  });

  it("gives a page without its own image the site's share image (the logo card)", () => {
    const m = buildMeta({ title: 't', description: 'd', path: '/' });
    expect(m.ogImage).toBe('https://learncivicsense.in/og-image.png');
    expect(m.ogImageWidth).toBe(1200);
    expect(m.ogImageHeight).toBe(630);
    expect(m.ogImageAlt).toMatch(/Learn Civic Sense logo/);
    expect(m.twitterCard).toBe('summary_large_image');
  });

  it('defaults og:type to website but accepts article', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/' }).ogType).toBe('website');
    expect(buildMeta({ title: 't', description: 'd', path: '/x', type: 'article' }).ogType).toBe(
      'article',
    );
  });

  it('defaults ogTitle to the suffixed full title and ogDescription to description', () => {
    const m = buildMeta({ title: 'Honking', description: 'd', path: '/x' });
    expect(m.ogTitle).toBe('Honking — Learn Civic Sense');
    expect(m.ogDescription).toBe('d');
  });

  it('honours ogTitle / ogDescription overrides (bare title for social cards)', () => {
    const m = buildMeta({
      title: 'Honking',
      description: 'meta desc',
      path: '/x',
      ogTitle: 'Honking',
      ogDescription: 'social desc',
    });
    expect(m.ogTitle).toBe('Honking');
    expect(m.ogDescription).toBe('social desc');
    // The browser-tab title is unaffected by the OG overrides.
    expect(m.fullTitle).toBe('Honking — Learn Civic Sense');
  });

  it('drops the site-name suffix when it would push the title past 60 characters', () => {
    const fits = 'x'.repeat(40); // 40 + " — Learn Civic Sense" (20) = 60
    expect(buildMeta({ title: fits, description: 'd', path: '/' }).fullTitle).toBe(
      `${fits} — Learn Civic Sense`,
    );
    const long = 'x'.repeat(41);
    expect(buildMeta({ title: long, description: 'd', path: '/' }).fullTitle).toBe(long);
  });
});

describe('snippetDescription()', () => {
  it('keeps a description that fits as it is', () => {
    expect(snippetDescription('Short. Sweet.')).toBe('Short. Sweet.');
  });

  it('keeps as many whole opening sentences as fit in 160 characters', () => {
    const a = 'A'.repeat(70) + '.';
    const b = 'B'.repeat(70) + '.';
    const c = 'C'.repeat(70) + '.';
    expect(snippetDescription(`${a} ${b} ${c}`)).toBe(`${a} ${b}`);
  });

  it('cuts a first sentence that is already too long at a word, with an ellipsis', () => {
    const out = snippetDescription(`${'word '.repeat(50)}end.`);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out).toMatch(/word…$/);
  });
});

const mockCategory = {
  id: 'traffic',
  title: 'Traffic and roads',
  description: 'd',
  icon: 'traffic-cone',
  lessonIdPrefix: 'traffic',
  contentDir: '',
  group: 'india',
  articles: [],
  lessonCount: 24,
} satisfies NavCategory;

const mockLesson = {
  id: 'traffic-001',
  slug: 'the-case-against-honking',
  title: 'The case against honking',
  cluster: 'traffic',
  subtopic: 'honking-discipline',
  format: 'scenario',
  length_min: 3,
  last_updated: '2026-05-11',
  version: 'v1.0',
  locale: 'en',
  status: 'draft',
  tldr: ['First takeaway'],
  meta_description: '',
  sources: [],
  related: [],
  tags: [],
  body: 'one two three four five',
  quiz: null,
  filename: 'x.md',
} satisfies Lesson;

describe('articleJsonLd()', () => {
  it('emits a schema.org Article with the lesson title, date, section, and word count', () => {
    const ld = articleJsonLd({
      category: mockCategory,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/traffic/the-case-against-honking/',
      headline: 'The case against honking, as the page shows it',
    });
    expect(ld['@type']).toBe('Article');
    // The headline is the page's h1, which can differ from the lesson file's title.
    expect(ld.headline).toBe('The case against honking, as the page shows it');
    expect(ld['@id']).toBe('https://learncivicsense.in/traffic/the-case-against-honking/#article');
    expect(ld.url).toBe('https://learncivicsense.in/traffic/the-case-against-honking/');
    expect(ld.timeRequired).toBe('PT3M');
    expect(ld.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(ld.isPartOf).toEqual({ '@id': 'https://learncivicsense.in/#website' });
    expect(ld.author).toMatchObject({ '@id': 'https://learncivicsense.in/#organization' });
    expect(ld.datePublished).toBe('2026-05-11');
    expect(ld.articleSection).toBe('Traffic and roads');
    expect(ld.wordCount).toBe(5);
    expect(ld.inLanguage).toBe('en-IN');
    expect(ld.publisher).toMatchObject({
      '@type': 'Organization',
      name: 'Learn Civic Sense',
      logo: { '@type': 'ImageObject', url: 'https://learncivicsense.in/logo.png' },
    });
  });

  it('falls back to category description when TLDR is empty', () => {
    const ld = articleJsonLd({
      category: { ...mockCategory, description: 'fallback' },
      lesson: { ...mockLesson, tldr: [] },
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(ld.description).toBe('fallback');
  });

  it('prefers meta_description over tldr[0] for the description', () => {
    const ld = articleJsonLd({
      category: mockCategory,
      lesson: { ...mockLesson, meta_description: 'A keyword-rich snippet.' },
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(ld.description).toBe('A keyword-rich snippet.');
  });

  it('emits comma-joined keywords from tags, and omits the property when there are none', () => {
    const withTags = articleJsonLd({
      category: mockCategory,
      lesson: { ...mockLesson, tags: ['honking', 'urban', 'traffic'] },
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(withTags.keywords).toBe('honking, urban, traffic');

    const noTags = articleJsonLd({
      category: mockCategory,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(noTags).not.toHaveProperty('keywords');
  });

  it('gives the TL;DR as the abstract, plain text, and no truncated articleBody', () => {
    const ld = articleJsonLd({
      category: mockCategory,
      lesson: { ...mockLesson, tldr: ['Use the **horn** twice.', 'Never at a red.'] },
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(ld.abstract).toBe('Use the horn twice. Never at a red.');
    expect(ld).not.toHaveProperty('articleBody');
  });

  it('lists the illustration as the image only when the lesson has one', () => {
    const images = ['https://ik.imagekit.io/civic/tr:w-1200,h-630,f-jpg,q-80/traffic-001.png'];
    const withImage = articleJsonLd({
      category: mockCategory,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/x',
      headline: 'h',
      images,
    });
    expect(withImage.image).toEqual(images);
    const without = articleJsonLd({
      category: mockCategory,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(without).not.toHaveProperty('image');
  });

  it('cites the sources the page lists, skipping any without an address', () => {
    const ld = articleJsonLd({
      category: mockCategory,
      lesson: {
        ...mockLesson,
        sources: [
          {
            title: 'Motor Vehicles Act',
            url: 'https://indiacode.nic.in/x',
            publisher: 'MoRTH',
            year: 1988,
          },
          { title: 'No link' },
        ],
      },
      url: 'https://learncivicsense.in/x',
      headline: 'h',
    });
    expect(ld.citation).toEqual([
      {
        '@type': 'CreativeWork',
        name: 'Motor Vehicles Act',
        url: 'https://indiacode.nic.in/x',
        publisher: { '@type': 'Organization', name: 'MoRTH' },
        datePublished: '1988',
      },
    ]);
  });
});

describe('collectionJsonLd()', () => {
  it('builds a CollectionPage with linked items', () => {
    const ld = collectionJsonLd({
      name: 'Traffic and roads',
      description: 'd',
      url: 'https://learncivicsense.in/traffic/',
      items: [{ name: 'The case', url: '/x' }],
    });
    expect(ld['@type']).toBe('CollectionPage');
    expect(ld.isPartOf).toEqual({ '@id': 'https://learncivicsense.in/#website' });
    expect(ld.mainEntity).toEqual({
      '@type': 'ItemList',
      numberOfItems: 1,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'The case',
          url: 'https://learncivicsense.in/x',
        },
      ],
    });
  });
});

describe('organizationJsonLd() / websiteJsonLd()', () => {
  it('names the site and gives search engines its logo', () => {
    expect(organizationJsonLd('What the site is.')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://learncivicsense.in/#organization',
      name: 'Learn Civic Sense',
      url: 'https://learncivicsense.in/',
      description: 'What the site is.',
      logo: {
        '@type': 'ImageObject',
        url: 'https://learncivicsense.in/logo.png',
        width: 512,
        height: 512,
      },
    });
    expect(websiteJsonLd()).toMatchObject({
      '@type': 'WebSite',
      '@id': 'https://learncivicsense.in/#website',
      name: 'Learn Civic Sense',
      url: 'https://learncivicsense.in/',
      publisher: { '@id': 'https://learncivicsense.in/#organization' },
    });
  });
});

describe('breadcrumbJsonLd()', () => {
  it('builds a BreadcrumbList with absolute item URLs and 1-based positions', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Traffic', url: '/traffic/' },
    ]);
    const items = ld.itemListElement as Array<{ position: number; item: string }>;
    expect(items[0]?.position).toBe(1);
    expect(items[0]?.item).toBe('https://learncivicsense.in/');
    expect(items[1]?.item).toBe('https://learncivicsense.in/traffic/');
  });
});
