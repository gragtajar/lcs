// Build-time configuration flags for learncivicsense.in.
// Centralised here so the rest of the codebase reads one source of truth.

export const DEFAULT_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Path to the sibling content repository (resolved from the website root).
export const CONTENT_REPO_PATH = '../learncivicsense-content';

// 'published' = only render lessons whose frontmatter status === 'published'.
// 'allowlist' = render lessons whose status === 'published' OR whose id is in LAUNCH_LESSON_IDS.
// At launch the 6 sample lessons still carry status: draft (see spec §17.3),
// so the allowlist mode lets us ship without modifying the content repo.
export const PUBLISH_MODE: 'published' | 'allowlist' = 'allowlist';

export const LAUNCH_LESSON_IDS = new Set([
  'traffic-001',
  'traffic-005',
  'traffic-009',
  'transit-001',
  'transit-003',
  'transit-013',
]);

// Hide categories that have zero published articles. Set false to surface
// "coming soon" placeholders for the full taxonomy.
export const HIDE_EMPTY_CATEGORIES = true;

// 'published' = subcategory counts count only published articles (truthful).
// 'planned' = use estimated_lessons from taxonomy.json (forward-looking).
export const COUNT_MODE: 'published' | 'planned' = 'published';

// Show empty subcategories greyed with a "soon" tag (recommended) vs hide outright.
export const SHOW_EMPTY_SUBCATEGORIES = true;
