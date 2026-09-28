# ADR 011: Two levels, topics and lessons

**Status:** Accepted
**Date:** 2026-09-28
**Authors:** Rajat Garg
**Amends:** [ADR 006](./006-coming-soon-rendering.md) (a stub's routing and its way back)

## Context

The library had three levels: 14 topics, 120 subtopics, 211 planned lessons.
Most subtopics were too small to be worth a page: on 2026-09-28, 57 held one
lesson and 43 held two; only 5 held four or more. A reader choosing a lesson
went through a topic page that listed subtopics, then a subtopic page that
listed one or two lessons. The owner asked for the subtopics to go, and for the
topic page to take the subtopic page's layout, so every lesson sits directly
under its topic, the abroad packs included.

Subtopics also live outside the website: in `taxonomy.json` (each topic's
lessons are grouped in `subtopics[].planned_lessons`), in every lesson's
`subtopic:` frontmatter, in `lint.py` (a required field), in the drafting
prompts and templates, in the publish manifest's `url_path`, and in the daily
writing task, which writes that `url_path`.

## Decision

The site has two levels. Asked how far the removal should go, the owner chose
the website only.

- **Topic pages list every lesson in the topic**, in the layout the subtopic
  pages had: the topics as a sidebar (a drawer on phones), the topic's name in
  its colour with its description, one line of facts, then the lesson rows,
  illustrations included. The order is the taxonomy's (subtopic by subtopic),
  so related lessons stay together; coming-soon lessons keep their place.
- **Lessons live at `/{topic}/{lesson}/`.** Slugs are unique across the whole
  library today; a unit test keeps them unique within each topic.
- **`/topics/` lists every lesson by topic**, with its reading time or "Coming
  soon", instead of subtopic rows.
- **Subtopics stay in the content as editorial grouping.** `taxonomy.json` and
  the lessons' `subtopic:` field are unchanged: they order a topic's lessons,
  and the writing workflow and `lint.py` keep working. The site never shows,
  links or addresses a subtopic.
- **A coming-soon lesson** offers the topic's nearest readable lesson in
  taxonomy order ("Meanwhile, in {topic}"), then "All lessons in {topic}".
- **Every old address redirects permanently** (301). That is each lesson
  `/{topic}/{subtopic}/{lesson}/` to `/{topic}/{lesson}/`, and each subtopic
  page `/{topic}/{subtopic}/` to `/{topic}/`, with or without the trailing
  slash, query string kept. The rules are a frozen block in `public/.htaccess`
  (134 rules). It is exactly the 211 lesson and 120 subtopic addresses of the
  live sitemap on 2026-09-28 (lcs-content 3b90727); lessons added later never
  had an old address.

## Alternatives considered

- **Remove subtopics from the content too** (taxonomy, all lesson files,
  `lint.py`, prompts, templates, the daily task). The owner declined. It is a
  large change to the authoring pipeline and to files with local work in
  progress, for no reader-facing gain; the grouping still helps whoever plans
  and writes lessons.
- **Keep the three-part addresses** and change only the pages. Rejected: the
  addresses would carry a level the site no longer has, and sharing a lesson
  would keep exposing it.
- **Generate the redirects at build time from the taxonomy.** Rejected: the
  old addresses are a fixed historical set. Recomputing them from a taxonomy
  that keeps changing could silently drop or change one.
- **One generic rule** (any `/a/b/c/` to `/a/c/`, any `/a/b/` to `/a/`).
  Rejected: a mistyped address would be redirected to another missing one, or
  to its topic, instead of reaching the 404 page, which offers the lesson the
  reader meant (ADR 010).

## Consequences

- Every lesson address changed two days after launch. The 301s keep shared
  links and search results working. `scripts/verify-deploy.mjs` requests all
  331 old addresses after every deploy, and the production browser suite
  follows one lesson and one subtopic address as a browser would.
- `tests/unit/legacy-addresses.test.ts` checks that every redirect still ends
  at a page that exists. It also catches a new lesson whose slug is an old
  subtopic id in the same topic, which the subtopic's redirect would hide.
  Rename one of the two if it fires.
- Search rows and the "Up next" card name the topic only. The BreadcrumbList
  JSON-LD is Home, topic, lesson.
- The content repo's documentation and the publish manifest's `url_path`
  values describe the two-level addresses (lcs-content and lcs-workflow, same
  day), and so does the daily writing task in lcs-tasks.

## References

- `src/lib/content.ts` (`NavCategory.articles`, `articleUrl`, `nearestPublished`)
- `src/pages/[category]/index.astro`, `src/pages/[category]/[article].astro`,
  `src/pages/topics.astro`, `src/components/SidebarNav.astro`,
  `src/components/LessonIndex.astro`
- `public/.htaccess` (the `BEGIN/END legacy addresses` block),
  `scripts/legacy-addresses.mjs`, `scripts/verify-deploy.mjs`
- ADR 006 (coming-soon stubs), ADR 010 (the 404 page)
