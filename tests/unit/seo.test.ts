import { describe, it, expect } from 'vitest';
import {
  buildMeta,
  articleJsonLd,
  howToJsonLd,
  collectionJsonLd,
  breadcrumbJsonLd,
} from '../../src/lib/seo';
import type { Lesson, NavCategory, NavSubtopic } from '../../src/lib/content';

describe('buildMeta()', () => {
  it('suffixes the title with the site name when title provided', () => {
    const m = buildMeta({ title: 'Honking', description: 'd', path: '/x' });
    expect(m.fullTitle).toBe('Honking — learncivicsense.in');
  });

  it('falls back to site name + tagline when title is empty', () => {
    const m = buildMeta({ title: '', description: 'd', path: '/' });
    expect(m.fullTitle).toBe('learncivicsense.in — Practical civic sense for India');
  });

  it('builds an absolute canonical URL', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/traffic/' }).canonicalUrl).toBe(
      'https://learncivicsense.in/traffic/',
    );
  });

  it('uses summary_large_image twitter card when an image is set', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/', image: 'x.jpg' }).twitterCard).toBe(
      'summary_large_image',
    );
  });

  it('defaults to summary twitter card when no image', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/' }).twitterCard).toBe('summary');
  });

  it('defaults og:type to website but accepts article', () => {
    expect(buildMeta({ title: 't', description: 'd', path: '/' }).ogType).toBe('website');
    expect(buildMeta({ title: 't', description: 'd', path: '/x', type: 'article' }).ogType).toBe(
      'article',
    );
  });

  it('defaults ogTitle to the suffixed full title and ogDescription to description', () => {
    const m = buildMeta({ title: 'Honking', description: 'd', path: '/x' });
    expect(m.ogTitle).toBe('Honking — learncivicsense.in');
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
    expect(m.fullTitle).toBe('Honking — learncivicsense.in');
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
  subtopics: [],
  lessonCount: 24,
  subtopicCount: 10,
} satisfies NavCategory;

const mockSubtopic = {
  id: 'honking-discipline',
  title: 'Honking discipline',
  defaultFormat: 'scenario',
  estimatedLessons: 4,
  articles: [],
} satisfies NavSubtopic;

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
      subtopic: mockSubtopic,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/traffic/honking-discipline/the-case-against-honking/',
    });
    expect(ld['@type']).toBe('Article');
    expect(ld.headline).toBe(mockLesson.title);
    expect(ld.datePublished).toBe('2026-05-11');
    expect(ld.articleSection).toBe('Traffic and roads');
    expect(ld.wordCount).toBe(5);
    expect(ld.inLanguage).toBe('en-IN');
  });

  it('falls back to category description when TLDR is empty', () => {
    const ld = articleJsonLd({
      category: { ...mockCategory, description: 'fallback' },
      subtopic: mockSubtopic,
      lesson: { ...mockLesson, tldr: [] },
      url: 'https://learncivicsense.in/x',
    });
    expect(ld.description).toBe('fallback');
  });

  it('prefers meta_description over tldr[0] for the description', () => {
    const ld = articleJsonLd({
      category: mockCategory,
      subtopic: mockSubtopic,
      lesson: { ...mockLesson, meta_description: 'A keyword-rich snippet.' },
      url: 'https://learncivicsense.in/x',
    });
    expect(ld.description).toBe('A keyword-rich snippet.');
  });

  it('emits comma-joined keywords from tags, and omits the property when there are none', () => {
    const withTags = articleJsonLd({
      category: mockCategory,
      subtopic: mockSubtopic,
      lesson: { ...mockLesson, tags: ['honking', 'urban', 'traffic'] },
      url: 'https://learncivicsense.in/x',
    });
    expect(withTags.keywords).toBe('honking, urban, traffic');

    const noTags = articleJsonLd({
      category: mockCategory,
      subtopic: mockSubtopic,
      lesson: mockLesson,
      url: 'https://learncivicsense.in/x',
    });
    expect(noTags).not.toHaveProperty('keywords');
  });

  it('emits a markdown-stripped, truncated articleBody', () => {
    const body = ['## The moment', '', 'You **stop** at the [signal](https://x).'].join('\n');
    const ld = articleJsonLd({
      category: mockCategory,
      subtopic: mockSubtopic,
      lesson: { ...mockLesson, body },
      url: 'https://learncivicsense.in/x',
    });
    // The `##` marker is stripped but the heading text survives as prose, joined
    // with the paragraph; emphasis and link syntax are removed.
    expect(ld.articleBody).toBe('The moment You stop at the signal.');

    const long = articleJsonLd({
      category: mockCategory,
      subtopic: mockSubtopic,
      lesson: { ...mockLesson, body: 'word '.repeat(400) },
      url: 'https://learncivicsense.in/x',
    });
    expect((long.articleBody as string).length).toBeLessThanOrEqual(601);
    expect(long.articleBody as string).toMatch(/…$/);
  });
});

describe('howToJsonLd()', () => {
  it('maps rule sections onto HowToSteps with the lesson title + description', () => {
    const ld = howToJsonLd({
      lesson: { ...mockLesson, format: 'rule', meta_description: 'How to do X.' },
      sections: [
        { heading: 'The rule', text: 'Do X.' },
        { heading: 'Why this rule exists', text: 'Because Y.' },
      ],
    });
    expect(ld).not.toBeNull();
    expect(ld!['@type']).toBe('HowTo');
    expect(ld!.name).toBe(mockLesson.title);
    expect(ld!.description).toBe('How to do X.');
    const steps = ld!.step as Array<{ '@type': string; name: string; text: string }>;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toEqual({ '@type': 'HowToStep', name: 'The rule', text: 'Do X.' });
  });

  it('returns null when there are no sections (no empty HowTo)', () => {
    expect(howToJsonLd({ lesson: mockLesson, sections: [] })).toBeNull();
  });

  it('falls back to tldr[0] for the description when meta_description is empty', () => {
    const ld = howToJsonLd({
      lesson: mockLesson,
      sections: [{ heading: 'The rule', text: 'Do X.' }],
    });
    expect(ld!.description).toBe('First takeaway');
  });
});

describe('collectionJsonLd()', () => {
  it('builds a CollectionPage with linked items', () => {
    const ld = collectionJsonLd({
      name: 'Honking discipline',
      description: 'd',
      url: 'https://learncivicsense.in/traffic/honking-discipline/',
      items: [{ name: 'The case', url: '/x' }],
    });
    expect(ld['@type']).toBe('CollectionPage');
    expect((ld.hasPart as unknown[]).length).toBe(1);
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
