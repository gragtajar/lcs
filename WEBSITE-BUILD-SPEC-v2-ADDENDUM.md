# Website Build Spec — v2 Addendum (Volumetric Navigation)

**Version:** 2.0 (additive to v1)
**Date:** 2026-06-02
**For:** Claude Code, on top of the current localhost build
**Status:** Ready to apply.

---

## Why this addendum exists

The v1 launch was scoped to 2 categories (Traffic + Public Transport) with 3 subcategories each and 1 article per subcategory. The current localhost build reflects that.

The site now needs to show the **full volumetric picture**: every category, every subcategory, and every planned article in the navigation, so the platform owner can see scope at a glance and visitors can browse the full plan. Articles that aren't written yet should render as proper "coming soon" pages, not be hidden.

This addendum describes only what changes from v1. Everything not mentioned here stays exactly as v1 specified.

---

## TL;DR for the implementer

1. **`taxonomy.json` has been restructured.** Every `planned_lessons` entry is now an object `{id, slug, title, format}` instead of a bare title string. Abroad packs now have proper `subtopics` arrays. A new top-level `visitors_module` represents the Phase-4 placeholder.
2. **Show ALL 15 categories, all 130 subcategories, all 211 planned articles in the nav.** Drop the v1 rule that hid empty categories.
3. **For any planned article whose `.md` file does NOT exist in the content repo**, render a **coming-soon variant** of the article page: the same header layout (title, format chip, image placeholder, breadcrumb) and a body that says "This lesson is being written. Expected in Phase X."
4. **Search and sidebar filter** also include coming-soon articles by title, flagged as coming-soon in the results.
5. **The Visitors module** (Phase-4 placeholder) gets a special category card on the homepage. Its subcategories don't list individual lessons; they show estimated counts.

That's the whole change. Details below.

---

## 1. New taxonomy.json structure (read this first)

### 1.1 What changed

The file is at `../learncivicsense-content/01-taxonomy/taxonomy.json`. Top-level keys to know about:

- `clusters` — the 11 India categories. Each cluster's `subtopics[].planned_lessons` is now an array of objects, not strings.
- `abroad_packs` — the 3 abroad packs. Same new shape as clusters (each has `subtopics` with `planned_lessons` objects). The old flat `subtopic_areas` field is gone.
- `visitors_module` — NEW. The Phase-4 foreigners-to-India placeholder.
- Convenience fields added at every level: `lesson_count`, `subtopic_count` (computed by the restructure script; the build can use these directly instead of recomputing).

### 1.2 The new lesson object shape

```json
{
  "id": "traffic-002",
  "slug": "honking-at-red-lights-and-what-it-costs-everyone",
  "title": "Honking at red lights and what it costs everyone",
  "format": "scenario"
}
```

These four fields are guaranteed present for every planned lesson across both clusters and abroad packs. The `id` and `slug` are stable and permanent — Phase 2 lesson files will be named to match (`{cluster-prefix}-{NNN}-{slug}.en.md`).

### 1.3 The visitors_module shape

```json
{
  "id": "visitors",
  "title": {"en": "For visitors to India"},
  "icon": "explore",
  "phase": 4,
  "status": "placeholder",
  "description": {"en": "..."},
  "subtopics": [
    {
      "id": "cultural-fundamentals",
      "title": {"en": "Cultural fundamentals"},
      "estimated_lessons": 6,
      "planned_lessons": []
    },
    ...10 subtopics total
  ],
  "lesson_count": 67,
  "subtopic_count": 10
}
```

Note: `planned_lessons` is intentionally empty for visitors-module subtopics. Use `estimated_lessons` for counts. There are no concrete article pages to render under the visitors module; clicking a visitors subtopic should land on a single subcategory-level "Phase 4 — lessons being designed" page.

### 1.4 Existing fields you can still rely on

All v1 fields are preserved: `cluster.id`, `cluster.title`, `cluster.icon`, `cluster.lesson_id_prefix`, `subtopic.id`, `subtopic.title`, `subtopic.default_format`, etc.

---

## 2. Rendering published vs coming-soon articles

This is the central new behavior. Every planned article in taxonomy gets an article page. Whether that page renders real content or a coming-soon placeholder depends on whether a markdown file exists for it.

### 2.1 Detecting "is this article published?"

For each `{id, slug, title, format}` in a subtopic's `planned_lessons`:

1. Look for a file at `../learncivicsense-content/02-clusters/{cluster.id}/lessons/{cluster-prefix}-{NNN}-{slug}.en.md` (for India clusters) or under `../learncivicsense-content/03-abroad/{pack.id}/lessons/{prefix}-{NNN}-{slug}.en.md` (for abroad packs).
   - `{cluster-prefix}` comes from `cluster.lesson_id_prefix` (e.g., `traffic`, `transit`). The numeric part is the last 3 digits of `id` (e.g., `traffic-001` → `001`).
2. If the file exists AND its frontmatter has `status: published`, render the real article (v1 behavior).
3. Otherwise, render the **coming-soon variant** (section 2.3 below).

(Note: at this moment the launch lessons still carry `status: draft` per WEBSITE-BUILD-SPEC.md section 17.3. For this v2 build, treat the 6 launch lessons as effective-published — they have full bodies and are what's on localhost today. A formal `status: published` flip happens later.)

### 2.2 Header rendering: identical for both variants

For both real and coming-soon articles, the header renders the same way (this is the whole point — the design holds up regardless of body state):

- Breadcrumb: `Category > Subcategory`
- Article title (h1) — from taxonomy `title` (real article frontmatter `title` is the same; either source works)
- Format chip — scenario / comparison / rule (from taxonomy or frontmatter)
- Image placeholder (16:9 reserved space, same as v1)
- Metadata row: `last_updated` if real article, otherwise show "Coming soon" badge in place of the date; reading time omitted for coming-soon (since `length_min` is unknown)

### 2.3 Coming-soon body

Replace the article body, TL;DR box, quiz, sources, and related-links sections with:

```
[Coming-soon badge / icon]

This lesson is being written. {EXPECTED_PHASE_LINE}

[Link back to the subcategory page: "← All lessons in {subcategory-title}"]
[Optional: link to a few published nearby lessons in the same cluster]
```

`{EXPECTED_PHASE_LINE}` is derived from the cluster/pack's roadmap:

- For India clusters and abroad packs: "Expected in Phase 2."
- For the visitors module (if you choose to render its subtopic-level pages): "Expected in Phase 4."

Keep the coming-soon body short, calm, and reassuring. Do NOT add a newsletter signup or "be notified" form (we have no auth yet).

### 2.4 Visual styling for coming-soon

The coming-soon variant should be **visually distinct but not jarring**:

- Header layout identical to published.
- Title color: same.
- Image placeholder: slightly desaturated, or with a small "coming soon" overlay.
- Format chip: rendered with a muted/outlined style instead of filled.
- Body: a calm placeholder block (warm amber soft background `--color-accent-soft`, ~60% the width of the article column, centered, with the schedule icon and the message above).
- Quiz, sources, related links: all hidden.
- TOC: hidden (no sections to outline).

---

## 3. Homepage updates

### 3.1 Show all categories

Drop the v1 rule that hides categories with zero published articles. Render all of these in the homepage category list:

- All 11 India clusters (from `taxonomy.clusters`)
- All 3 abroad packs (from `taxonomy.abroad_packs`)
- The visitors module (from `taxonomy.visitors_module`)

That's 15 cards. Layout them as before (responsive 1-2 column).

### 3.2 Section the homepage

To keep this navigable, group the 15 categories into three sections on the homepage:

1. **"In and around India"** — the 11 India clusters
2. **"For your trip abroad"** — the 3 abroad packs
3. **"For visitors to India"** — the visitors module (single card)

Each section gets a small heading and a 1-line description. Sections are visually separated with `--space-7` and a subtle divider.

### 3.3 Counts shown per category

For India clusters and abroad packs: use `cluster.subtopic_count` and `cluster.lesson_count` directly from the taxonomy. Format as e.g. "8 subcategories · 13 articles".

For the visitors module: use `subtopic_count` and `lesson_count`, but render as "10 areas · ~67 lessons planned (Phase 4)".

### 3.4 Visitors module card behavior

The visitors module card looks similar to others but:

- Has a small "Phase 4" badge.
- Clicking it opens the visitors-module page (section 6 below) instead of a regular category page.

---

## 4. Category page updates

### 4.1 Sidebar shows all categories and subcategories

The accordion in the left sidebar (v1 section 11.2) now lists ALL 14 entries (11 India + 3 abroad). The visitors module is excluded from this sidebar (visitors is a separate route, not part of the main learning flow).

The sidebar's own search filter still works on names only.

### 4.2 Article list shows all planned articles

The right pane (v1 section 11.3) now lists every planned article in the subcategory, not just published. For each, render the ArticleListItem with:

- **Real articles** (file exists): full info (title, last-updated, reading time, image placeholder).
- **Coming-soon articles**: title + "Coming soon" badge in place of date/time + image placeholder (the same desaturated style as on the article page).

Coming-soon articles are clickable and navigate to their coming-soon article page.

Ordering: keep the order from taxonomy's `planned_lessons` (this is narrative/curriculum order). Real and coming-soon articles intermix freely in the list; do NOT segment "published" vs "coming soon" into separate sections — the list should flow naturally.

### 4.3 Empty subcategory rule (still applies)

If a subcategory has zero planned articles AND no published files, show "Lessons coming soon for this topic" — same as v1.

In practice, no India cluster or abroad pack subcategory will be empty after the v2 restructure; all have at least 1 planned lesson. The visitors module's subcategories ARE intentionally empty (estimated lessons only).

---

## 5. Article page: coming-soon variant

Already specified in section 2.3 above. To summarize for completeness:

- Route: `/{category}/{subcategory}/{slug}` (same as published articles)
- Header: identical layout, "Coming soon" badge instead of date
- Body: short coming-soon message with link back to subcategory
- No TOC, no quiz, no sources, no related

---

## 6. Visitors module pages (lightweight)

The visitors module is a single category for the volumetric view; it doesn't need full nested rendering for v2. Specifics:

### 6.1 `/visitors` (category landing)

- Top bar (same).
- Hero block: the module's title, the phase-4 badge, the description from taxonomy.
- A list of the 10 subtopics with their estimated lesson counts (no article-level drilldown).
- A note: "This module is in design. Detailed lessons are scheduled for Phase 4."
- Each subtopic title can be a soft link to `/visitors/{subtopic-id}` (next sub-page) or just static text. RECOMMENDED: keep them static for now; we can deepen later.

### 6.2 `/visitors/{subtopic-id}` (optional)

If you choose to render subtopic-level pages, each shows: the subtopic title, the estimated count, and "Lessons being designed. Expected in Phase 4." That's it. RECOMMENDED: skip these and keep visitors as a single page; reduces work and matches "placeholder" semantics.

### 6.3 Visitors module is NOT in the global sidebar

The left-side category accordion on category pages should NOT include the visitors module. Visitors is a separate flow accessed only from the homepage. Reason: it's structurally different (no lessons drilldown) and including it in the accordion creates confusion.

---

## 7. Search updates

### 7.1 Global search (Pagefind)

Pagefind only indexes static content present at build time. Coming-soon articles have no body, so they won't show in body search. But their **titles** should still be findable.

Implementation options, in order of preference:

**Option A (recommended):** Generate a tiny stub HTML page for each coming-soon article at build time, containing just the title in an h1 and the breadcrumb. Pagefind indexes these as normal pages. In Pagefind's result rendering, coming-soon results are flagged with a small "Coming soon" tag next to the title.

**Option B:** Maintain a separate JSON index of coming-soon titles and search it client-side, merging into Pagefind's results. More code, less unified UX.

Use Option A.

### 7.2 Result flagging

In the search overlay (and `/search` page), each result shows:

- Article title (always)
- A small "Coming soon" chip if it's a coming-soon article
- (Optional, kept from v1) a faint breadcrumb showing Category > Subcategory

Coming-soon results sort below published results when relevance is similar.

### 7.3 Sidebar filter (category page)

Sidebar's name-only filter is built off the taxonomy in-memory and already shows everything. No change needed.

---

## 8. Performance and 2G impact

The number of routes grows from ~15 (v1) to ~250 (211 articles + 14 category pages + ~130 subcategory pages + a few static). All are still static HTML at build time, so build time goes up modestly but runtime serving remains constant per page. No 2G impact per page.

Pagefind index size grows roughly linearly with content. Coming-soon stub pages have tiny bodies so the index growth is modest (probably 1.5-2x current size). Still fast.

Update v1 spec section 14 targets: keep them all unchanged. Verify Lighthouse stays in the same range after the v2 build.

---

## 9. i18n notes

The English-only launch behavior is unchanged. The new taxonomy's `title` fields for clusters/subtopics use the `{en: "..."}` map, and individual lesson `title` values are bare strings (English). This works for v2.

When Hindi rolls out, lesson titles will need Hindi adaptations stored somewhere (most likely in the Hindi `.hi.md` lesson files' frontmatter `title`). For coming-soon Hindi articles, the build can fall back to the English title with a note ("title not yet translated"). This is a Phase 3 concern; no v2 implementation needed.

---

## 10. Files that changed in the content repo

For the implementer's reference, these are the files Claude Code should re-read for v2:

- `learncivicsense-content/01-taxonomy/taxonomy.json` (restructured to v2 format, version bumped to 2.0.0)
- `learncivicsense-content/01-taxonomy/taxonomy.json.bak` (the v1 backup, do not read)
- `learncivicsense-content/CONTENT-SCOPE.md` (new — the volumetric reference doc; informational only, not required for build)

No lesson files changed.

---

## 11. Updated acceptance criteria (additive to v1 section 16)

The v1 acceptance criteria still apply. Add these:

**Volumetric navigation**
- [ ] Homepage shows 15 categories grouped into 3 sections (India, Abroad, Visitors).
- [ ] Each category card shows correct subtopic count and lesson count from taxonomy.
- [ ] Visitors category card has a "Phase 4" badge.
- [ ] Sidebar on category pages shows all 14 main categories (excludes visitors), all subcategories.
- [ ] Category pages list ALL planned articles, not just published ones.

**Coming-soon articles**
- [ ] Every planned article (211 total) has a working URL.
- [ ] Articles without a corresponding markdown file render the coming-soon variant.
- [ ] Coming-soon header layout matches published-article header layout (title, format chip, breadcrumb, image placeholder).
- [ ] Coming-soon body shows the calm placeholder message with the correct phase line.
- [ ] No quiz/TOC/sources/related shown on coming-soon pages.

**Visitors module**
- [ ] `/visitors` renders the placeholder landing page with the 10 subtopic groups and estimated counts.
- [ ] Visitors module is NOT included in the category-page sidebar accordion.

**Search**
- [ ] Global search finds coming-soon articles by title.
- [ ] Search results flag coming-soon articles with a "Coming soon" chip.
- [ ] Sidebar filter on category pages already works (no change).

**Performance**
- [ ] Lighthouse performance scores remain within the v1 targets (90 mobile, 95 desktop).
- [ ] Build time stays reasonable (target: under 60 seconds end to end).

---

## 12. Estimated build effort for Claude Code

Rough breakdown of work to apply this addendum to the current localhost build:

| Task | Estimated effort |
|---|---|
| Update content collection logic to parse new taxonomy v2 shape | small |
| Build "is published" detection (file existence + frontmatter check) | small |
| Add coming-soon article page variant (component + route) | medium |
| Update homepage to render all 15 categories in 3 sections | medium |
| Update category page sidebar to show all categories | small |
| Update category page article list to include coming-soon items | small |
| Add visitors module landing page | small |
| Generate stub HTML for Pagefind indexing of coming-soon titles | small |
| Add "Coming soon" chip styling to search results and list items | small |
| Verify Lighthouse, build times, all acceptance criteria | medium |

Total: a single focused day of implementation. No blockers.

---

## End of addendum

When the build is updated to satisfy section 11 above, the platform owner will be able to navigate the entire 211-article volumetric scope, see every planned subcategory, and view individual coming-soon article pages, while the 6 published articles continue to render exactly as they do today.
