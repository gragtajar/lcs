import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ICON_NAMES, categoryIconName } from '../../src/lib/icons';
import { getNavCategories, loadVisitorsModule } from '../../src/lib/content';

describe('icon catalogue', () => {
  it('names only icons that @lucide/astro ships', () => {
    const dir = path.resolve('node_modules/@lucide/astro/src/icons');
    for (const name of ICON_NAMES) {
      expect(existsSync(path.join(dir, `${name}.ts`)), name).toBe(true);
    }
  });
});

describe('categoryIconName()', () => {
  it('gives every category in the taxonomy a Lucide icon of its own', () => {
    const taxonomyIcons = [...getNavCategories().map((c) => c.icon), loadVisitorsModule().icon];
    for (const icon of taxonomyIcons) {
      const name = categoryIconName(icon);
      expect(ICON_NAMES).toContain(name);
      // The open book is the fallback for names the map does not know.
      expect(name, `taxonomy icon "${icon}" has no mapping`).not.toBe('book-open');
    }
  });

  it('maps the non-Lucide taxonomy names to their closest Lucide icons', () => {
    expect(categoryIconName('train')).toBe('train-front');
    expect(categoryIconName('language')).toBe('earth');
    expect(categoryIconName('explore')).toBe('compass');
  });

  it('falls back to an open book for an unknown name', () => {
    expect(categoryIconName('no-such-icon')).toBe('book-open');
  });
});
