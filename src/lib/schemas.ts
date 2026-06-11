// Zod schemas at the system boundary (addendum T5.2).
//
// These validate external input — taxonomy.json and lesson frontmatter — so a
// malformed source fails loudly with a typed error rather than producing a
// broken build. Kept permissive (`.passthrough()` / optional) where the real
// data legitimately carries extra fields beyond what the website consumes.

import { z } from 'zod';

export const ArticleFormatSchema = z.enum(['scenario', 'comparison', 'rule']);
export type ArticleFormat = z.infer<typeof ArticleFormatSchema>;

export const PlannedLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  format: ArticleFormatSchema,
});

export const SubtopicSchema = z
  .object({
    id: z.string(),
    title: z.object({ en: z.string() }).passthrough(),
    planned_lessons: z.array(PlannedLessonSchema).default([]),
  })
  .passthrough();

export const ClusterSchema = z
  .object({
    id: z.string(),
    title: z.object({ en: z.string() }).passthrough(),
    icon: z.string().optional(),
    subtopics: z.array(SubtopicSchema),
  })
  .passthrough();

export const TaxonomySchema = z
  .object({
    version: z.string(),
    clusters: z.array(ClusterSchema),
    abroad_packs: z.array(ClusterSchema).default([]),
  })
  .passthrough();

export type Taxonomy = z.infer<typeof TaxonomySchema>;

/** Lesson frontmatter contract (the fields the website actually reads). */
export const LessonFrontmatterSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    cluster: z.string(),
    subtopic: z.string(),
    format: ArticleFormatSchema,
    status: z.string(),
    length_min: z.number().int().positive().optional(),
    last_updated: z.string().optional(),
    version: z.string().optional(),
    tldr: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;
