import { describe, it, expect } from 'vitest';
import {
  cloudflareImagesDeliveryUrl,
  cloudflareImagesEnabled,
  cloudflareEnvOk,
} from '../../src/lib/cloudflare';
import { getArticleImage, getArticleImageSrcset } from '../../src/lib/images';
import { LcsError, TaxonomyError, NetworkTimeoutError } from '../../src/lib/errors';
import { TaxonomySchema, LessonFrontmatterSchema } from '../../src/lib/schemas';

// In the test env no Cloudflare vars are set, so these assert the fallback path.
describe('cloudflare (no env configured)', () => {
  it('returns undefined delivery URL when account hash is absent', () => {
    expect(cloudflareImagesDeliveryUrl('articles/x/hero', 'hero')).toBeUndefined();
  });
  it('reports images disabled', () => {
    expect(cloudflareImagesEnabled()).toBe(false);
  });
  it('env check reports the missing public hash', () => {
    const report = cloudflareEnvOk();
    expect(report.ok).toBe(false);
    expect(report.missing).toContain('PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH');
  });
});

describe('images fallback', () => {
  it('falls back to the local placeholder for any variant', () => {
    expect(getArticleImage('sacred-014', 'hero')).toBe('/placeholders/default-article.svg');
  });
  it('returns an absolute placeholder URL when requested (og:image)', () => {
    expect(getArticleImage('sacred-014', 'og', true)).toBe(
      'https://learncivicsense.in/placeholders/default-article.svg',
    );
  });
  it('srcset is a single placeholder entry when images disabled', () => {
    const srcset = getArticleImageSrcset('sacred-014');
    expect(srcset).toContain('/placeholders/default-article.svg');
  });
});

describe('error hierarchy', () => {
  it('subclasses carry name + code and are instanceof LcsError', () => {
    const err = new TaxonomyError('bad');
    expect(err).toBeInstanceOf(LcsError);
    expect(err.name).toBe('TaxonomyError');
    expect(err.code).toBe('TAXONOMY_ERROR');
  });
  it('NetworkTimeoutError keeps url + timeout', () => {
    const err = new NetworkTimeoutError('slow', '/pagefind', 8000);
    expect(err.url).toBe('/pagefind');
    expect(err.timeoutMs).toBe(8000);
    expect(err.code).toBe('NETWORK_TIMEOUT');
  });
});

describe('zod schemas', () => {
  it('accepts a minimal valid taxonomy and passes through extras', () => {
    const parsed = TaxonomySchema.parse({
      version: '2.0.0',
      clusters: [{ id: 'traffic', title: { en: 'Traffic' }, subtopics: [] }],
      abroad_packs: [],
      extra_field: 'ignored',
    });
    expect(parsed.clusters[0]?.id).toBe('traffic');
  });
  it('rejects a taxonomy missing version', () => {
    const result = TaxonomySchema.safeParse({ clusters: [] });
    expect(result.success).toBe(false);
  });
  it('rejects frontmatter with an unknown format', () => {
    const result = LessonFrontmatterSchema.safeParse({
      id: 'x-001',
      slug: 's',
      title: 't',
      cluster: 'c',
      subtopic: 'sub',
      format: 'not-a-format',
      status: 'published',
    });
    expect(result.success).toBe(false);
  });
});
