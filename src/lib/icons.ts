// The site's icon catalogue: the Lucide icons (https://lucide.dev/icons/) it
// uses, by their Lucide names. `src/components/Icon.astro` renders them at build
// time; Preact islands import the same names from `lucide-preact`. Add a name
// here (and its component in Icon.astro) to use another icon.

export const ICON_NAMES = [
  'arrow-left',
  'book-open',
  'bookmark',
  'chevron-down',
  'chevron-right',
  'clock',
  'compass',
  'droplet',
  'earth',
  'flag',
  'globe',
  'landmark',
  'link',
  'mail',
  'map-pin',
  'menu',
  'plane',
  'search',
  'share-2',
  'shield-check',
  'smartphone',
  'traffic-cone',
  'train-front',
  'users',
  'utensils',
  'volume-2',
  'x',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

// taxonomy.json (lcs-content) gives each category an `icon` string. Most are
// already Lucide names; the rest are mapped to the Lucide icon closest to what
// the taxonomy asked for. New categories in the taxonomy need a row here.
const TAXONOMY_ICONS: Record<string, IconName> = {
  'traffic-cone': 'traffic-cone',
  droplet: 'droplet',
  'map-pin': 'map-pin',
  users: 'users',
  'shield-check': 'shield-check',
  plane: 'plane',
  // Lucide renamed its `train` to `train-front`.
  train: 'train-front',
  utensils: 'utensils',
  landmark: 'landmark',
  'volume-2': 'volume-2',
  smartphone: 'smartphone',
  // Material Symbols names: `language` is its globe glyph, `explore` its compass.
  language: 'earth',
  flag: 'flag',
  globe: 'globe',
  explore: 'compass',
};

/** The Lucide icon for a taxonomy `icon` string; an open book when it is unknown. */
export function categoryIconName(taxonomyIcon: string): IconName {
  return TAXONOMY_ICONS[taxonomyIcon] ?? 'book-open';
}
