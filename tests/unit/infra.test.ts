import { describe, it, expect } from 'vitest';
import { imagekitEndpoint, imagekitUrl, serialiseTransform } from '../../src/lib/imagekit';
import {
  getArticleImage,
  getArticleImageSrcset,
  getArticleThumb,
  hasArticleImage,
} from '../../src/lib/images';
import { LcsError, TaxonomyError, NetworkTimeoutError } from '../../src/lib/errors';
import { TaxonomySchema, LessonFrontmatterSchema } from '../../src/lib/schemas';

describe('imagekit URL builder', () => {
  it('defaults the endpoint when no env is set', () => {
    expect(imagekitEndpoint()).toBe('https://ik.imagekit.io/civic');
  });
  it('serialises transforms with f-auto and width, in order', () => {
    expect(serialiseTransform({ width: 800, format: 'auto' })).toBe('w-800,f-auto');
    expect(serialiseTransform({ width: 1200, height: 630, format: 'jpg', quality: 80 })).toBe(
      'w-1200,h-630,f-jpg,q-80',
    );
    expect(serialiseTransform({ width: 800, crop: 'at_max' })).toBe('w-800,f-auto,c-at_max');
  });
  it('builds a path-form transformation URL', () => {
    expect(imagekitUrl('sacred-001.png', { width: 800, format: 'auto' })).toBe(
      'https://ik.imagekit.io/civic/tr:w-800,f-auto/sacred-001.png',
    );
  });
});

describe('article images (ImageKit)', () => {
  it('knows which articles have an uploaded image', () => {
    expect(hasArticleImage('sacred-001')).toBe(true);
    expect(hasArticleImage('traffic-001')).toBe(false);
  });

  it('builds an ImageKit hero URL for an article with an image', () => {
    expect(getArticleImage('sacred-001', 'hero')).toBe(
      'https://ik.imagekit.io/civic/tr:w-1200,f-auto/sacred-001.png',
    );
  });

  it('builds a JPEG 1200x630 og URL (absolute) for social cards', () => {
    expect(getArticleImage('sacred-001', 'og', true)).toBe(
      'https://ik.imagekit.io/civic/tr:w-1200,h-630,f-jpg,q-80/sacred-001.png',
    );
  });

  it('emits a multi-width responsive srcset from the single source', () => {
    const srcset = getArticleImageSrcset('sacred-001');
    expect(srcset).toBeDefined();
    expect(srcset).toContain('tr:w-400,f-auto/sacred-001.png 400w');
    expect(srcset).toContain('tr:w-1600,f-auto/sacred-001.png 1600w');
    expect(srcset!.split(', ')).toHaveLength(6);
  });

  it('gives a lesson row a 320w / 640w thumbnail, and none without an image', () => {
    const thumb = getArticleThumb('sacred-001');
    expect(thumb?.src).toContain('tr:w-320,f-auto/sacred-001.png');
    expect(thumb?.srcset).toContain('tr:w-320,f-auto/sacred-001.png 320w');
    expect(thumb?.srcset).toContain('tr:w-640,f-auto/sacred-001.png 640w');
    expect(getArticleThumb('traffic-001')).toBeUndefined();
  });

  it("falls back to the site's share image (a PNG) for an article without an image", () => {
    expect(getArticleImage('traffic-001', 'hero')).toBe('/og-image.png');
    expect(getArticleImage('traffic-001', 'og', true)).toBe(
      'https://learncivicsense.in/og-image.png',
    );
    expect(getArticleImageSrcset('traffic-001')).toBeUndefined();
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
