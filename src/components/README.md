# `src/components/`

Server-rendered Astro components. These ship as HTML and never hydrate.

If a thing needs interactivity (state, event listeners that survive past
first paint), it belongs in `src/islands/` instead.

## Inventory

| File                    | Used by                              | What it renders                                          |
| ----------------------- | ------------------------------------ | -------------------------------------------------------- |
| `ArticleHeader.astro`   | article page                         | h1 + format chip + metadata row + image placeholder      |
| `ArticleListItem.astro` | subcategory page                     | list-row card per article (real or coming-soon)          |
| `Breadcrumb.astro`      | category, subcategory, article pages | `<nav>` with chevron-separated crumbs                    |
| `CategoryCard.astro`    | homepage, category landing           | accordion card per India cluster / abroad pack           |
| `ComingSoonBody.astro`  | article page (placeholder variant)   | calm amber card with phase line + back link              |
| `Footer.astro`          | every page                           | minimal footer with About/Search/Privacy/Terms links     |
| `Icon.astro`            | everywhere                           | inline SVG sprite (Material-Symbols-style outline icons) |
| `RelatedLinks.astro`    | article page                         | "Related lessons" list (resolved by ID via taxonomy)     |
| `SidebarNav.astro`      | category, subcategory pages          | left-rail accordion + name-only filter                   |
| `SourcesList.astro`     | article page                         | numbered citations from frontmatter `sources:`           |
| `TldrBox.astro`         | article page                         | amber-tinted "TL;DR" callout                             |
| `TopBar.astro`          | every page (via BaseLayout)          | sticky header with logo + search trigger + theme toggle  |
| `VisitorsCard.astro`    | homepage                             | Phase-4 card pointing to `/visitors`                     |

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
