# `src/islands/`

Preact components that hydrate on the client. **Keep this list short.**

Astro's whole point is that most pages ship zero JS. An island is a
deliberate exception. Before adding one, ask:

1. Can this be done with a native `<details>`, `<summary>`, or `<form>`?
2. Can this be done with a few lines of inline vanilla JS in an `is:inline`
   script?
3. Does the interactivity actually need component state?

If you said "no" to all three, you have an island.

## Inventory (5 islands, ~14 KB gzipped total)

| File                  | Hydration                       | What it does                                                                                          |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ThemeToggle.tsx`     | `client:idle` (TopBar)          | sun/moon button; reads + writes `lcs-theme` in localStorage; sets `data-theme` on `<html>`            |
| `SearchOverlay.tsx`   | `client:idle` (TopBar)          | full-screen modal; loads Pagefind on demand; debounced query; keyboard nav; coming-soon chip flagging |
| `TableOfContents.tsx` | `client:visible` (article page) | sticky right-rail list of h2/h3; IntersectionObserver scroll-spy; smooth-scrolls to anchors           |
| `LessonQuiz.tsx`      | `client:visible` (article page) | inline quiz; per-option feedback + explanation reveal; no score (deliberate)                          |

(`CategoryAccordion.tsx` was prototyped early but removed — native `<details>`

- a tiny inline localStorage script does the job with zero JS shipped on the
  homepage. See git history.)

## Conventions

- `.tsx` with Preact, **not** React.
- File name = single default export (the component).
- Strict typing on props; use `interface Props` not loose objects.
- Side effects (event listeners, observers) belong in `useEffect` with
  cleanup. Don't leak listeners on unmount.
- Listen to global events (e.g. `window.dispatchEvent('lcs:open-search')`)
  to talk between islands without a global state layer.

## Size budget

The aggregate of `dist/_astro/*.js` is budgeted at **40 KB gzipped** in
`.size-limit.json`. Currently 14.67 KB. New islands eat into the headroom —
make sure new functionality is worth the bytes.

## How to add one

1. Write the `.tsx` file here.
2. Import in the page or component that mounts it.
3. Add `client:idle` or `client:visible` directive (prefer `:visible` —
   it defers until the island scrolls into view).
4. Add a smoke test in `tests/e2e/smoke.spec.ts` for the user-visible
   behavior.
5. Run `npm run size` to confirm you're still under budget.
