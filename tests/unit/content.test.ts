import { describe, it, expect } from 'vitest';
import {
  loadTaxonomy,
  getNavCategories,
  getCategory,
  findPlannedArticle,
  loadLessonForArticle,
  loadVisitorsModule,
  resolveRelated,
  relatedLinkOf,
  nearestPublished,
  articleUrl,
  categoryUrl,
  visitorsUrl,
  trimmedString,
  optionalTrimmedString,
  normaliseDate,
  extractRuleSections,
  type NavCategory,
  type PlannedArticle,
} from '../../src/lib/content';

/** First planned lesson that still has no loadable .md on disk. Coming-soon
 *  coverage shrinks with every publish batch, so tests discover an unwritten
 *  lesson rather than pinning one that gets published out from under them.
 *  Checks the file, not just the nav flag: a local `status: draft` file is
 *  unpublished yet still loads, and would otherwise satisfy the flag alone. */
function anyComingSoonArticle() {
  return getNavCategories()
    .flatMap((c) => c.articles)
    .find((a) => !a.published && loadLessonForArticle(a) === null);
}

/** A made-up topic whose lessons are readable or not as `pattern` says ('r'/'-'). */
function fakeTopic(pattern: string): PlannedArticle[] {
  const cat = { id: 'fake', title: 'Fake', articles: [] as PlannedArticle[] } as NavCategory;
  cat.articles = [...pattern].map((ch, i) => ({
    id: `fake-${i}`,
    slug: `lesson-${i}`,
    title: `Lesson ${i}`,
    format: 'scenario' as const,
    published: ch === 'r',
    category: cat,
  }));
  return cat.articles;
}

describe('extractRuleSections()', () => {
  const ruleBody = [
    '## The rule',
    '',
    'Do not smoke in enclosed public spaces.',
    '',
    '## Why this rule exists',
    '',
    'Second-hand smoke harms others. See **COTPA**.',
    '',
    "## What happens if you don't follow it",
    '',
    'A fine under Section 4.',
    '',
    '## Quick reference',
    '',
    '- Smoke only in designated areas',
    '- Carry it outside',
  ].join('\n');

  it('splits a rule body into its four heading/text sections in order', () => {
    const sections = extractRuleSections(ruleBody);
    expect(sections.map((s) => s.heading)).toEqual([
      'The rule',
      'Why this rule exists',
      "What happens if you don't follow it",
      'Quick reference',
    ]);
    expect(sections[0]?.text).toBe('Do not smoke in enclosed public spaces.');
    expect(sections[1]?.text).toBe('Second-hand smoke harms others. See COTPA.');
    expect(sections[3]?.text).toBe('Smoke only in designated areas Carry it outside');
  });

  it('ignores ### subheadings (only ## starts a section) and drops empty sections', () => {
    const body = ['## Main', '', '### Sub', '', 'Body text here.'].join('\n');
    const sections = extractRuleSections(body);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBe('Main');
    expect(sections[0]?.text).toBe('Sub Body text here.');
  });

  it('returns [] for a body with no headings', () => {
    expect(extractRuleSections('Just a paragraph, no headings.')).toEqual([]);
  });
});

describe('frontmatter string coercion helpers', () => {
  it('trimmedString trims strings and returns "" for non-strings', () => {
    expect(trimmedString('  hi  ')).toBe('hi');
    expect(trimmedString('')).toBe('');
    expect(trimmedString(undefined)).toBe('');
    expect(trimmedString(42)).toBe('');
  });

  it('optionalTrimmedString returns the trimmed value or undefined when empty/non-string', () => {
    expect(optionalTrimmedString('  Override  ')).toBe('Override');
    expect(optionalTrimmedString('   ')).toBeUndefined();
    expect(optionalTrimmedString('')).toBeUndefined();
    expect(optionalTrimmedString(123)).toBeUndefined();
  });

  it('normaliseDate formats a Date (UTC parts) to ISO YYYY-MM-DD', () => {
    // js-yaml stores `last_updated: 2026-06-04` as UTC midnight.
    expect(normaliseDate(new Date(Date.UTC(2026, 5, 4)))).toBe('2026-06-04');
    // Zero-padding for single-digit month/day.
    expect(normaliseDate(new Date(Date.UTC(2026, 0, 9)))).toBe('2026-01-09');
  });

  it('normaliseDate passes an ISO string through (trimmed) and rejects garbage', () => {
    expect(normaliseDate('2026-06-04')).toBe('2026-06-04');
    expect(normaliseDate('  2026-06-04  ')).toBe('2026-06-04');
    expect(normaliseDate('')).toBe('');
    expect(normaliseDate(undefined)).toBe('');
    expect(normaliseDate(42)).toBe('');
    expect(normaliseDate(new Date('not-a-date'))).toBe('');
  });
});

describe('loadTaxonomy()', () => {
  it('parses taxonomy.json with v2 shape', () => {
    const tax = loadTaxonomy();
    expect(tax.clusters.length).toBeGreaterThan(0);
    expect(tax.abroad_packs.length).toBeGreaterThan(0);
    expect(tax.visitors_module).toBeDefined();
  });

  it('memoises subsequent reads', () => {
    expect(loadTaxonomy()).toBe(loadTaxonomy());
  });
});

describe('getNavCategories()', () => {
  it('returns 11 India + 3 abroad = 14 navigable categories', () => {
    const nav = getNavCategories();
    expect(nav).toHaveLength(14);
    expect(nav.filter((c) => c.group === 'india')).toHaveLength(11);
    expect(nav.filter((c) => c.group === 'abroad')).toHaveLength(3);
  });

  it('each category has a positive lessonCount and its lessons', () => {
    for (const c of getNavCategories()) {
      expect(c.lessonCount).toBeGreaterThan(0);
      expect(c.articles.length).toBeGreaterThan(0);
    }
  });

  it("lists a topic's lessons in taxonomy order: its subtopics one after another", () => {
    const tax = loadTaxonomy();
    for (const raw of [...tax.clusters, ...tax.abroad_packs]) {
      const planned = raw.subtopics.flatMap((s) => s.planned_lessons.map((p) => p.id));
      expect(getCategory(raw.id)?.articles.map((a) => a.id)).toEqual(planned);
    }
  });

  it('gives every lesson in a topic its own slug, so /{topic}/{slug}/ never collides', () => {
    for (const c of getNavCategories()) {
      const slugs = c.articles.map((a) => a.slug);
      expect(new Set(slugs).size, c.id).toBe(slugs.length);
    }
  });

  it('exposes planned articles with a category back-reference', () => {
    const a = getCategory('traffic')?.articles[0];
    expect(a?.category.id).toBe('traffic');
  });
});

describe('getCategory() / findPlannedArticle()', () => {
  it('finds Traffic > traffic-001 by its slug', () => {
    const a = findPlannedArticle('traffic', 'the-case-against-honking');
    expect(a?.category.title).toBe('Traffic and roads');
    expect(a).toEqual(expect.objectContaining({ id: 'traffic-001', published: true }));
  });

  it('flags the 6 launch lessons as published via allowlist', () => {
    const launchIds = [
      'traffic-001',
      'traffic-005',
      'traffic-009',
      'transit-001',
      'transit-003',
      'transit-013',
    ];
    for (const id of launchIds) {
      const a = getNavCategories()
        .flatMap((c) => c.articles)
        .find((a) => a.id === id);
      expect(a?.published, `${id} should be published`).toBe(true);
    }
  });

  it('flags planned-but-not-written lessons as not published', () => {
    // Discovered, not hardcoded: any specific lesson gets published eventually
    // and would flip this assertion out from under us.
    const a = anyComingSoonArticle();
    expect(a, 'taxonomy should still plan at least one unwritten lesson').toBeDefined();
    expect(a!.published).toBe(false);
  });

  it('returns undefined for unknown slugs / categories', () => {
    expect(getCategory('nonexistent')).toBeUndefined();
    expect(findPlannedArticle('traffic', 'nonexistent')).toBeUndefined();
    expect(findPlannedArticle('nonexistent', 'the-case-against-honking')).toBeUndefined();
    // A lesson is found under its own topic only.
    expect(findPlannedArticle('air-travel', 'the-case-against-honking')).toBeUndefined();
  });
});

describe('loadLessonForArticle()', () => {
  it('parses a published launch lesson: body, TL;DR, and quiz', () => {
    const a = findPlannedArticle('traffic', 'the-case-against-honking');
    expect(a?.published).toBe(true);
    const lesson = loadLessonForArticle(a!);
    expect(lesson).not.toBeNull();
    expect(lesson!.id).toBe('traffic-001');
    expect(lesson!.body.length).toBeGreaterThan(0);
    expect(lesson!.tldr.length).toBeGreaterThan(0);
    // The case-against-honking lesson ships a quiz block.
    expect(Array.isArray(lesson!.quiz)).toBe(true);
    expect(lesson!.quiz!.length).toBeGreaterThan(0);
    // SEO fields (added 2026-06-20) parse with correct types even before the
    // meta_description backfill lands — meta_description is always a string,
    // og_title / og_description stay undefined until authored.
    expect(typeof lesson!.meta_description).toBe('string');
    expect(['undefined', 'string']).toContain(typeof lesson!.og_title);
    expect(['undefined', 'string']).toContain(typeof lesson!.og_description);
  });

  it('returns null for a coming-soon (unwritten) article', () => {
    const a = anyComingSoonArticle();
    expect(a, 'taxonomy should still plan at least one unwritten lesson').toBeDefined();
    expect(a!.published).toBe(false);
    expect(loadLessonForArticle(a!)).toBeNull();
  });

  it('memoises repeat loads of the same article', () => {
    const a = findPlannedArticle('traffic', 'the-case-against-honking');
    expect(loadLessonForArticle(a!)).toBe(loadLessonForArticle(a!));
  });

  it('parses a published abroad-pack lesson (exercises the 03-abroad path)', () => {
    const a = findPlannedArticle(
      'universal-core',
      'queueing-in-international-contexts-the-global-default',
    );
    expect(a?.published).toBe(true);
    expect(a?.category.group).toBe('abroad');
    const lesson = loadLessonForArticle(a!);
    expect(lesson?.id).toBe('global-001');
    expect(lesson!.body.length).toBeGreaterThan(0);
  });
});

describe('loadVisitorsModule()', () => {
  it('returns a single module with 10 subtopics and a phase-4 status', () => {
    const v = loadVisitorsModule();
    expect(v.id).toBe('visitors');
    expect(v.phase).toBe(4);
    expect(v.subtopicCount).toBe(v.subtopics.length);
    expect(v.lessonCount).toBeGreaterThan(0);
  });
});

describe('resolveRelated()', () => {
  it('resolves known IDs to articleUrl-linked entries naming their topic', () => {
    const links = resolveRelated(['traffic-001', 'traffic-005']);
    expect(links).toHaveLength(2);
    expect(links[0]?.url).toBe('/traffic/the-case-against-honking/');
    expect(links[0]?.category).toBe('Traffic and roads');
    expect(links[0]?.minutes).toBeGreaterThan(0);
  });

  it('drops unknown IDs silently', () => {
    expect(resolveRelated(['nonexistent-999'])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(resolveRelated([])).toEqual([]);
  });

  it('gives an unwritten lesson no reading time', () => {
    const a = anyComingSoonArticle();
    expect(a).toBeDefined();
    expect(relatedLinkOf(a!).minutes).toBeUndefined();
  });
});

describe('nearestPublished()', () => {
  it('takes the closest readable lesson, looking after it, then before it, at each distance', () => {
    const list = fakeTopic('r----r');
    // From index 3: one step after is unreadable, one before too; two after is
    // index 5 (readable) and wins over index 0, three before.
    expect(nearestPublished(list[3]!)?.id).toBe('fake-5');
    // A tie at the same distance goes to the later lesson.
    expect(nearestPublished(fakeTopic('r-r')[1]!)?.id).toBe('fake-2');
    // Never itself, even when it is readable.
    expect(nearestPublished(fakeTopic('rr')[0]!)?.id).toBe('fake-1');
  });

  it('returns undefined when nothing else in the topic is readable', () => {
    expect(nearestPublished(fakeTopic('---')[1]!)).toBeUndefined();
    expect(nearestPublished(fakeTopic('r')[0]!)).toBeUndefined();
  });

  it('finds a readable lesson in the same topic for a real coming-soon lesson', () => {
    const a = anyComingSoonArticle();
    expect(a).toBeDefined();
    const next = nearestPublished(a!);
    if (next) {
      expect(next.published).toBe(true);
      expect(next.category.id).toBe(a!.category.id);
    }
  });
});

describe('URL helpers', () => {
  it('articleUrl uses category id + slug with trailing slash (two levels, ADR 011)', () => {
    const c = getCategory('traffic')!;
    const a = c.articles[0]!;
    expect(articleUrl(a)).toBe(`/${c.id}/${a.slug}/`);
  });

  it('categoryUrl and visitorsUrl format consistently', () => {
    expect(categoryUrl('traffic')).toBe('/traffic/');
    expect(visitorsUrl()).toBe('/visitors/');
  });
});
