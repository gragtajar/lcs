# `src/components/`

Server-rendered Astro components. These ship as HTML and never hydrate.

If a thing needs interactivity (state, event listeners that survive past
first paint), it belongs in `src/islands/` instead.

## Inventory

| File                    | Used by                            | What it renders                                              |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `ArticleHeader.astro`   | article page                       | h1 + format chip + metadata row + image placeholder          |
| `ArticleListItem.astro` | topic page                         | list-row card per article (real or coming-soon)              |
| `Breadcrumb.astro`      | topic, topics, article, info pages | `<nav>` with chevron-separated crumbs                        |
| `ComingSoonBody.astro`  | article page (placeholder variant) | status line + the topic's nearest lesson + its topic         |
| `Footer.astro`          | every page                         | footer with About, Feedback, Privacy and Terms links         |
| `BrandIcon.astro`       | ShareBar                           | share platforms' own marks (Simple Icons, Bootstrap)         |
| `Icon.astro`            | everywhere                         | one Lucide icon as inline SVG, by name (ADR 009)             |
| `InfoSection.astro`     | About, Privacy, Terms              | one side-heading section of `src/layouts/InfoLayout.astro`   |
| `Logo.astro`            | TopBar, Footer                     | the logo mark inline (`src/assets/logo.svg`), theme-coloured |
| `RelatedLinks.astro`    | article page                       | the one "Up next" card (resolved by ID via taxonomy)         |
| `SidebarNav.astro`      | topic pages                        | the 14 topics, this one current, + name-only filter          |
| `LessonIndex.astro`     | topics page                        | one-line rows of a topic's lessons: time or Coming soon      |
| `TopicIndex.astro`      | homepage, search page, 404 page    | the 14 topics with readable counts, grouped India/abroad     |
| `SourcesList.astro`     | article page                       | numbered citations from frontmatter `sources:`               |
| `TldrBox.astro`         | article page                       | amber-tinted "TL;DR" callout                                 |
| `TopBar.astro`          | every page (via BaseLayout)        | sticky header: logo, search trigger, language + theme menus  |

## Conventions

- File name = component name = the only export. PascalCase `.astro`.
- Props go through a typed `interface Props`.
- Use design tokens (`var(--color-*)`, `var(--space-*)`) — never raw values.
- Component-scoped CSS uses Astro's `<style>` block; cross-component styles
  go in `src/styles/`.
- a11y: prefer native semantics. Don't slap `role="list"` on a `<ul>`
  (jsx-a11y will yell). Reach for ARIA only when no native element fits.

## When to add a new component here

- It renders something. (No, "I just need a helper" → that's `src/lib/`.)
- It's reusable across at least two pages, OR it isolates a meaningful
  chunk of the page that's worth naming.

## When NOT to add here

- The thing needs `useState` or event listeners → `src/islands/`.
- The thing is one paragraph used in one place → inline it.
