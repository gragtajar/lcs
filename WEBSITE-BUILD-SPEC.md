# learncivicsense.in — Website Build Spec

**Version:** 1.0
**Date:** 2026-05-25
**For:** Claude Code (or any developer) to build the website
**Status:** Ready to build. Launch scope = 2 modules (Traffic + Public Transport).

---

## How to use this document

This is the complete, self-contained brief to build the learncivicsense.in website. Read it top to bottom before writing code. It assumes you have access to the content repository at `../learncivicsense-content/` (sibling folder).

The build has a clear definition of done in section 16 (Acceptance criteria). Build to that.

---

## Table of contents

1. What we're building and why
2. Hard constraints (non-negotiable)
3. Tech stack and rationale
4. Content data contract (how the site reads content)
5. Terminology mapping
6. Information architecture and routes
7. Design system (palette, typography, icons, tokens)
8. Component inventory
9. Page spec: Top bar (global)
10. Page spec: Homepage
11. Page spec: Category / subcategory page
12. Page spec: Article page
13. Search spec
14. Performance budget and 2G strategy
15. Dark/light mode, i18n, accessibility, future-proofing
16. Acceptance criteria
17. Content prerequisites (must exist before build)
18. Build, deploy, and project structure

---

## 1. What we're building and why

learncivicsense.in is a free, fast, multilingual learning website that teaches civic sense and public-space behavior to Indians. It is content-first: a large library of short articles ("lessons"), organized into categories and subcategories, readable on any device down to a 2G connection.

The launch build covers 2 of the eventual 11 content categories: **Traffic** and **Public Transport**. The architecture must support all 11 (and the abroad packs, and 8 languages) without rework, but the launch only renders content that exists.

There is no login, no comments, no user accounts at launch. The reading experience is the entire product.

---

## 2. Hard constraints (non-negotiable)

These come directly from the platform owner. Treat them as acceptance gates.

1. **Mobile-friendly AND desktop-friendly.** Mobile-first design. Primary mobile viewport: 360px wide. Desktop is the enhancement.
2. **Very fast to load.** Target: usable on 2G data packs. See section 14 for the performance budget.
3. **Works on 2G.** First meaningful content visible quickly even on slow connections. Minimal JavaScript. Static HTML.
4. **Light, eye-friendly, multilingual font.** See section 7.2. The font must extend to all 8 Indian languages in future.
5. **Google Material Icons** (use the Material Symbols outlined set; see 7.3).
6. **Dark and light modes**, user-toggleable, respecting system preference by default.
7. **No login at launch.** But architecture must leave clean hooks for future favorites and reading lists (see 15.4).
8. **Global search** of all content (categories, subcategories, article titles, AND full article text), very fast, results showing article names only.

---

## 3. Tech stack and rationale

| Layer               | Choice                                                                        | Why                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework / SSG** | **Astro** (latest stable)                                                     | Ships zero JavaScript by default. Renders static HTML at build time. Perfect for a content site that must work on 2G. Islands architecture lets us add interactivity (search, theme toggle, sidebar accordion) only where needed.                |
| **Content source**  | Markdown files in `../learncivicsense-content/` via Astro Content Collections | The content repo is the source of truth. Astro reads markdown + frontmatter natively.                                                                                                                                                            |
| **Search**          | **Pagefind**                                                                  | Static full-text search. Builds an index at build time, served as static files. No server, no API key, no running cost. Loads index chunks on demand, so it scales and stays fast even on slow connections. Indexes title + body + metadata.     |
| **Styling**         | Plain CSS with custom properties (design tokens)                              | No Tailwind runtime, no CSS-in-JS. Hand-authored CSS using the token system in section 7 keeps the payload tiny. Astro scopes component styles automatically.                                                                                    |
| **Icons**           | Material Symbols (Outlined), self-hosted subset                               | See 7.3. Self-host only the glyphs used, as an inline SVG sprite or subsetted font, to avoid loading the entire icon font.                                                                                                                       |
| **Fonts**           | Hind superfamily, self-hosted woff2, subsetted                                | See 7.2.                                                                                                                                                                                                                                         |
| **Interactivity**   | Minimal vanilla JS (Astro islands)                                            | Theme toggle, search UI, sidebar accordion, scroll-spy TOC. No heavy framework needed. If a component genuinely needs reactivity, use a lightweight island (Preact via @astrojs/preact), not React.                                              |
| **Hosting**         | Cloudflare Pages                                                              | Free tier, excellent India edge presence (Mumbai, Delhi, Chennai, Bengaluru, Kolkata, Hyderabad PoPs), automatic HTTP/3, Brotli compression, global CDN. Alternative: Netlify or Vercel if preferred, but Cloudflare has the best India latency. |
| **Analytics**       | Cloudflare Web Analytics or Plausible                                         | Privacy-respecting, no cookies, lightweight. No Google Analytics (heavy, cookie-based).                                                                                                                                                          |
| **Build/CI**        | Cloudflare Pages Git integration                                              | Push to main → auto build → deploy. Content repo updates trigger website rebuild via webhook.                                                                                                                                                    |

**Why not Next.js:** heavier JS baseline, React runtime shipped to client by default, overkill for a static content site. Astro is purpose-built for this.

**Why not Elasticsearch / Algolia:** both need a running server or paid hosted service, adding latency, cost, and infrastructure. For ~200 articles with no login, Pagefind's static index is faster for the user (no network round-trip to a search server) and free. If the catalog ever exceeds ~5,000 articles or needs server-side personalization, revisit. Not now.

---

## 4. Content data contract (how the site reads content)

The website reads from the content repository. Do not duplicate content into the website repo; reference it.

### 4.1 Source of truth files

- **`../learncivicsense-content/01-taxonomy/taxonomy.json`** — the master structure. Defines all clusters (categories) and subtopics (subcategories), their IDs, titles, descriptions, icons, and planned lesson counts. Parse this to build category/subcategory navigation and counts.
- **`../learncivicsense-content/02-clusters/{cluster-id}/lessons/*.md`** — individual lesson (article) files. Each has YAML frontmatter + markdown body + an optional quiz YAML block at the end.
- **`../learncivicsense-content/01-taxonomy/learning-paths.json`** — curated journeys. NOT used in the 2-module launch. Ignore for now; architecture should not break if added later.

### 4.2 Lesson frontmatter schema

Every lesson `.md` file begins with YAML frontmatter. Parse these fields:

```yaml
id: traffic-001 # stable unique ID
slug: the-case-against-honking # URL slug
title: '...' # article title
cluster: traffic # category ID (matches taxonomy.json)
subtopic: honking-discipline # subcategory ID (matches taxonomy.json)
format: scenario # scenario | comparison | rule (affects body rendering)
audience: [adults, students]
length_min: 3 # reading time in minutes (use this directly)
languages: [en] # locale codes available
status: draft # ONLY render status: published in production builds
version: 0.1
last_updated: 2026-05-11 # show as "last updated" date on article + list
tldr: # NEW FIELD — 3-4 bullet quick summary (see section 17)
  - 'First takeaway'
  - 'Second takeaway'
sources: [...] # citations array; render in a Sources section
related: [traffic-002] # related lesson IDs; render as "Related" links
toolkit_widgets: [...] # civic action widgets; NOT built at launch, ignore gracefully
tags: [honking, urban]
```

### 4.3 Locale from filename

Lesson files are named `{cluster-prefix}-{NNN}-{slug}.{locale}.md` (e.g., `traffic-001-the-case-against-honking.en.md`). Parse the locale code (`en`, `hi`, etc.) from the filename. At launch, only `.en.md` files exist. The router must be locale-aware from day one (see 15.3).

### 4.4 Body parsing by format

The markdown body uses section headings that differ by `format`:

- **scenario:** `## The moment` / `## What's actually happening` / `## What works better` / `## Why it matters` / `## Try this next time`
- **comparison:** `## The cultural moment` / `## How it shows up across contexts` (contains a markdown table) / `## The translation move` / `## Try this next time`
- **rule:** `## The rule` / `## Why this rule exists` / `## What happens if you don't follow it` / `## Quick reference`

Render markdown to HTML normally (headings, paragraphs, lists, tables, blockquotes). The `format` field can drive subtle styling differences (e.g., a colored chip labeling the format) but the core rendering is standard markdown. Comparison-format tables must render responsively (horizontal scroll on mobile, or stacked cards on narrow viewports).

### 4.5 Quiz block

At the end of each lesson file, after a `---` separator, there may be a second YAML block starting with `quiz:`. Parse it and render an interactive quiz at the bottom of the article (after the body, before related links). See 12.6 for quiz rendering. Quiz is optional; rule-format lessons may omit it.

### 4.6 Counts (for homepage)

- **Subcategory count per category:** count the subtopics under each cluster in `taxonomy.json`. Note: show counts of subcategories that have at least one published article, OR show planned counts. RECOMMENDED: show the count of subcategories that contain at least one published article at launch, so counts reflect reality. (Make this a config flag: `COUNT_MODE = "published" | "planned"`.)
- **Article count per subcategory:** count published lesson files whose `subtopic` matches, in the launch locale.

At launch (2 modules), only Traffic and Public Transport categories should appear, because only they have published articles. Categories with zero published articles are hidden (config flag `HIDE_EMPTY_CATEGORIES = true`).

---

## 5. Terminology mapping

The owner's vocabulary maps to the content repo's vocabulary:

| Owner's term | Content repo term | Example                    |
| ------------ | ----------------- | -------------------------- |
| Category     | Cluster           | Traffic                    |
| Sub-category | Subtopic          | Honking discipline         |
| Article      | Lesson            | "The case against honking" |

Use the owner's terms in the UI ("Categories," "Articles"). Use the repo's IDs internally.

---

## 6. Information architecture and routes

```
/                                      Homepage (categories + expandable subcategories)
/{category}                            Category landing (optional; can redirect to first subcategory or show category overview)
/{category}/{subcategory}              Category/subcategory page (left sidebar + article list)
/{category}/{subcategory}/{article}    Article page
/search                                Full search results page (also available as overlay from top bar)
/about                                 About the platform (static)
/{locale}/...                          Locale-prefixed versions for non-English (future; en is default, no prefix)
404                                    Not found
```

Notes:

- The default locale `en` has NO prefix (`/traffic/honking-discipline/the-case-against-honking`). Future locales get a prefix (`/hi/traffic/...`).
- Use the `slug` field for the article segment, the `subtopic` ID for the subcategory segment, the `cluster` ID for the category segment. Keep URLs lowercase kebab-case.
- The category landing page (`/{category}`) is optional at launch. RECOMMENDED: make it show the category's subcategories as cards (same data as the homepage accordion, but focused on one category). If you skip it, redirect `/{category}` to the first subcategory.

---

## 7. Design system

### 7.1 Color palette

A calm, civic, trustworthy palette. Deep teal primary, warm amber accent, warm-neutral backgrounds. Deliberately avoids saffron/green (no political coding). Defined as CSS custom properties with a light and dark theme.

```css
/* ===== LIGHT THEME (default) ===== */
:root,
[data-theme='light'] {
  /* Backgrounds */
  --color-bg: #faf8f3; /* warm paper, easy on eyes */
  --color-surface: #ffffff; /* cards, article body */
  --color-surface-alt: #f2eee6; /* sidebar, subtle panels */

  /* Text */
  --color-text: #1b1a17; /* near-black warm ink, ~15:1 on bg */
  --color-text-secondary: #57534b; /* ~7:1 on bg */
  --color-text-muted: #847e73; /* ~4.6:1 on bg, metadata */

  /* Brand */
  --color-primary: #0e6e62; /* deep teal, links + primary actions */
  --color-primary-hover: #0a574d;
  --color-primary-soft: #e1efec; /* teal tint for backgrounds/badges */

  /* Accent */
  --color-accent: #b5641e; /* burnt amber, TL;DR badge, highlights */
  --color-accent-soft: #f6e9db;

  /* Lines & states */
  --color-border: #e4dfd5;
  --color-focus: #0e6e62;
  --color-success: #2e7d5b;
  --color-warning: #b5641e;
}

/* ===== DARK THEME ===== */
[data-theme='dark'] {
  --color-bg: #15181a; /* warm charcoal, not pure black */
  --color-surface: #1e2225;
  --color-surface-alt: #262b2e;

  --color-text: #ece8e0; /* warm off-white, ~14:1 on bg */
  --color-text-secondary: #b0aaa0;
  --color-text-muted: #8a847a;

  --color-primary: #46b8a8; /* brighter teal for dark bg */
  --color-primary-hover: #5dc7b8;
  --color-primary-soft: #173430;

  --color-accent: #e0a35c; /* brightened amber */
  --color-accent-soft: #3a2c1b;

  --color-border: #2f3437;
  --color-focus: #46b8a8;
  --color-success: #5bbe8c;
  --color-warning: #e0a35c;
}
```

Contrast: all text colors meet WCAG AA (4.5:1 body, 3:1 large). Verify with a contrast checker during build.

### 7.2 Typography

**Font: the Hind superfamily** (by Indian Type Foundry). Free, light, humanist sans-serif designed for Devanagari + Latin harmony, with sibling fonts for the other Indian scripts.

- **Launch (English + future Hindi):** "Hind" (covers Latin + Devanagari in one family).
- **Future language extension:** Hind Madurai (Tamil), Hind Guntur (Telugu), Hind Kochi (Malayalam), Hind Vadodara (Gujarati), Hind Mysuru (Kannada). Odia has no Hind variant; fall back to "Noto Sans Oriya" for that locale.

**Loading strategy (critical for 2G):**

- Self-host the woff2 files. Do NOT load from Google Fonts CDN (extra DNS + connection round-trips hurt 2G).
- Subset to the glyphs needed: Latin + Latin-ext for English; add Devanagari subset for Hindi.
- Ship at most 3 weights: Regular (400), Medium (500), SemiBold (600). Use SemiBold for headings, Medium for UI emphasis, Regular for body. (Hind Light 300 optional for very large display text.)
- `font-display: swap` so text renders immediately in a fallback while Hind loads.
- `<link rel="preload">` the Regular weight.
- Fallback stack: `"Hind", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

**Type scale (rem, 16px base):**

```css
--font-family-base: 'Hind', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

--text-xs: 0.8125rem; /* 13px — metadata, chips */
--text-sm: 0.9375rem; /* 15px — secondary, captions */
--text-base: 1.0625rem; /* 17px — body, comfortable reading */
--text-lg: 1.1875rem; /* 19px — lead paragraph, TL;DR */
--text-xl: 1.375rem; /* 22px — h3 */
--text-2xl: 1.625rem; /* 26px — h2 */
--text-3xl: 2.125rem; /* 34px — h1 / article title */
--text-4xl: 2.5rem; /* 40px — homepage hero (desktop) */

--leading-tight: 1.25; /* headings */
--leading-body: 1.7; /* body, reading comfort */

--measure: 68ch; /* max line length for body text */
```

Body text is `--text-base` at `--leading-body`. Article body constrained to `--measure` for readability.

### 7.3 Icons

**Material Symbols (Outlined)**, the lighter outlined style.

- Self-host as a subsetted variable font OR as inline SVGs for the specific icons used. Do NOT load the full Material Symbols font (it is large).
- Recommended approach: inline SVG sprite of just the icons used. Lighter and avoids FOUT.
- Icons needed at launch (approximately): search, menu, close, expand_more, expand_less, light_mode, dark_mode, schedule (reading time), calendar_today (last updated), chevron_right, arrow_back, list (TOC), category icons (per cluster, from taxonomy.json `icon` field, e.g., traffic-cone, train).
- Icon size default: 20px (1.25rem), inline-aligned with text. Color inherits `currentColor`.

### 7.4 Spacing, radius, shadows

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.5rem;
--space-6: 2rem;
--space-7: 3rem;
--space-8: 4rem;

--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;

/* Shadows: minimal, for performance and calm aesthetic */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
/* In dark mode, prefer borders over shadows (shadows are invisible on dark). */
```

Design language: generous whitespace, subtle borders over heavy shadows, moderate rounded corners, clean and calm. This is a reading tool, not a dashboard.

### 7.5 Layout widths

```css
--width-content: 1200px; /* max site width */
--width-article: 760px; /* article text column */
--width-sidebar: 280px; /* category page left sidebar */
--width-toc: 240px; /* article page right TOC */
```

---

## 8. Component inventory

Build these as Astro components (`.astro`), using small Preact/vanilla islands only where interactivity is required (marked [island]).

| Component               | Purpose                                                              | Island?  |
| ----------------------- | -------------------------------------------------------------------- | -------- |
| `BaseLayout.astro`      | HTML shell, head, theme init, font preload                           | no       |
| `TopBar.astro`          | Logo + global search trigger + theme toggle                          | partial  |
| `ThemeToggle`           | Light/dark switch                                                    | [island] |
| `SearchOverlay`         | Global search UI (Pagefind)                                          | [island] |
| `Homepage` (page)       | Category list with expandable subcategories                          | partial  |
| `CategoryAccordion`     | Expand/collapse category to show subcategories                       | [island] |
| `CategoryCard.astro`    | One category with subcategory count                                  | no       |
| `SubcategoryRow.astro`  | One subcategory with article count                                   | no       |
| `CategoryPage` (page)   | Left sidebar + article list                                          | partial  |
| `SidebarNav`            | Accordion of all categories/subcategories + its own name-only filter | [island] |
| `ArticleListItem.astro` | Title, last-updated, reading time, image placeholder                 | no       |
| `ArticlePage` (page)    | Full article layout                                                  | partial  |
| `ArticleHeader.astro`   | Title, date, reading time, image placeholder, format chip            | no       |
| `TldrBox.astro`         | The TL;DR block                                                      | no       |
| `ArticleBody.astro`     | Rendered markdown body                                               | no       |
| `TableOfContents`       | Floating right-side outline, scroll-spy, click-to-anchor             | [island] |
| `LessonQuiz`            | Interactive quiz                                                     | [island] |
| `SourcesList.astro`     | Citations                                                            | no       |
| `RelatedLinks.astro`    | Related article links                                                | no       |
| `Footer.astro`          | Minimal footer                                                       | no       |

Keep islands tiny. The whole point of Astro is that most of this ships as zero-JS HTML.

---

## 9. Page spec: Top bar (global, every page)

Layout (left to right):

- **Left:** Logo (links to homepage). Text logo "learncivicsense.in" or a wordmark. Placeholder acceptable; real logo added later. Keep it lightweight (inline SVG or text).
- **Center/right (desktop):** Global search trigger. A search input or a search button that opens the search overlay. On desktop, can be an always-visible input; on mobile, a search icon that expands.
- **Right:** Theme toggle (light/dark icon).

Behavior:

- **Sticky** at top on scroll (so search is always reachable). Keep it slim (~56-64px tall).
- On mobile (≤640px): logo left, search icon + theme toggle right. Tapping search opens a full-screen search overlay.
- The top bar is identical across homepage, category page, and article page (owner requirement 7, 9.1, 10.1).

Search behavior is specified in section 13.

---

## 10. Page spec: Homepage

Purpose: let a visitor see all categories, drill into subcategories, and understand the scope of content.

### 10.1 Structure

- Top bar (section 9).
- A brief hero / intro (1-2 lines: what the site is). Keep it short. Example: "Practical civic sense for India. Short lessons, real situations, no lectures." (Use the real tagline when chosen.)
- **Category list.** All categories with published content (at launch: Traffic, Public Transport).

### 10.2 Category list behavior (owner requirements 8.1-8.3)

- Each category is shown as a card / row with:
  - Category icon (from taxonomy.json `icon`)
  - Category name
  - **Count of subcategories** it contains (e.g., "10 subcategories")
  - An expand affordance (chevron)
- **Clicking a category expands it** to reveal its subcategories ([island]: CategoryAccordion).
- Each revealed **subcategory row** shows:
  - Subcategory name
  - **Count of articles** it contains (e.g., "3 articles")
  - The whole row links to the category/subcategory page (section 11).
- Multiple categories can be expanded at once, or accordion-single-open. RECOMMENDED: allow multiple open. Remember open/closed state in `localStorage` so it persists across visits.

### 10.3 Counts

See 4.6. At launch, show counts based on published content. Subcategories with zero published articles can either be shown greyed with "coming soon" or hidden. RECOMMENDED: show them greyed with a subtle "soon" tag, so the scope is visible but honest. Make this a config flag.

### 10.4 Responsive

- Desktop: categories as a 1- or 2-column list of cards.
- Mobile: single column, full width, comfortable tap targets (min 44px height).

---

## 11. Page spec: Category / subcategory page

Reached by clicking a subcategory on the homepage. URL: `/{category}/{subcategory}`.

### 11.1 Structure (owner requirements 9.1-9.2)

- Top bar (same as everywhere).
- **Two-column layout** on desktop:
  - **Left sidebar** (`--width-sidebar`): navigation.
  - **Right main area:** article list.
- On mobile: sidebar collapses into a drawer (toggled by a button); article list is full width.

### 11.2 Left sidebar (owner requirement 9.1)

- **Accordion** listing ALL categories and their subcategories.
- The currently-selected subcategory is **highlighted/selected**, and its parent category is **expanded** by default on load.
- The sidebar has **its own search box** at the top that filters ONLY category and subcategory NAMES (not article content). Typing filters the accordion in real time. This is separate from the global search in the top bar.
- Clicking any subcategory navigates to that subcategory's page.
- Sticky on desktop (scrolls independently if long).

### 11.3 Right main area (owner requirement 9.2)

- Heading: the selected category > subcategory (breadcrumb + subcategory title).
- **Article list**, each item showing:
  - Article **name** (title), links to the article.
  - **Last updated date** (from `last_updated`).
  - **Reading time** (from `length_min`, e.g., "3 min read").
  - **Image** placeholder (images added later; reserve the space with a fixed-aspect placeholder so layout doesn't shift when images arrive).
- List is ordered by lesson ID ascending (or by last_updated descending; RECOMMENDED: by the planned order in taxonomy.json, falling back to ID ascending).

### 11.4 Empty states

- If a subcategory has no published articles yet: show a friendly "Lessons coming soon for this topic" message.

---

## 12. Page spec: Article page

URL: `/{category}/{subcategory}/{article-slug}`.

### 12.1 Structure (owner requirement 10)

- Top bar (same).
- **Centered layout**, with the **text column on the left taking most of the width** (`--width-article` ≈ 760px) and a **floating table-of-contents outline on the right** (`--width-toc`).
- On mobile / narrow viewports: TOC collapses to a top "Contents" expandable, or is hidden in favor of a small floating "jump to section" button. Text column goes full width.

### 12.2 Article header (owner requirement 10.2)

- Breadcrumb: Category > Subcategory.
- **Article title** (h1, `--text-3xl`).
- Metadata row: **last updated date**, **reading time**, format chip (e.g., a small "Scenario" tag).
- **Image** placeholder (reserve space, fixed aspect ratio, e.g., 16:9; real images added later).

### 12.3 TL;DR (owner requirement 10.4)

- Immediately below the header, before the body: a **TL;DR box**.
- Renders the `tldr` frontmatter array as a tight bulleted list (3-4 quick points).
- Visually distinct: amber-tinted background (`--color-accent-soft`), a "TL;DR" label, compact.
- This appears on EVERY article. If a lesson is missing `tldr`, show nothing (don't break) but log a build warning.

### 12.4 Article body (owner requirement 10.3)

- Rendered markdown: headings (h2/h3), subheadings, blockquotes, body paragraphs, lists.
- **Prefer quick lists / bullet points** in rendering style (owner preference). Style lists with comfortable spacing and clear bullets. (Note: the content itself controls list usage; the renderer just makes lists look clean and scannable.)
- Body constrained to `--measure` (68ch) for readability.
- Headings get anchor IDs (for TOC links).
- Blockquotes styled distinctly (left border in teal, slight indent).
- Comparison-format tables: responsive (horizontal scroll on mobile, or transform to stacked cards below ~520px).
- Links: teal, underlined on hover.
- `last_updated` and reading time can repeat at the bottom too (optional).

### 12.5 Floating Table of Contents (owner requirement 10.5)

- Right-side floating outline listing the article's section headings (h2, optionally h3).
- **Click a heading → smooth-scroll to that anchor** in the article.
- **Scroll-spy:** highlight the currently-visible section as the user scrolls ([island]: TableOfContents).
- Sticky position so it stays visible while scrolling the article.
- On mobile: collapses to a "Contents" dropdown at the top of the article, OR a small floating button that opens the outline.

### 12.6 Quiz (from quiz YAML block)

- If the lesson has a quiz block, render it after the body, before Sources/Related.
- For each question: show the question, the options as clickable choices. On selection, reveal the per-option feedback and the explanation. Do NOT show a score (the platform deliberately avoids test-like scoring).
- This is an [island] (LessonQuiz) since it needs interactivity. Keep it tiny.
- If no quiz block, render nothing.

### 12.7 Sources and Related

- **Sources:** render the `sources` frontmatter array as a footnote-style list at the bottom (title, publisher, year, linked URL). Label "Sources."
- **Related:** render `related` lesson IDs as links to those articles (resolve ID → slug/title). Label "Related lessons." Skip if empty or referencing unpublished lessons.

### 12.8 Reading experience details

- Comfortable line height (1.7), measure (68ch), generous paragraph spacing.
- No popups, no newsletter modals, no interstitials. Reading is sacred.
- Smooth scroll for anchor links.

---

## 13. Search spec

### 13.1 Global search (top bar, owner requirements 7.1-7.3)

- Powered by **Pagefind**, built at deploy time over all published articles.
- Indexes: category names, subcategory names, article **titles**, and full article **body text**.
- **Results show ONLY article names** (titles), each linking to the article. Per owner requirement 7.3. (Optionally show the category > subcategory as a small subtitle under each result for context, but the primary result text is the article name. Confirm with owner; default to title-only with a faint breadcrumb.)
- **Very fast:** Pagefind loads index fragments on demand; results appear as the user types (debounced ~150ms). No server round-trip.
- UI: opens as an overlay/modal from the top bar. Input at top, results list below. Keyboard accessible (arrow keys to navigate results, Enter to open, Esc to close). Works on mobile as a full-screen overlay.
- Empty state: "Search all lessons" prompt. No-results state: "No lessons found for '{query}'."

### 13.2 Sidebar search (category page, owner requirement 9.1)

- A SEPARATE, simpler search inside the left sidebar.
- Filters ONLY category and subcategory **names** (not article content).
- Pure client-side string filter over the taxonomy (no Pagefind needed; the taxonomy is small and already in the page).
- Real-time filtering of the accordion as the user types.

### 13.3 Search page

- A dedicated `/search?q=...` route that renders the same Pagefind results full-page (for shareable search URLs and as a no-JS fallback target). The overlay is the primary UX; this page is the fallback.

---

## 14. Performance budget and 2G strategy

Targets (measured on a simulated 2G / slow-3G connection, mid-range Android):

| Metric                                 | Target                                    |
| -------------------------------------- | ----------------------------------------- |
| First Contentful Paint (FCP)           | < 2.5s on slow 3G                         |
| Largest Contentful Paint (LCP)         | < 4s on slow 3G                           |
| Total JS shipped (homepage)            | < 30KB gzipped                            |
| Total JS shipped (article page)        | < 40KB gzipped (incl. TOC + quiz islands) |
| Total page weight (article, no images) | < 120KB gzipped                           |
| Lighthouse Performance                 | ≥ 95 (desktop), ≥ 90 (mobile)             |
| Lighthouse Accessibility               | ≥ 95                                      |

Strategies:

1. **Static HTML.** Every page pre-rendered at build time. No SSR, no client-side routing for content.
2. **Zero-JS by default.** Only ship JS for the 4 islands (theme toggle, search, sidebar accordion, TOC scroll-spy, quiz). Each island lazy-loads.
3. **Self-hosted, subsetted woff2 fonts.** Preload Regular weight. `font-display: swap`.
4. **Inline critical CSS** in `<head>`; defer the rest.
5. **Subsetted Material icons** as inline SVG, not a full icon font.
6. **Brotli compression** (Cloudflare handles automatically).
7. **Image strategy (for when images arrive):** lazy-load below-the-fold images, serve AVIF/WebP with fallback, use Astro's `<Image>` for automatic optimization, always set width/height to prevent layout shift. Reserve image space with placeholders now.
8. **Pagefind index** loads on demand (only when the user opens search), not on initial page load.
9. **HTTP/3 + CDN edge** via Cloudflare (India PoPs).
10. **No web fonts blocking render.** No render-blocking third-party scripts. No analytics that block.
11. **Prefetch on hover/visible** for likely next pages (Astro's built-in prefetch), but conservatively to respect data caps. RECOMMENDED: prefetch on viewport-visible for article links, not aggressive full-prefetch (respect 2G data).

---

## 15. Dark/light mode, i18n, accessibility, future-proofing

### 15.1 Dark/light mode

- Default to the user's system preference (`prefers-color-scheme`).
- User can toggle via the top bar theme toggle.
- Persist the choice in `localStorage`.
- Apply theme via `data-theme="light|dark"` on `<html>`, set by a tiny inline script in `<head>` BEFORE first paint (to avoid flash of wrong theme).
- All colors come from the CSS custom properties in 7.1.

### 15.2 Accessibility (WCAG 2.1 AA)

- Semantic HTML (nav, main, article, aside, headings in order).
- All interactive elements keyboard-accessible, visible focus states (`--color-focus`).
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI.
- Touch targets ≥ 44x44px on mobile.
- Search overlay, sidebar drawer, quiz: proper ARIA roles, focus trapping in modals, Esc to close.
- Respect `prefers-reduced-motion` (disable smooth-scroll and transitions for users who request it).
- Alt text on images (when added).
- Skip-to-content link.

### 15.3 Internationalization architecture (future, but build for it now)

- Even though launch is English-only, structure the routing and data layer to be locale-aware.
- Default locale `en` has no URL prefix; future locales get `/{locale}/...`.
- Lesson files carry their locale in the filename suffix (`.en.md`, `.hi.md`).
- UI strings (nav labels, "min read," "TL;DR," "Sources," "Related," search placeholders) go in a `i18n/{locale}.json` dictionary, NOT hardcoded. Create `i18n/en.json` now; future locales add their own.
- When a lesson exists in `en` but not the requested locale, fall back to `en` with a subtle "not yet translated" notice.
- Font loading is locale-aware (load Devanagari subset only on Hindi pages, etc.).

### 15.4 Future login / favorites / reading-lists hooks (NOT built now)

The owner plans to add (later): mark articles favorite, create reading lists. Build clean seams so this is additive, not a rewrite:

- Keep article identity stable via the `id` field (favorites will reference `id`).
- Reserve a slot in the article header and list item UI where a "favorite" (bookmark) icon button will later live (can be a hidden/disabled placeholder or simply a documented insertion point).
- Keep all rendering static; favorites/lists will be a client-side + (future) auth layer that reads article IDs. Do NOT build auth now. Just don't architect anything that would block it (e.g., avoid baking assumptions that there is never any per-user state).
- Document these insertion points in code comments.

---

## 16. Acceptance criteria (definition of done)

The launch build is done when ALL of these are true:

**Content & data**

- [ ] Reads categories/subcategories from `taxonomy.json` and articles from the content repo's Traffic + Public Transport lesson files.
- [ ] Only `status: published` articles render in the production build. (For the launch, treat the 6 launch lessons as published; see section 17.)
- [ ] Counts are correct: each category shows its subcategory count; each subcategory shows its article count.
- [ ] Empty/unpublished categories are hidden (or greyed per config).

**Top bar**

- [ ] Identical across all pages, sticky, with logo (top-left), global search, theme toggle.

**Homepage**

- [ ] Lists categories with subcategory counts.
- [ ] Clicking a category expands to show its subcategories with article counts.
- [ ] Subcategory rows link to the category page.
- [ ] Expand/collapse state persists in localStorage.

**Category page**

- [ ] Left sidebar accordion of all categories/subcategories, selected subcategory highlighted, parent expanded.
- [ ] Sidebar has its own name-only filter search.
- [ ] Right side lists articles with name, last-updated, reading time, image placeholder.
- [ ] Sidebar collapses to a drawer on mobile.

**Article page**

- [ ] Centered layout, wide text column left, floating TOC right.
- [ ] Header with title, last-updated, reading time, image placeholder, format chip.
- [ ] TL;DR box on every article.
- [ ] Body renders headings, subheadings, quotes, lists, paragraphs cleanly; quick lists look scannable.
- [ ] TOC is clickable, scroll-spy highlights current section, smooth-scrolls to anchors.
- [ ] Quiz renders and is interactive (where present), no score shown.
- [ ] Sources and Related render.
- [ ] On mobile, TOC collapses gracefully; text goes full width.

**Search**

- [ ] Global search indexes category/subcategory names, article titles, and full body text.
- [ ] Global search results show article names, fast, as-you-type.
- [ ] Sidebar search filters only category/subcategory names.

**Design & modes**

- [ ] Light and dark modes both work, toggle persists, no flash of wrong theme on load.
- [ ] Hind font self-hosted, subsetted, with swap fallback.
- [ ] Material Symbols (outlined), subsetted.
- [ ] Palette matches section 7.1 tokens.

**Performance & a11y**

- [ ] Lighthouse Performance ≥ 90 mobile, ≥ 95 desktop.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Usable on simulated 2G (content readable quickly).
- [ ] JS budgets in section 14 met.

**i18n & future**

- [ ] Routing is locale-aware (en default, no prefix).
- [ ] UI strings in `i18n/en.json`, not hardcoded.
- [ ] Future-favorites insertion points documented in code.

---

## 17. Content prerequisites (must exist before build)

### 17.1 The `tldr` field

The article page requires a TL;DR on every article (owner requirement 10.4). The lesson frontmatter schema is being extended with a `tldr` field:

```yaml
tldr:
  - 'First quick takeaway (one line)'
  - 'Second takeaway'
  - 'Third takeaway'
  - 'Optional fourth'
```

The 6 launch lessons (traffic-001, traffic-005, traffic-009, transit-001, transit-003, transit-013) have been given `tldr` fields as part of this work. All future lessons must include it (the lesson template and content README frontmatter contract have been updated).

If a lesson lacks `tldr`, the build should not crash; it should render no TL;DR box and log a warning.

### 17.2 The 6 launch lessons

These are the published articles for launch:

**Traffic** (`/traffic/...`):

- `traffic-001-the-case-against-honking.en.md` — subtopic: honking-discipline — format: scenario
- `traffic-005-yellow-is-not-go-faster.en.md` — subtopic: signal-rules — format: rule
- `traffic-009-the-zebra-crossing-is-not-optional.en.md` — subtopic: pedestrian-rights — format: scenario

**Public Transport** (`/public-transport-and-elevators/...`):

- `transit-001-let-people-exit-before-you-enter.en.md` — subtopic: metro-entry-and-exit — format: scenario
- `transit-003-stand-right-walk-left.en.md` — subtopic: escalator-rules — format: rule
- `transit-013-eating-on-the-metro.en.md` — subtopic: eating-on-transport — format: comparison

These 6 cover all 3 article formats (scenario, rule, comparison), so every article-page layout variant gets exercised.

### 17.3 Status note

The launch lessons currently carry `status: draft` in the content repo (they are Phase 1 samples). For the website launch, either (a) promote these 6 to `status: published`, or (b) configure the build to treat the 6 launch lesson IDs as publishable via an allowlist. RECOMMENDED: promote the 6 to published once they pass a final editorial read, using the workflow's quality-scoring gate.

### 17.4 Category icons

`taxonomy.json` has an `icon` field per cluster (e.g., traffic → "traffic-cone", public-transport → "train"). Map these to Material Symbols names. If a name doesn't map cleanly, pick the closest Material Symbol and document the mapping.

---

## 18. Build, deploy, and project structure

### 18.1 Recommended project structure

```
learncivicsense-website/
├── WEBSITE-BUILD-SPEC.md         this file
├── astro.config.mjs
├── package.json
├── public/
│   ├── fonts/                    self-hosted Hind woff2 (subsetted)
│   └── icons/                    SVG sprite of Material Symbols used
├── src/
│   ├── content/
│   │   └── config.ts             Astro content collection config pointing at ../learncivicsense-content
│   ├── components/               (see section 8)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro           homepage
│   │   ├── [category]/
│   │   │   ├── index.astro       category landing
│   │   │   └── [subcategory]/
│   │   │       ├── index.astro   category/subcategory page
│   │   │       └── [article].astro  article page
│   │   ├── search.astro
│   │   └── about.astro
│   ├── styles/
│   │   ├── tokens.css            the design tokens from section 7
│   │   └── global.css
│   ├── lib/
│   │   ├── content.ts            parse taxonomy.json + lessons, compute counts
│   │   ├── reading-time.ts       (use length_min; fallback compute)
│   │   └── i18n.ts
│   └── i18n/
│       └── en.json               UI strings
└── ...
```

### 18.2 Connecting to the content repo

Two options:

- **Option A (recommended for now):** Astro content collection reads from the sibling `../learncivicsense-content/` folder directly at build time. Simple for local dev.
- **Option B (for CI):** content repo as a git submodule or a build-time fetch. Use this when wiring Cloudflare Pages CI so the build has access to content.

Document whichever is chosen. A content-repo push should trigger a website rebuild (webhook).

### 18.3 Build commands

```bash
npm install
npm run dev          # local dev server
npm run build        # static build to ./dist (runs Astro build + Pagefind index)
npm run preview      # preview the production build locally
```

Pagefind runs as a post-build step over `./dist` to generate the search index.

### 18.4 Deploy

- Cloudflare Pages, connected to the website git repo.
- Build command: `npm run build`. Output dir: `dist`.
- Set up a deploy hook so the content repo's main-branch updates trigger a website rebuild.

---

## Appendix A: Quick decisions log (rationale for the owner)

- **Astro over Next.js:** zero-JS default, fastest for 2G.
- **Pagefind over Elasticsearch/Algolia:** static, no server, free, faster for ~200 articles, no infra.
- **Hind font:** Indian foundry, covers 7/8 languages, on-brand, light.
- **Teal + amber palette:** civic, calm, trustworthy, deliberately apolitical (no saffron/green).
- **Cloudflare Pages:** best India edge latency, free, HTTP/3 + Brotli.
- **No login at launch:** per owner. Hooks reserved for future favorites/reading-lists.
- **2 launch modules:** Traffic + Public Transport, chosen because together they cover all 3 article formats.

## Appendix B: What is explicitly NOT in this build

- User accounts / login (future)
- Favorites / reading lists (future, hooks reserved)
- Comments / discussion
- Learning paths (data exists, not rendered at launch)
- Civic action toolkit widgets (spec exists in content repo, not built at launch)
- The other 9 categories and the abroad packs (architecture supports them; content not yet published)
- Non-English locales (architecture supports; content not yet written)
- Real images (placeholders reserved; images added later)
- Newsletter, notifications, any growth/marketing surfaces
