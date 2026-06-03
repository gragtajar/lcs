# ADR 005: Teal + amber design token palette

**Status:** Accepted
**Date:** 2026-05-25
**Authors:** Rajat Garg

## Context

We need a color palette that:

1. Is **deliberately apolitical** for an India-focused civic platform —
   no saffron, no green that reads as a party identity, no obvious flag
   reference.
2. Reads as **civic, calm, trustworthy** rather than playful, edgy, or
   corporate.
3. Hits **WCAG AA contrast** (4.5:1 body, 3:1 UI) in both light and dark modes.
4. Stays **legible on cheap Android screens** (warm tones, not pure black,
   subtle backgrounds over harsh white).
5. Has enough hue separation between primary and accent that chips, badges,
   and category icons all sit comfortably.

## Decision

Use a **deep teal primary + warm burnt-amber accent** palette over a
**warm paper / warm charcoal background**, codified as CSS custom properties
in `src/styles/tokens.css`.

```
Primary:     #0E6E62  (deep teal — links, primary actions)
Accent:      #B5641E  (burnt amber — TL;DR badge, coming-soon chip)
Background:  #FAF8F3  (warm paper — easy on eyes)
Surface:     #FFFFFF  (card backgrounds, article body)
Text:        #1B1A17  (near-black warm ink, ~15:1 on bg)
```

Dark theme mirrors with brighter teal (#46B8A8) and amber (#E0A35C) over
a warm charcoal (#15181A). Toggle persisted in `localStorage`; respects
`prefers-color-scheme` on first visit.

All color, spacing, and type values live in `src/styles/tokens.css`. No
component declares raw hex colors.

## Alternatives considered

- **Saffron-and-green Indian-flag-coded palette:** Politically loaded for
  a civic education site. Rejected on first principles.
- **Pure black / pure white (high contrast monochrome):** Excellent for
  accessibility but reads as corporate / sterile, and a pure-white background
  is hard on eyes during long reading. Rejected.
- **Single-hue palette (e.g. all teal):** Loses the visual hierarchy
  between primary and accent. Format chips (Scenario / Rule / Comparison)
  need at least two distinguishable tints.
- **Material Design defaults:** Default blue + orange works but reads as
  Google / commercial. Doesn't fit the platform voice.

## Consequences

- Every visual choice references `var(--color-*)` or `var(--space-*)`. Stylelint
  enforces lowercase-kebab names; the pattern check is currently disabled due
  to a regex/stylelint interaction (Phase 2 follow-up).
- Designers iterating on theme only edit `tokens.css`; the whole site picks
  up the change.
- The deliberate apolitical choice ages well — the palette doesn't tie us
  to any election cycle or party identity.
- Future light/dark experiments (sepia, high-contrast) can be added as
  additional `[data-theme="..."]` selectors without touching components.

## References

- `WEBSITE-BUILD-SPEC.md` §7 (full design system)
- `src/styles/tokens.css` (the actual values)
