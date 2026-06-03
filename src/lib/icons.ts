// Map taxonomy.json `icon` strings to our IconName values.
// New clusters in taxonomy need a row here.

export type IconName =
  | 'traffic'
  | 'train'
  | 'droplet'
  | 'map_pin'
  | 'users'
  | 'shield_check'
  | 'plane'
  | 'utensils'
  | 'landmark'
  | 'volume'
  | 'smartphone'
  | 'open_book'
  | 'sparkle';

const map: Record<string, IconName> = {
  'traffic-cone': 'traffic',
  train: 'train',
  droplet: 'droplet',
  'map-pin': 'map_pin',
  users: 'users',
  'shield-check': 'shield_check',
  plane: 'plane',
  utensils: 'utensils',
  landmark: 'landmark',
  'volume-2': 'volume',
  smartphone: 'smartphone',
  explore: 'sparkle',
};

export function categoryIconName(taxonomyIcon: string): IconName {
  return map[taxonomyIcon] ?? 'open_book';
}
