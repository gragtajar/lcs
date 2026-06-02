// Build-time configuration flags for learncivicsense.in.
// Centralised here so the rest of the codebase reads one source of truth.

export const DEFAULT_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Path to the sibling content repository (resolved from the website root).
export const CONTENT_REPO_PATH = '../learncivicsense-content';

// 'published' = only render lessons whose frontmatter status === 'published'.
// 'allowlist' = render lessons whose status === 'published' OR whose id is in LAUNCH_LESSON_IDS.
// The 6 launch lessons still carry status: draft in the content repo (see v1 spec §17.3),
// so allowlist mode keeps them as the only "real" articles until they're formally promoted.
// Per v2 addendum §2.1 parenthetical, this is the expected interim state.
export const PUBLISH_MODE: 'published' | 'allowlist' = 'allowlist';

export const LAUNCH_LESSON_IDS = new Set([
  'traffic-001',
  'traffic-005',
  'traffic-009',
  'transit-001',
  'transit-003',
  'transit-013',
]);
