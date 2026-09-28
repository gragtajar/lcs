import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseLegacyAddresses } from '../../scripts/legacy-addresses.mjs';
import { getNavCategories, articleUrl, categoryUrl } from '../../src/lib/content';

// The frozen redirects in public/.htaccess for the addresses from before the
// site had two levels (ADR 011). The live site answers each one after every
// deploy (scripts/verify-deploy.mjs); these checks keep the block honest
// against today's taxonomy between deploys.

// Vitest runs from the project root (as tests/unit/icons.test.ts relies on).
const htaccess = readFileSync(path.resolve('public/.htaccess'), 'utf8');
const { pairs, rules, unparsed } = parseLegacyAddresses(htaccess);
const isLesson = ([from]: [string, string]) => from.split('/').length === 5;

/** Every page a topic or lesson has today. */
const pages = new Set(
  getNavCategories().flatMap((c) => [categoryUrl(c.id), ...c.articles.map(articleUrl)]),
);

describe('legacy addresses (ADR 011)', () => {
  it('reads the frozen block whole: 211 lessons and 120 subtopic pages, nothing unread', () => {
    expect(unparsed).toEqual([]);
    expect(rules).toBe(134);
    expect(pairs.filter(isLesson)).toHaveLength(211);
    expect(pairs.filter((p) => !isLesson(p))).toHaveLength(120);
    expect(new Set(pairs.map(([from]) => from)).size).toBe(pairs.length);
  });

  it('sends every old address to a page that exists today', () => {
    expect(pairs.filter(([, to]) => !pages.has(to))).toEqual([]);
  });

  it('never redirects an address that is a page today', () => {
    // A new lesson whose slug is an old subtopic's id would be hidden by the
    // subtopic's redirect: rename one of them.
    expect(pairs.filter(([from]) => pages.has(from))).toEqual([]);
  });

  it('moves a lesson to its own slug under its own topic, and a subtopic page to its topic', () => {
    for (const [from, to] of pairs) {
      const [, topic, , slug] = from.split('/');
      expect(to).toBe(slug ? `/${topic}/${slug}/` : `/${topic}/`);
    }
  });
});
