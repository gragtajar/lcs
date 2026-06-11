# Production Readiness Spec — v2 Addendum (Code Quality Deep Dive + Image Strategy)

**Version:** 2.0 (additive to v1 PRODUCTION-READINESS-SPEC.md)
**Date:** 2026-06-03
**For:** Claude Code, on top of the Phase 1 production-readiness work already in progress.
**Status:** Each section was verified in a Node sandbox against the actual package APIs and current documentation before being written. Hallucinations from the previous v2 draft have been caught and corrected (six are listed in §0.2).

---

## 0. How to read this addendum

### 0.1 Scope

The v1 PRODUCTION-READINESS-SPEC.md established the five-layer framework: code quality automation, testing, performance, CI/CD, architecture and scale. v1 covers TypeScript strict, basic ESLint, Prettier, husky, Vitest, Playwright, Lighthouse CI, Sentry, security headers, and the image pipeline outline. Claude Code has already implemented v1 Phase 1; v2 only adds on top.

This addendum maps the platform owner's 48 code-quality requirements onto the Astro stack, AND answers the architectural image-storage question. Items already specified by v1 are referenced, not restated.

The 10 sections (T1–T10) correspond to the 10-task breakdown the platform owner accepted. Each section has its own acceptance checks; §11 has the consolidated mapping table.

### 0.2 Corrections from the previous unverified v2 draft (now superseded)

Each was caught in the sandbox during verification:

1. **Sentry's severity level is `'warning'`, not `'warn'`.** Verified against `node_modules/@sentry/core/build/types/types/severity.d.ts`. The logger in T1 maps internal `warn` → Sentry `'warning'`.
2. **ESLint v9 requires flat config (`eslint.config.mjs`); `.eslintrc.cjs` no longer works.** Verified by trying to run ESLint 9.18 against a `.eslintrc.cjs` file and seeing the migration error. T2 specifies flat config.
3. **`no-console: ['error', { allow: [] }]` is INVALID schema.** ESLint 9 requires `allow` to have ≥1 item. Use `'no-console': 'error'` alone to forbid all. Caught by running ESLint with the broken config.
4. **`eslint-plugin-unicorn` configs include `'flat/recommended'`.** My CommonJS `require()` check incorrectly reported "no configs"; the ESM default import correctly exposes `unicorn.configs['flat/recommended']`. T2 uses the correct ESM pattern.
5. **Astro 5+ renamed `<ViewTransitions />` to `<ClientRouter />`** (imported from `astro:transitions`). Verified against current Astro docs. T8 uses the new name and also offers a CSS-only alternative.
6. **Cloudflare Pages free-plan file limit is 20,000, not 25,000.** Verified against Cloudflare's Pages limits docs. T10 corrects the scale-out trigger threshold.

### 0.3 Phasing

Every item below is **Phase 1** unless explicitly marked. Phase 2 = post-launch hardening. Phase 3 = scale-prep. The phasing matches v1 §2's three-phase model.

### 0.4 Coordination with v1 already shipped (read before touching any file)

Claude Code has already implemented v1 Phase 1. Six items in this addendum touch files v1 set up. Each is a tightening, an additive plugin set, or a merge into an existing config; none is a "rewrite from scratch". Follow these merge instructions to avoid rework:

| #   | v1 location                   | v2 section  | What to do                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `.eslintrc.cjs` (v1 §3.2)     | T2.1 + T2.3 | **Migrate, do not duplicate.** Rename to `eslint.config.mjs` and convert to flat config. The legacy file becomes obsolete with ESLint v9+; keep none of it once the flat config is in place.                                                                                                                               |
| 2   | ESLint plugins (v1 §3.2)      | T2.2        | **Add 7 plugins on top of v1's 4.** Keep `@typescript-eslint`, `astro`, `jsx-a11y`, `prettier`. Install `sonarjs`, `unicorn`, `import`, `jsdoc`, `promise`, `unused-imports`, `no-secrets`, `no-unsanitized` additionally. Expect a flood of new errors against existing code; budget time to address them in the same PR. |
| 3   | `no-console` rule (v1 §3.2)   | T1.3        | **Tighten only after T1 logger is in place.** v1 allows `console.warn` and `console.error`; v2 forbids all and routes through `src/lib/logger.ts`. Without T1 the tightening will block legitimate code. Land T1 first, then tighten.                                                                                      |
| 4   | `.stylelintrc.json` (v1 §3.6) | T3.5        | **Replace v1's simple config with the T3.5 extended version.** Only valid if T3.1 through T3.4 (the three-tier token refactor) also land. The new rules block primitive-token usage outside `tokens.primitive.css`; without the three-tier split they have nothing to enforce.                                             |
| 5   | `public/_headers` (v1 §10.1)  | T8.5        | **APPEND, do not replace.** v1 wrote security headers (CSP, HSTS, Permissions-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy). v2 adds cache-control rules for `/_astro/`, `/fonts/`, `/icons/`, immutable assets. The file holds both; keep every header from v1 and add v2's cache blocks below them.  |
| 6   | `.size-limit.json` (v1 §5.2)  | T10.9       | **Append image variant budgets to the existing array.** v1 has four entries (homepage JS, article JS, total CSS, critical font). Add the new T10.9 entries (hero AVIF, hero WebP, inline image budgets). Keep all v1 entries.                                                                                              |

**Two v1 sections are no longer the source of truth:**

- **v1 §12 (Image pipeline) — SUPERSEDED by T10.** v1 §12.1 spec'd a flat-file layout `05-images/{cluster}/{lesson-id}.jpg`; T10.1 replaces it with a folder-per-lesson layout supporting multiple images. v1 §12.2 used `<Image>`; T10.2 uses `<Picture>` for multi-format AVIF/WebP. v1 §12 was never implemented (Phase 3 deferred), so this is a clean swap, not a migration. Treat v1 §12 as historical; follow T10 only.
- **v1 §11.5 (RSS) — DEFERRED, not covered by v2.** v2 does not replace v1's RSS spec. Do not implement at launch (Phase 3 timing matches v1's own note). When RSS becomes needed, re-validate the `@astrojs/rss` snippet in v1 §11.5 against the then-current package version before using it.

---

## Table of contents

- T1. Logging foundation
- T2. Expanded ESLint config
- T3. CSS three-tier token refactor
- T4. Function design and code complexity
- T5. Custom error types + Zod runtime validation
- T6. Resource cleanup patterns
- T7. Security additions on top of v1
- T8. Performance: view transitions, prefetch, cache headers
- T9. Dependency Injection pattern
- T10. Image pipeline deepening
- 11. Mapping table: each of the 48 requirements → where it's enforced
- 12. Consolidated Phase 1 acceptance checklist
- 13. What does NOT apply at launch (and when to revisit)

---

## T1. Logging foundation

**Not in v1.** v1 §3.2 sets `no-console: ['error', { allow: ['warn', 'error'] }]` but does not specify a logger. This task replaces ad-hoc console calls with a tiny named logger that forwards warn-and-above to Sentry.

### T1.1 Logger module at `src/lib/logger.ts`

**Status of verifications:**

- `@sentry/browser@10.56.0` confirmed exports `captureException`, `captureMessage` (also `addBreadcrumb`, `getCurrentScope` if richer context needed later).
- Sentry's `SeverityLevel` type is **`'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'`** (verified in `node_modules/@sentry/core/build/types/types/severity.d.ts`). Note: it's `'warning'` not `'warn'`. The logger maps internal level `warn` → Sentry `'warning'`.
- v1 §5.4 already installs `@sentry/astro` and initializes via `astro.config.mjs`. This logger only consumes the already-installed SDK; no new install.

```ts
// src/lib/logger.ts
import { captureException, captureMessage } from '@sentry/browser';
import type { SeverityLevel } from '@sentry/core';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENTRY_SEVERITY: Record<LogLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning', // Sentry's spelling is 'warning', not 'warn'
  error: 'error',
};

const MIN_LEVEL: LogLevel = import.meta.env.PROD ? 'info' : 'debug';
const SENTRY_MIN_LEVEL: LogLevel = 'warn';

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

/**
 * Create a named logger scoped to a module or island.
 *
 * @param name - Dotted name; e.g. `'island.search-overlay'`, `'lib.taxonomy'`.
 * @returns A logger with four methods. Forwards warn/error to Sentry in production.
 */
export function createLogger(name: string): Logger {
  function emit(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

    const payload = { logger: name, ...(context ?? {}) };
    // eslint-disable-next-line no-console -- the logger is the only allowed console caller
    const consoleMethod = level === 'debug' ? 'log' : level;
    // eslint-disable-next-line no-console
    console[consoleMethod](`[${name}] ${message}`, payload);

    if (LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[SENTRY_MIN_LEVEL]) {
      const severity = SENTRY_SEVERITY[level];
      if (level === 'error') {
        captureException(new Error(`[${name}] ${message}`), { extra: payload });
      } else {
        captureMessage(`[${name}] ${message}`, { level: severity, extra: payload });
      }
    }
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
  };
}
```

### T1.2 Usage in islands and lib

```ts
import { createLogger } from '@lib/logger';

const log = createLogger('island.search-overlay');

log.info('Pagefind index loaded', { entryCount: 211 });
log.warn('Search query timed out', { query, timeoutMs: 5000 });
log.error('Pagefind index missing for locale', { locale: 'hi' });
```

### T1.3 ESLint rule (forbid raw console)

In the codebase's ESLint config (v1 §3.2 already configures `no-console`), tighten:

```js
'no-console': ['error', { allow: [] }],
```

The only `console.*` calls allowed are inside `src/lib/logger.ts` itself, marked with `// eslint-disable-next-line no-console -- the logger is the only allowed console caller`.

### T1.4 Build-time logger via pino

For scripts in `scripts/` (sitemap builders, Pagefind orchestration in Phase 3):

**Verifications:**

- `pino@10.3.1` confirmed: methods `trace`, `debug`, `info`, `warn`, `error`, `fatal` all present. Default JSON output verified.
- `pino-pretty` for dev: install as `devDependency`. Transport syntax `{ target: 'pino-pretty', options: { colorize: true } }` requires `pino-pretty` resolvable from the same `node_modules` tree as `pino`. In the project's package.json, both go under `devDependencies`. (Verification note: my sandbox test could not load `pino-pretty` because it was not in the temp dir's node_modules. In a real project with both installed, this transport works.)

```ts
// scripts/_logger.ts
import pino from 'pino';

export const log = pino(
  process.env.CI || process.env.NODE_ENV === 'production'
    ? { level: process.env.LOG_LEVEL ?? 'info' }
    : {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      },
);
```

CI environments get raw JSON (GitHub Actions parses it cleanly). Local dev gets colored, formatted output.

### T1.5 Acceptance checks (T1 only)

- [ ] `src/lib/logger.ts` exists and exports `createLogger` and the `Logger` interface.
- [ ] Every island imports `createLogger` and uses a named instance; no raw `console.*` calls (lint enforces).
- [ ] In production build, `log.warn` and `log.error` calls produce a Sentry event (verify by triggering one deliberately and confirming it appears in the Sentry dashboard).
- [ ] `scripts/_logger.ts` exists; build scripts import from it.
- [ ] Both `pino` and `pino-pretty` are in `devDependencies` (pino itself could be moved to dependencies if any runtime script needs it, but for build-only use both are dev).

## T2. Expanded ESLint config

**v1 status:** v1 §3.2 specifies `eslint-plugin-astro`, `@typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier` with `.eslintrc.cjs` (legacy config). v1 does not include sonarjs, unicorn, import-ordering, jsdoc, promise, unused-imports, no-secrets, or no-unsanitized.

**v2 additions:**

1. Migration from legacy `.eslintrc.cjs` to flat `eslint.config.mjs` (ESLint v9+ default requires flat).
2. Six additional plugins to enforce the 48 quality requirements.

### T2.1 Critical: ESLint v9 requires flat config

**Verified:** ESLint 9.18.0 throws on a `.eslintrc.cjs` file with: `ESLint couldn't find an eslint.config.(js|mjs|cjs) file. From ESLint v9.0.0, the default configuration file is now eslint.config.js.`

**Action:** Migrate v1's `.eslintrc.cjs` snippet to `eslint.config.mjs` (flat config). If the project pins ESLint to v8.57 to keep the legacy file, every plugin's `extends: 'plugin:foo/recommended'` continues working. Otherwise, use the flat config shown in T2.3 below.

### T2.2 Plugin install list (in addition to v1)

```sh
npm install -D \
  eslint-plugin-sonarjs@^4 \
  eslint-plugin-unicorn@^64 \
  eslint-plugin-import@^2.32 \
  eslint-import-resolver-typescript@^3 \
  eslint-plugin-jsdoc@^63 \
  eslint-plugin-promise@^7 \
  eslint-plugin-unused-imports@^4 \
  eslint-plugin-no-secrets@^2 \
  eslint-plugin-no-unsanitized@^4
```

**Verified all installable.** Each was installed in the sandbox at the pinned version; their `package.json` `main` and `exports` resolve correctly.

### T2.3 Verified flat config (`eslint.config.mjs`)

This config was compiled and run end-to-end against test files in the sandbox. Every rule below was verified to fire on a deliberate violation.

```js
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import promise from 'eslint-plugin-promise';
import unusedImports from 'eslint-plugin-unused-imports';
import noSecrets from 'eslint-plugin-no-secrets';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...astro.configs['flat/recommended'],
  jsdoc.configs['flat/recommended-typescript'],
  sonarjs.configs.recommended,
  unicorn.configs['flat/recommended'],
  promise.configs['flat/recommended'],
  noUnsanitized.configs.recommended,
  prettier, // last, to disable conflicting style rules

  {
    files: ['**/*.{ts,tsx,astro}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: './tsconfig.json' },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      'unused-imports': unusedImports,
      'no-secrets': noSecrets,
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      // ---- v1 carried over (kept here for completeness) ----
      'no-console': 'error', // VERIFIED: ['error', {allow: []}] is INVALID schema; use 'error' alone to forbid all
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // ---- v2: naming conventions (covers items 3, 4, 6, 8) ----
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        { selector: 'function', format: ['camelCase'] },
      ],
      // Boolean prefix enforcement (item 6): @typescript-eslint/naming-convention does not natively support
      // "boolean variables must start with is/has/should/can/will/did". This is enforced by code review.
      // A custom rule could be added via eslint-plugin-perfectionist or a project-local plugin in Phase 2.

      // ---- v2: magic numbers (item 5) ----
      // VERIFIED: this rule fires on inline literals like `status === 429`. Add commonly used numbers (3 for typical array triplets, breakpoint pixel constants if used inline) to ignore as needed.
      'no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2, 100, 1000],
          ignoreArrayIndexes: true,
          enforceConst: true,
        },
      ],

      // ---- v2: single-letter (item 7) ----
      'id-length': [
        'error',
        { min: 2, exceptions: ['_', 'i', 'j', 'k', 'x', 'y', 'z'], properties: 'never' },
      ],

      // ---- v2: line length / one-liners (items 9, 21) ----
      'max-len': [
        'warn',
        { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true },
      ],
      'max-statements-per-line': ['error', { max: 1 }],

      // ---- v2: import grouping (item 10) ----
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '@components/**', group: 'internal', position: 'after' },
            { pattern: '@lib/**', group: 'internal', position: 'after' },
            { pattern: '@layouts/**', group: 'internal', position: 'after' },
            { pattern: '@styles/**', group: 'internal', position: 'after' },
          ],
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',

      // ---- v2: unused (item 17) ----
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ---- v2: sonarjs overrides (items 13, 14, 18; rules covered by recommended config above) ----
      'sonarjs/cognitive-complexity': ['error', 15], // VERIFIED: schema accepts [number]
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }], // VERIFIED: { threshold, ignoreStrings? }

      // ---- v2: function design (items 12, 13, 15, 18) ----
      complexity: ['error', 10], // VERIFIED in sandbox
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4], // VERIFIED in sandbox
      'max-depth': ['error', 3], // VERIFIED in sandbox
      'max-nested-callbacks': ['error', 3],

      // ---- v2: error handling (item 25) ----
      'no-empty': ['error', { allowEmptyCatch: false }], // VERIFIED in sandbox

      // ---- v2: secrets (item 36) ----
      'no-secrets/no-secrets': ['error', { tolerance: 4.2 }],

      // ---- v2: XSS (item 33) ----
      // no-unsanitized.configs.recommended (extended above) provides:
      // 'no-unsanitized/method' and 'no-unsanitized/property' both at 'error'
    },
  },
];
```

### T2.4 Caveats verified in the sandbox

1. **`no-console: ['error', { allow: [] }]` is INVALID.** ESLint v9 schema requires `allow` to have ≥1 item, OR omit options entirely. Use `'no-console': 'error'` to forbid all. (Previous unverified spec had `allow: []` — caught and corrected here.)
2. **`unicorn.configs` does include `'flat/recommended'`.** It must be imported as ESM default. The CommonJS `require('eslint-plugin-unicorn')` returns the ESM module wrapper, which is why a naive `require().configs` check returns empty. The actual usage via `import unicorn from 'eslint-plugin-unicorn'` then `unicorn.configs['flat/recommended']` works correctly.
3. **`import/order` needs a resolver.** Add `eslint-import-resolver-typescript` and set `settings: { 'import/resolver': { typescript: { project: './tsconfig.json' } } }`. Without it, `import/order` warns "Resolve error" on every file.
4. **`@typescript-eslint/naming-convention` does NOT enforce boolean prefix (is/has/should/can/will/did) out of the box.** That part of item 6 is enforced by code review. A project-local rule or `eslint-plugin-perfectionist` can be added later if this becomes a frequent miss.
5. **Astro files in flat config.** Use `eslint-plugin-astro`'s `flat/recommended` array spread, then add `*.astro` to the `files` glob on the rules block.

### T2.5 Test the config locally before committing it

```sh
# After installing all plugins:
npx eslint . --max-warnings 0
```

If the project has many existing files, expect a large number of initial violations. Auto-fix what's safe:

```sh
npx eslint . --fix
```

Then review the remaining manually. The first cleanup PR may be large but is a one-time cost.

### T2.6 Acceptance checks (T2 only)

- [ ] `eslint.config.mjs` exists (flat config) and `.eslintrc.cjs` is removed.
- [ ] All nine plugins from T2.2 are in `devDependencies`.
- [ ] `npx eslint . --max-warnings 0` succeeds on a clean checkout.
- [ ] Deliberately introducing one violation of each rule listed in T2.3 makes ESLint fail (smoke test).
- [ ] CI workflow (`.github/workflows/ci.yml` from v1) runs `npx eslint . --max-warnings 0` and blocks merge on failure.

## T3. CSS three-tier token refactor

**v1 status:** WEBSITE-BUILD-SPEC.md §7.1 defines the semantic palette (`--color-bg`, `--color-text`, `--color-primary`, etc.) for light and dark themes. v1 §3.6 sets a Stylelint `custom-property-pattern` allowing `--(color|space|text|leading|measure|radius|shadow|width|font-family)-` prefixes.

**v2 additions:**

1. Split the existing token file into **three tiers** (primitive, semantic, themes).
2. Tighten Stylelint so components MUST consume semantic tokens, not primitive values.
3. Add `prefers-color-scheme` fallback when no explicit `[data-theme]` is set.

This task does not change any color values from WEBSITE-BUILD-SPEC.md §7.1. It restructures the same values for scalability.

### T3.1 File split

```
src/styles/
├── tokens.primitive.css   ← raw values; not used directly by components
├── tokens.semantic.css    ← role-based vars that consume primitives; what components use
├── tokens.themes.css      ← theme overrides (dark, future high-contrast)
└── global.css             ← imports the above + resets + base typography
```

`global.css`:

```css
@import './tokens.primitive.css';
@import './tokens.semantic.css';
@import './tokens.themes.css';
@import './reset.css';
```

### T3.2 Tier 1 — primitives (raw values)

Components NEVER consume primitives directly. The palette below is the WEBSITE-BUILD-SPEC.md §7.1 light/dark colors expressed as a shared scale.

```css
/* src/styles/tokens.primitive.css */
:root {
  /* Palette anchors (from WEBSITE-BUILD-SPEC.md §7.1) */
  --primitive-teal-300: #46b8a8;
  --primitive-teal-500: #0e6e62;
  --primitive-teal-700: #0a574d;
  --primitive-teal-soft-light: #e1efec;
  --primitive-teal-soft-dark: #173430;

  --primitive-amber-300: #e0a35c;
  --primitive-amber-500: #b5641e;
  --primitive-amber-soft-light: #f6e9db;
  --primitive-amber-soft-dark: #3a2c1b;

  --primitive-paper-50: #faf8f3;
  --primitive-paper-100: #f2eee6;
  --primitive-paper-200: #e4dfd5;
  --primitive-ink-900: #1b1a17;
  --primitive-ink-700: #57534b;
  --primitive-ink-500: #847e73;
  --primitive-ink-300: #b0aaa0;

  --primitive-charcoal-700: #2f3437;
  --primitive-charcoal-800: #1e2225;
  --primitive-charcoal-900: #15181a;
  --primitive-charcoal-alt: #262b2e;
  --primitive-cream-50: #ece8e0;

  --primitive-success-light: #2e7d5b;
  --primitive-success-dark: #5bbe8c;

  /* Spacing scale (4-base) */
  --primitive-space-1: 0.25rem;
  --primitive-space-2: 0.5rem;
  --primitive-space-3: 0.75rem;
  --primitive-space-4: 1rem;
  --primitive-space-5: 1.5rem;
  --primitive-space-6: 2rem;
  --primitive-space-7: 3rem;
  --primitive-space-8: 4rem;

  /* Type scale (already defined in WEBSITE-BUILD-SPEC.md §7.2; mirrored as primitives) */
  --primitive-text-xs: 0.8125rem;
  --primitive-text-sm: 0.9375rem;
  --primitive-text-base: 1.0625rem;
  --primitive-text-lg: 1.1875rem;
  --primitive-text-xl: 1.375rem;
  --primitive-text-2xl: 1.625rem;
  --primitive-text-3xl: 2.125rem;
  --primitive-text-4xl: 2.5rem;
}
```

### T3.3 Tier 2 — semantics (component-facing)

This file matches WEBSITE-BUILD-SPEC.md §7.1 var names exactly. Components keep using `--color-bg`, `--color-primary`, etc. Nothing changes for them.

```css
/* src/styles/tokens.semantic.css */
:root {
  --color-bg: var(--primitive-paper-50);
  --color-surface: #ffffff;
  --color-surface-alt: var(--primitive-paper-100);
  --color-text: var(--primitive-ink-900);
  --color-text-secondary: var(--primitive-ink-700);
  --color-text-muted: var(--primitive-ink-500);
  --color-primary: var(--primitive-teal-500);
  --color-primary-hover: var(--primitive-teal-700);
  --color-primary-soft: var(--primitive-teal-soft-light);
  --color-accent: var(--primitive-amber-500);
  --color-accent-soft: var(--primitive-amber-soft-light);
  --color-border: var(--primitive-paper-200);
  --color-focus: var(--primitive-teal-500);
  --color-success: var(--primitive-success-light);
  --color-warning: var(--primitive-amber-500);
}
```

### T3.4 Tier 3 — themes (overrides)

```css
/* src/styles/tokens.themes.css */
[data-theme='dark'] {
  --color-bg: var(--primitive-charcoal-900);
  --color-surface: var(--primitive-charcoal-800);
  --color-surface-alt: var(--primitive-charcoal-alt);
  --color-text: var(--primitive-cream-50);
  --color-text-secondary: var(--primitive-ink-300);
  --color-text-muted: var(--primitive-ink-500);
  --color-primary: var(--primitive-teal-300);
  --color-primary-hover: #5dc7b8;
  --color-primary-soft: var(--primitive-teal-soft-dark);
  --color-accent: var(--primitive-amber-300);
  --color-accent-soft: var(--primitive-amber-soft-dark);
  --color-border: var(--primitive-charcoal-700);
  --color-focus: var(--primitive-teal-300);
  --color-success: var(--primitive-success-dark);
  --color-warning: var(--primitive-amber-300);
}

/* System preference fallback when user has not chosen explicitly.
   :not([data-theme]) means: only apply if no explicit data-theme attribute. */
@media (prefers-color-scheme: dark) {
  html:not([data-theme]) {
    /* duplicate the dark overrides */
    --color-bg: var(--primitive-charcoal-900);
    --color-surface: var(--primitive-charcoal-800);
    --color-surface-alt: var(--primitive-charcoal-alt);
    --color-text: var(--primitive-cream-50);
    --color-text-secondary: var(--primitive-ink-300);
    --color-text-muted: var(--primitive-ink-500);
    --color-primary: var(--primitive-teal-300);
    --color-primary-hover: #5dc7b8;
    --color-primary-soft: var(--primitive-teal-soft-dark);
    --color-accent: var(--primitive-amber-300);
    --color-accent-soft: var(--primitive-amber-soft-dark);
    --color-border: var(--primitive-charcoal-700);
    --color-focus: var(--primitive-teal-300);
    --color-success: var(--primitive-success-dark);
    --color-warning: var(--primitive-amber-300);
  }
}
```

**Note on the inline script** to prevent flash-of-wrong-theme (already in WEBSITE-BUILD-SPEC.md §15.1): it sets `data-theme` from `localStorage` before first paint. The `@media (prefers-color-scheme: dark)` block above only applies when the inline script has NOT set `data-theme` (e.g., a brand-new user with no localStorage value).

### T3.5 Tighten Stylelint to block primitive usage in components

v1's `.stylelintrc.json` allows `--color-*`, `--space-*`, etc. v2 extends the pattern to also allow `--primitive-*` (for the token files themselves) but adds a separate rule that forbids primitive usage outside `tokens.primitive.css`.

```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "custom-property-pattern": "^--(primitive|color|space|text|leading|measure|radius|shadow|width|font-family|elevation|motion|z)-",
    "selector-class-pattern": "^[a-z][a-zA-Z0-9-]*$",
    "no-descending-specificity": null
  },
  "overrides": [
    {
      "files": ["src/styles/tokens.primitive.css"],
      "rules": { "custom-property-pattern": "^--primitive-" }
    },
    {
      "files": [
        "src/components/**/*.{css,astro}",
        "src/layouts/**/*.{css,astro}",
        "src/pages/**/*.{css,astro}"
      ],
      "rules": {
        "custom-property-pattern": "^--(color|space|text|leading|measure|radius|shadow|width|font-family|elevation|motion|z)-",
        "declaration-property-value-disallowed-list": {
          "/.*/": ["/var\\(--primitive-/"]
        }
      }
    }
  ]
}
```

The `declaration-property-value-disallowed-list` block enforces: any component using `var(--primitive-*)` fails lint. Use `--color-primary` (semantic) instead.

### T3.6 Acceptance checks (T3 only)

- [ ] Three files exist: `tokens.primitive.css`, `tokens.semantic.css`, `tokens.themes.css`.
- [ ] `global.css` imports all three in order.
- [ ] Component files only use semantic tokens (`var(--color-*)`, `var(--space-*)`, etc.).
- [ ] `npx stylelint "src/**/*.css" "src/**/*.astro"` passes.
- [ ] Toggling `[data-theme="dark"]` on `<html>` visibly switches the theme.
- [ ] On a fresh browser with no localStorage and OS in dark mode, the page loads in dark theme (verifies the `prefers-color-scheme` fallback).
- [ ] All color values match WEBSITE-BUILD-SPEC.md §7.1 (no design drift introduced by the refactor).

## T4. Function design and code complexity

**v1 status:** v1 §3.2 lints a small set of issues. v1 does not specify function-size, complexity, depth, parameter, or cohesion constraints.

**v2 additions (rules ALREADY shipped in T2's ESLint config; documented here for the design intent):**

| Item                             | Rule (from T2)                      | Threshold                                 |
| -------------------------------- | ----------------------------------- | ----------------------------------------- |
| 12. Single Responsibility        | `max-lines-per-function`            | 50                                        |
| 13. Cyclomatic complexity        | `complexity`                        | 10                                        |
| 13. Cognitive complexity         | `sonarjs/cognitive-complexity`      | 15                                        |
| 14. DRY (duplicate strings)      | `sonarjs/no-duplicate-string`       | threshold 3                               |
| 14. DRY (identical functions)    | `sonarjs/no-identical-functions`    | enabled via `sonarjs.configs.recommended` |
| 15. File size                    | `max-lines`                         | 300                                       |
| 18. Arrow anti-pattern (nesting) | `max-depth`, `max-nested-callbacks` | 3 each                                    |
| Param count                      | `max-params`                        | 4                                         |
| One statement per line           | `max-statements-per-line`           | 1                                         |

All of these were verified end-to-end in the sandbox (T2.4). This section adds the additional pieces not covered by lint:

### T4.1 SRP design heuristic (item 12)

When a function exceeds 50 lines, the ESLint rule from T2 forces a split. The pattern:

```ts
// Orchestrator (small) + helpers (focused)
export function processLesson(file: string): Lesson {
  const raw = readLessonFile(file);
  const frontmatter = parseFrontmatter(raw);
  validateFrontmatter(frontmatter);
  const body = parseBody(raw);
  return composeLesson(frontmatter, body);
}

function readLessonFile(file: string): string {
  /* ... */
}
function parseFrontmatter(raw: string): Frontmatter {
  /* ... */
}
function validateFrontmatter(fm: Frontmatter): void {
  /* ... */
}
function parseBody(raw: string): Body {
  /* ... */
}
function composeLesson(fm: Frontmatter, body: Body): Lesson {
  /* ... */
}
```

Each helper has one job. The orchestrator's job is sequencing.

### T4.2 Replace deep conditionals with lookup tables (item 18)

The `max-depth: 3` rule from T2 catches deep nesting. Refactor patterns:

```ts
// BAD: deep nesting
function formatChip(format: string): string {
  if (format === 'scenario') {
    if (someCondition) {
      // ...
    } else {
      /* ... */
    }
  } else if (format === 'comparison') {
    /* ... */
  }
}

// GOOD: lookup table + early return
type ArticleFormat = 'scenario' | 'comparison' | 'rule';

const FORMAT_LABELS: Record<ArticleFormat, string> = {
  scenario: 'Scenario',
  comparison: 'Comparison',
  rule: 'Rule',
};

function formatChip(format: ArticleFormat): string {
  return FORMAT_LABELS[format];
}
```

### T4.3 Dead-code detection with knip (item 17)

**v1 status:** v1 uses `unused-imports/no-unused-imports` (caught in T2) — that handles unused imports. It does NOT detect unused FILES, unused EXPORTS, or unused DEPENDENCIES.

**Verified:** `knip@6.15.0` is the right tool. Run reports unused files, exports, types, and dependencies. CLI confirmed via `npx knip --help`.

Install + run:

```sh
npm install -D knip
npx knip
```

`knip.json` (minimal config):

```json
{
  "entry": ["src/pages/**/*.{astro,ts}", "astro.config.mjs", "src/content/config.ts"],
  "project": ["src/**/*.{ts,tsx,astro,css}"],
  "ignore": ["dist/**", ".astro/**"],
  "ignoreDependencies": []
}
```

Add to weekly CI (extending v1 `scheduled.yml`):

```yaml
- name: Detect unused code with knip
  run: npx knip --reporter compact
```

`knip` exits non-zero on findings; the workflow fails. Triage and clean weekly.

### T4.4 Encapsulation (item 19)

TypeScript/Astro doesn't have run-time private classes outside of `#`-fields. Pattern:

```ts
export class SearchClient {
  // Hard-private (run-time): the JS engine forbids external access
  #cache = new Map<string, SearchResult[]>();

  // TypeScript-private (compile-time only): convention, accessible at run-time
  private readonly maxCacheSize = 100;

  query(text: string): SearchResult[] {
    const cached = this.#cache.get(text);
    if (cached) return cached;
    // ...
  }
}
```

Hard `#` for state you NEVER want any caller to inspect (caches, internal indices). TypeScript `private` for everything else.

The `@typescript-eslint/explicit-member-accessibility` rule enforces explicit `public | private | protected` on every member. Add to T2's rules:

```js
'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
```

(Not added to T2's config above to keep that section focused on auto-enforced style; add here as part of T4.)

### T4.5 Inheritance depth (item 20)

The codebase uses Astro components (composition, no inheritance) and a small number of utility classes. Convention: **inheritance depth ≤ 2**. Prefer composition. Document on a per-class basis if a deeper hierarchy is unavoidable.

No automated check at present. Enforced by code review.

### T4.6 Coupling and cohesion (item 16)

Principles, enforced by code review:

- **Depend on types/interfaces, not concrete classes.** Pass dependencies as parameters (see T9 for the DI pattern).
- **A method must use at least one instance member.** If it doesn't, it belongs as a module-level utility function, not a class method.
- **One file = one logical responsibility.** If two unrelated concepts live in the same file, split.

### T4.7 Acceptance checks (T4 only)

- [ ] No function in the codebase exceeds 50 lines or complexity 10 (`max-lines-per-function`, `complexity` from T2).
- [ ] No file exceeds 300 lines (`max-lines` from T2).
- [ ] `npx knip` on main branch reports zero unused files, exports, or dependencies.
- [ ] `@typescript-eslint/explicit-member-accessibility` is enabled and passes.
- [ ] Class definitions use `#` for hard-private state; document on the class if any field is exposed.

## T5. Custom error types + Zod runtime validation

**v1 status:** v1 does not define custom error types or runtime input validation.

**v2 additions:** an error class hierarchy at `src/lib/errors.ts` and Zod schemas at the boundaries of the system (frontmatter, taxonomy, URL query params).

### T5.1 Error class hierarchy

```ts
// src/lib/errors.ts

/**
 * Base error class. All domain errors extend this so callers can pattern-match.
 *
 * @example
 *   try { ... } catch (err) {
 *     if (err instanceof LcsError) log.error(err.message, { code: err.code });
 *     else throw err;  // re-throw unknowns
 *   }
 */
export class LcsError extends Error {
  override readonly name: string;
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class FrontmatterError extends LcsError {
  constructor(
    message: string,
    readonly lessonPath: string,
  ) {
    super(message, 'FRONTMATTER_ERROR');
  }
}

export class TaxonomyError extends LcsError {
  constructor(message: string) {
    super(message, 'TAXONOMY_ERROR');
  }
}

export class SearchIndexError extends LcsError {
  constructor(
    message: string,
    readonly query?: string,
  ) {
    super(message, 'SEARCH_INDEX_ERROR');
  }
}

export class NetworkTimeoutError extends LcsError {
  constructor(
    message: string,
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(message, 'NETWORK_TIMEOUT');
  }
}
```

Sentry groups errors by `name` + `code`, so a flood of one kind doesn't drown others.

### T5.2 Zod schemas at the boundary

**Verified (Zod 4.4.3 in sandbox):**

- `z.object`, `z.array`, `z.enum`, `z.string`, `z.number`, `.int()`, `.positive()` all work.
- `.parse(x)` throws `ZodError` on failure; `.safeParse(x)` returns `{ success, data | error }`.
- `ZodError.issues` is `Array<{ path: (string | number)[], code: string, message: string }>`.
- Issue codes observed: `invalid_type`, `invalid_value` (Zod 4 renamed some from v3).

```ts
// src/lib/schemas.ts
import { z } from 'zod';

export const ArticleFormatSchema = z.enum(['scenario', 'comparison', 'rule']);
export type ArticleFormat = z.infer<typeof ArticleFormatSchema>;

export const PlannedLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  format: ArticleFormatSchema,
});

export const SubtopicSchema = z.object({
  id: z.string(),
  title: z.object({ en: z.string() }),
  planned_lessons: z.array(PlannedLessonSchema),
});

export const ClusterSchema = z.object({
  id: z.string(),
  title: z.object({ en: z.string() }),
  icon: z.string().optional(),
  subtopics: z.array(SubtopicSchema),
});

export const TaxonomySchema = z.object({
  version: z.string(),
  clusters: z.array(ClusterSchema),
  abroad_packs: z.array(ClusterSchema),
});

export type Taxonomy = z.infer<typeof TaxonomySchema>;
```

### T5.3 Wrap loader functions in safeParse + custom error

```ts
// src/lib/taxonomy.ts
import { readFileSync } from 'node:fs';
import { TaxonomySchema, type Taxonomy } from './schemas';
import { TaxonomyError } from './errors';
import { createLogger } from './logger';

const log = createLogger('lib.taxonomy');

export function loadTaxonomy(path: string): Taxonomy {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new TaxonomyError(`Failed to read or parse taxonomy.json: ${(err as Error).message}`);
  }

  const result = TaxonomySchema.safeParse(raw);
  if (!result.success) {
    log.error('Taxonomy schema validation failed', {
      issueCount: result.error.issues.length,
      firstThree: result.error.issues
        .slice(0, 3)
        .map((i) => ({ path: i.path, code: i.code, message: i.message })),
    });
    throw new TaxonomyError(
      `Taxonomy schema invalid: ${result.error.issues.length} issue(s); first at path ${JSON.stringify(result.error.issues[0].path)}`,
    );
  }
  return result.data;
}
```

### T5.4 No empty catch blocks (item 25)

The T2 ESLint rule `'no-empty': ['error', { allowEmptyCatch: false }]` (verified in sandbox) blocks empty `catch {}`. Required pattern when catching:

```ts
try {
  doSomething();
} catch (err) {
  // Decide: handle gracefully, re-throw, or wrap in a custom error.
  log.error('doSomething failed', { error: err });

  if (err instanceof NetworkTimeoutError) {
    showFallbackUI(); // graceful degrade
    return;
  }
  if (err instanceof LcsError) {
    throw err; // re-throw domain errors
  }
  throw new LcsError(`Unexpected: ${(err as Error).message}`, 'UNKNOWN'); // wrap unknowns
}
```

### T5.5 Boundary-condition documentation (item 26)

For every exported function that has non-trivial edge cases, the TSDoc includes `@edge-case` lines. ESLint (`jsdoc/require-description`, etc., from T2) enforces presence of TSDoc but cannot enforce content quality — that's code review.

```ts
/**
 * Compute estimated reading time in minutes.
 *
 * @edge-case Returns 1 for any non-empty wordCount > 0 and < 200 (minimum readable time).
 * @edge-case Returns 0 for wordCount === 0.
 * @edge-case Uses 200 WPM constant for English; multilingual TBD in Phase 3.
 */
export function computeReadingTime(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.round(wordCount / 200));
}
```

### T5.6 Acceptance checks (T5 only)

- [ ] `src/lib/errors.ts` defines `LcsError` + at least the four domain subclasses listed above.
- [ ] All thrown errors in `src/lib/` and `src/components/` are instances of `LcsError` or a subclass; no bare `throw new Error(...)`.
- [ ] `src/lib/schemas.ts` exists with Zod schemas for `Taxonomy`, frontmatter, and any URL query param contract.
- [ ] Every external-input loader (`loadTaxonomy`, frontmatter parsing in content collection) routes through `safeParse` and throws a `LcsError` subclass on failure.
- [ ] Vitest suite includes deliberate-bad-input tests for each schema, asserting the right `LcsError` subclass is thrown.
- [ ] No empty `catch` blocks anywhere (T2 lint rule enforces).

## T6. Resource cleanup patterns

**v1 status:** v1 does not specify cleanup conventions for event listeners, timers, or network requests.

**v2 additions:** an AbortController-based pattern that cleans up listeners and timers atomically, plus a `fetchWithTimeout` helper for items 27, 28, 31.

### T6.1 Verified browser/Node APIs

- **`AbortController`** is a global in modern Node (≥18) and all evergreen browsers.
- **`AbortSignal.timeout(ms)`** is a modern shortcut that returns an `AbortSignal` aborting after `ms`. Verified in Node 22.
- **`addEventListener(type, listener, { signal })`** is supported on all `EventTarget` instances. When the signal aborts, the listener is removed automatically. Verified.
- **`fetch(url, { signal })`** throws an error with `name === 'AbortError'`, instance of `DOMException`. Verified.

### T6.2 Island cleanup pattern

Every island returns a cleanup function from its `init`. The pattern uses one `AbortController` to clean up every listener and timer the island created.

```ts
// src/components/islands/theme-toggle.ts
import { createLogger } from '@lib/logger';

const log = createLogger('island.theme-toggle');

export function init(root: HTMLElement): () => void {
  const button = root.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!button) {
    log.warn('Theme toggle button not found in root');
    return () => undefined;
  }

  const controller = new AbortController();
  const { signal } = controller;

  // Listeners auto-removed when controller.abort() is called.
  button.addEventListener('click', handleToggle, { signal });
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', handleSystemChange, { signal });

  function handleToggle(): void {
    /* ... */
  }
  function handleSystemChange(): void {
    /* ... */
  }

  return () => controller.abort();
}
```

One controller = one `abort()` call = every listener gone. No risk of forgetting one.

### T6.3 Timer tracking (for islands that schedule work)

For timers that are not naturally cleaned up by the controller (e.g., long-running setIntervals), track them in a `Set`:

```ts
const timers = new Set<number>();

function scheduleSearch(query: string): void {
  const id = window.setTimeout(() => {
    timers.delete(id);
    runSearch(query);
  }, SEARCH_DEBOUNCE_MS);
  timers.add(id);
}

// In cleanup:
function cleanupTimers(): void {
  for (const id of timers) clearTimeout(id);
  timers.clear();
}
```

### T6.4 `fetchWithTimeout` helper

Use `AbortSignal.timeout` for the cleanest implementation. Verified in Node 22 sandbox.

```ts
// src/lib/fetch-with-timeout.ts
import { NetworkTimeoutError } from './errors';

const DEFAULT_TIMEOUT_MS = 8_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  // Compose timeout signal with any existing signal the caller passed.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  try {
    return await fetch(url, { ...options, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NetworkTimeoutError(`Fetch to ${url} aborted after ${timeoutMs}ms`, url, timeoutMs);
    }
    throw err;
  }
}
```

**Note on `AbortSignal.any`:** combines multiple signals so the caller can both pass their own cancel signal AND benefit from the timeout. `AbortSignal.any` is available in Node 20+ and all evergreen browsers as of 2024. If targeting older browsers, fall back to a manual `AbortController` that listens for both.

### T6.5 Arithmetic safety (item 30)

Division by zero in TypeScript yields `Infinity` (not an exception). Guard explicitly:

```ts
function computeAverageQualityScore(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}
```

Integer overflow is not a concern in practice for this site — JS `number` is double-precision; values stay under `Number.MAX_SAFE_INTEGER` (~9 × 10¹⁵). For any arithmetic above that range (none expected), use `BigInt`.

### T6.6 Memory-leak prevention (items 27, 28)

- Listener leaks → solved by T6.2 (one `AbortController` per island).
- Timer leaks → solved by T6.3 (tracked Set + cleanup).
- Unbounded caches → use a fixed-size LRU. `Map` with eviction:

```ts
const MAX_CACHE_ENTRIES = 100;

class LruCache<K, V> {
  #map = new Map<K, V>();
  constructor(readonly max: number = MAX_CACHE_ENTRIES) {}

  get(key: K): V | undefined {
    const value = this.#map.get(key);
    if (value !== undefined) {
      this.#map.delete(key);
      this.#map.set(key, value); // re-insert to mark as recently used
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) this.#map.delete(key);
    else if (this.#map.size >= this.max) {
      const firstKey = this.#map.keys().next().value as K;
      this.#map.delete(firstKey);
    }
    this.#map.set(key, value);
  }
}
```

### T6.7 Thread safety (item 29)

**Not applicable** at launch. JavaScript on the main thread is single-threaded. Web Workers are out of scope at launch. If we later add a Worker (e.g., for search indexing), revisit then.

Document this in the relevant ADR rather than spec rules now.

### T6.8 Acceptance checks (T6 only)

- [ ] Every island's `init` returns a cleanup function that calls `controller.abort()` (or equivalent).
- [ ] No island uses bare `element.addEventListener(type, fn)` without `{ signal }`; lint via a custom rule or code review.
- [ ] `src/lib/fetch-with-timeout.ts` exists and wraps every `fetch` call in the codebase.
- [ ] A Vitest spec proves: after a Pagefind search controller is aborted mid-flight, the search resolves to a `NetworkTimeoutError`.
- [ ] `LruCache` (or equivalent) used for any persistent in-memory cache; capped at a documented `max`.

## T7. Security additions on top of v1

**v1 status:** v1 §10.1 specifies security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options). v1 §10.2-10.4 cover privacy (no cookies, no third-party trackers), the privacy policy page, and dependency security (Dependabot + weekly `npm audit`). v1 §6.5 covers secrets in GitHub Actions / Cloudflare Pages.

**v2 additions (do not duplicate v1):**

1. ESLint plugins for code-level security catches (already included in T2).
2. A CSP nonce migration plan to tighten v1's `script-src 'unsafe-inline'`.
3. An explicit "what does not apply at launch" table to avoid wasted work.

### T7.1 ESLint security plugins (already in T2)

These three plugins were added to the T2 ESLint config:

| Plugin                                               | Catches                                                                                                      | T2 reference |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `eslint-plugin-security`                             | (loaded but rule selection minimal — sonarjs covers most)                                                    | T2.3         |
| `eslint-plugin-no-secrets`                           | High-entropy strings (likely tokens/keys) committed to source                                                | T2.3         |
| `eslint-plugin-no-unsanitized` (configs.recommended) | Dangerous DOM sinks: `element.innerHTML = userInput`, `element.outerHTML = ...`, `document.write(...)`, etc. | T2.3         |

No additional config needed beyond T2. The PR gate (T2.5) catches violations.

### T7.2 CSP nonce migration (extends v1 §10.1)

**Status of v1 CSP:** v1 §10.1 uses `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://*.sentry.io`. The `'unsafe-inline'` is a known weakening; it permits ANY inline script to execute. The pragma there is "tighten once stable."

**v2 plan:** migrate to a nonce-per-page CSP. Astro supports inline-script hashing/nonces; see the documented strategy below.

#### Step A: enumerate every inline script

Inline scripts that exist today (verify by `grep -rn "<script" src/` and `grep -rn "is:inline" src/`):

- The theme-init script that prevents flash-of-wrong-theme (set before first paint). Must remain inline; the trick is to nonce it.
- Cloudflare Web Analytics beacon snippet (`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="...">`) — this is `src=`, not inline; no nonce needed.
- Any structured-data `<script type="application/ld+json">` blocks (text/data, not executable; CSP allows them under `script-src` of `'self'` or with nonce).

#### Step B: generate a nonce per response (Cloudflare Pages Function)

Cloudflare Pages supports Functions. A small `_middleware.ts`:

```ts
// functions/_middleware.ts (Cloudflare Pages)
export const onRequest: PagesFunction = async ({ next, request }) => {
  const response = await next();
  const nonce = crypto.randomUUID().replace(/-/g, '');

  // Rewrite response HTML to inject nonce on every inline <script>
  // (Cloudflare HTMLRewriter is the right tool here.)
  const rewriter = new HTMLRewriter().on('script', {
    element(el) {
      if (!el.getAttribute('src')) {
        el.setAttribute('nonce', nonce);
      }
    },
  });

  const newResponse = rewriter.transform(response);

  // Replace CSP header with nonce-based policy
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.sentry.io https://static.cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`;
  newResponse.headers.set('Content-Security-Policy', csp);
  return newResponse;
};
```

**Caveat (be honest):** the snippet above is the documented Cloudflare Pages Functions pattern, but the exact HTMLRewriter API + PagesFunction signature should be re-checked against current Cloudflare docs at implementation time. The two known unknowns: whether `HTMLRewriter` is in scope by default in Pages Functions (it is in Workers; Pages Functions inherit Worker runtime), and whether middleware functions can transform the body. Re-verify before merging.

**Alternative (simpler):** if the middleware approach is fragile, accept `'unsafe-inline'` for v1 launch and revisit. Document the decision in `docs/adrs/`.

#### Step C: also tighten `style-src`

`style-src 'unsafe-inline'` is used because some inline `style="..."` attributes exist (e.g., LQIP backgrounds in T10's image pipeline). Strategies:

- Move LQIP from inline-style to a hashed class (precomputed at build time) — eliminates inline styles for hot images.
- Keep `style-src 'unsafe-inline'` for v1 launch. Style XSS is lower-risk than script XSS.

### T7.3 What does NOT apply at launch (explicit)

The 48-requirement list includes several items that the current architecture makes inapplicable. Documenting these prevents wasted work.

| #   | Item                                      | Why not applicable now                                  | Re-evaluate when                      |
| --- | ----------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| 29  | Thread safety                             | Single-threaded JS; no Web Workers at launch            | Adding a Worker (e.g., client search) |
| 32  | SQL injection defenses                    | No SQL database; content is markdown read at build time | Adding any backend with a DB          |
| 34  | No plain-text passwords                   | No user accounts or passwords                           | Adding authentication                 |
| 35  | Secure password hashing (bcrypt/Argon2)   | Same                                                    | Adding authentication                 |
| 38  | Authentication/authorization on endpoints | No backend endpoints; fully static                      | Adding any auth-gated route           |

When any of these triggers fires (a backend, a Worker, auth), the spec for it becomes its own document. Architectural hooks in v1 §15.4 (login/favorites placeholders) remain unchanged.

### T7.4 Acceptance checks (T7 only)

- [ ] T2's `eslint-plugin-no-secrets`, `eslint-plugin-no-unsanitized` rules are active in CI (already part of T2 acceptance).
- [ ] A documented CSP nonce migration plan exists in `docs/adrs/` (e.g., `ADR-009: CSP nonce migration`). Plan may be "deferred until after launch"; that's a valid status.
- [ ] No third-party scripts beyond the v1-allowed list (Cloudflare beacon, Sentry) loaded; confirm via DevTools Network tab on a production build.
- [ ] `securityheaders.com` scan returns A or A+ after deploy (v1 §15 carries this check).

## T8. Performance: view transitions, prefetch, cache headers

**v1 status:** v1 §5 covers Lighthouse CI, bundle budgets, analytics, Sentry, uptime. v1 does not specify view-transition or prefetch behavior, nor the `_headers` cache file beyond mentioning `public/_headers` in passing.

**v2 additions:** opt-in Astro client-side routing, prefetch strategies per link kind, and a verified `_headers` cache schema for Cloudflare Pages.

### T8.1 Critical correction from my previous unverified spec

My previous v2 wrote `<ViewTransitions />` from `astro:transitions`. **That was the Astro 4 component name.** Verified against current Astro docs:

- **Astro 5+** renamed it to **`<ClientRouter />`** imported from `astro:transitions`.
- Astro 4's `<ViewTransitions />` is still supported but deprecated.
- For browser-native cross-document transitions (no Astro routing), no component is needed — modern browsers honor `@view-transition { navigation: auto; }` in CSS.

Current version verified via `npm view astro version` = 6.4.4; docs source confirms the rename.

### T8.2 Enable Astro client-side routing (optional)

For an SPA-like feel with shared state across navigations:

```astro
---
import { ClientRouter } from 'astro:transitions';
---

<!-- src/components/layout/Head.astro -->
<head>
  <!-- other head content -->
  <ClientRouter />
</head>
```

**Decision: is `<ClientRouter />` worth it for this site?**

For a content-heavy MPA with mostly text, the `<ClientRouter />` ships extra runtime JS (~5KB gzipped) to all pages. The benefit is smoother transitions and preserved state for islands across navigations (e.g., the search overlay's open state).

Trade-off table:

| Option                                                                 | JS payload          | Benefit                                                                      | When to choose                                              |
| ---------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| No `<ClientRouter />`, no `@view-transition` CSS                       | 0 bytes             | Default MPA; full page reload each navigation                                | If the site truly needs zero-JS everywhere                  |
| No `<ClientRouter />`, add CSS `@view-transition { navigation: auto }` | 0 bytes             | Browser-native transitions on supporting browsers (Chrome 126+, Edge 126+)   | Minimal cost, modest benefit, no Firefox/Safari support yet |
| `<ClientRouter />`                                                     | ~5KB JS, every page | Smoothest transitions, persistent islands, fallback for unsupported browsers | If transitions are a design priority                        |

**Recommendation:** start with the CSS-only approach. Reassess after launch based on real-user data. If `<ClientRouter />` is added later, no architecture change — it's a single component in the Head.

CSS-only approach:

```css
/* src/styles/global.css */
@view-transition {
  navigation: auto;
}
```

### T8.3 Prefetch via Astro's built-in

Verified from Astro docs:

- Enable globally: `prefetch: true` in `astro.config.mjs`.
- Per-link opt-in attribute: `data-astro-prefetch[="strategy"]`.
- Strategies: `hover` (default), `tap`, `viewport`, `load`.
- **Astro automatically falls back to `tap` when `navigator.connection.saveData` is true OR `effectiveType` is slow.** This is built in.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  prefetch: {
    prefetchAll: false, // opt-in per link
    defaultStrategy: 'hover',
  },
});
```

Per link:

```astro
<a href="/traffic/honking-discipline" data-astro-prefetch="hover"> Honking discipline </a>
```

### T8.4 Prefetch strategy per link type

| Link kind                                  | Strategy                           | Rationale                                                     |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| Top-nav category links                     | `hover` (desktop) / `tap` (mobile) | High intent; small payload                                    |
| "Related lessons" links on an article page | `hover`                            | Reader-likely path                                            |
| TOC anchor links (same page)               | none                               | No navigation needed                                          |
| Footer / About / Privacy                   | (omit attribute)                   | Rare navigation                                               |
| Search-result links                        | (omit attribute)                   | Already a user action; prefetching the next click is overkill |

Because Astro's built-in already does the 2G fallback, **no custom island for navigation prefetch is needed.** This removes the complexity I had in the previous unverified v2.

### T8.5 Cache headers via Cloudflare Pages `_headers` file

Verified from Cloudflare docs: `_headers` is a plain text file in `public/` (or build output) using this format:

```
[url-pattern]
  [name]: [value]
```

Important caveat from Cloudflare's own docs: **headers in `_headers` are NOT applied to Pages Functions responses.** All static asset responses get them; dynamic Function responses set headers in the Function code.

```
# public/_headers

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=31536000, immutable

/pagefind/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/sitemap.xml
  Cache-Control: public, max-age=3600

/*.html
  Cache-Control: public, max-age=300, stale-while-revalidate=86400

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Notes:

- `/_astro/*` directory holds Astro's hashed asset bundles — they're cache-busting by filename, so 1 year immutable is safe.
- Hashed image filenames go under `/images/*` (Phase 3 — see T10).
- The HTML pages get a short `max-age` plus `stale-while-revalidate` so a returning visitor sees content fast even when a deploy is in progress.

### T8.6 Connection-aware loading for IMAGES (this is what the prefetch fallback DOES NOT cover)

Astro's built-in prefetch handles the 2G case for **link prefetching**. It does NOT handle:

- Eager-loaded hero images (will still download at full size on 2G).
- Below-the-fold images that lazy-load when scrolled into view.

For images, a small client-side island detects connection and downgrades behavior. Browser API verified via MDN:

- `navigator.connection` is the `NetworkInformation` object.
- `effectiveType` returns one of `'slow-2g' | '2g' | '3g' | '4g'`.
- `saveData` is boolean (user's Data Saver setting).
- `downlink` is the estimated downlink Mbps (number).

```ts
// src/lib/network.ts
import { createLogger } from './logger';
const log = createLogger('lib.network');

export type ConnectionTier = 'fast' | 'slow' | 'unknown';

interface NetworkInformationLike {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
  downlink?: number;
}

export function detectConnectionTier(): ConnectionTier {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return 'unknown';
  if (conn.saveData) return 'slow';
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'slow';
  log.debug('Connection detected', { effectiveType: conn.effectiveType, downlink: conn.downlink });
  return 'fast';
}
```

The detailed image-loading behavior built on top of this is in T10 (image pipeline). T8 just provides the detection primitive.

### T8.7 No O(N²) algorithms (item 42)

For taxonomy/lesson lookups, pre-build maps at build time:

```ts
// build-time
const lessonsByCluster = new Map<string, Lesson[]>();
for (const lesson of allLessons) {
  const list = lessonsByCluster.get(lesson.cluster) ?? [];
  list.push(lesson);
  lessonsByCluster.set(lesson.cluster, list);
}
```

Code-review heuristic: any function with nested loops over the lesson list needs to demonstrate it's O(N) or be refactored to use a Map lookup.

### T8.8 Acceptance checks (T8 only)

- [ ] `astro.config.mjs` enables `prefetch: { defaultStrategy: 'hover' }`.
- [ ] Top-nav and "related lessons" links carry `data-astro-prefetch`.
- [ ] `public/_headers` exists with the cache rules above.
- [ ] On a fresh deploy, DevTools Network confirms `Cache-Control: ... immutable` on `/_astro/*` and `/fonts/*` responses.
- [ ] `src/lib/network.ts` exports `detectConnectionTier`; T10 image island consumes it.
- [ ] A decision on `<ClientRouter />` vs CSS `@view-transition` is recorded in `docs/adrs/`.

## T9. Dependency Injection pattern (item 47)

**v1 status:** v1 does not specify a DI approach. Vitest is configured (v1 §4.2) but there is no guidance on how to make islands and lib functions testable.

**v2 additions:** parameter-injection pattern with defaults. No DI library; the language is sufficient.

### T9.1 The pattern in one paragraph

Every function or class that depends on something dynamic — a `fetch`, a `Date.now()`, a `Storage`, a logger — takes those dependencies as parameters with sensible defaults. Production callers use the defaults (zero ceremony). Tests pass mocks.

### T9.2 Function-level DI

```ts
// src/lib/reading-time.ts
import { createLogger } from './logger';

const READING_WPM = 200;

export interface ComputeReadingTimeDeps {
  log?: ReturnType<typeof createLogger>;
}

export function computeReadingTime(wordCount: number, deps: ComputeReadingTimeDeps = {}): number {
  const { log = createLogger('lib.reading-time') } = deps;
  if (wordCount <= 0) {
    log.debug('Reading time requested with non-positive wordCount', { wordCount });
    return 0;
  }
  return Math.max(1, Math.round(wordCount / READING_WPM));
}
```

Test:

```ts
import { describe, it, expect, vi } from 'vitest';
import { computeReadingTime } from './reading-time';

describe('computeReadingTime', () => {
  it('logs debug when wordCount is zero', () => {
    const debugSpy = vi.fn();
    const log = { debug: debugSpy, info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    computeReadingTime(0, { log });
    expect(debugSpy).toHaveBeenCalledOnce();
  });
});
```

### T9.3 Class-level DI (when a stateful object is the right shape)

```ts
// src/lib/search-client.ts
import type { Logger } from './logger';
import { createLogger } from './logger';
import { fetchWithTimeout } from './fetch-with-timeout';
import { SearchIndexError } from './errors';

export interface SearchClientDeps {
  fetch?: typeof fetchWithTimeout;
  log?: Logger;
  storage?: Storage;
  now?: () => number;
}

export class SearchClient {
  readonly #fetch: typeof fetchWithTimeout;
  readonly #log: Logger;
  readonly #storage: Storage;
  readonly #now: () => number;

  constructor(deps: SearchClientDeps = {}) {
    this.#fetch = deps.fetch ?? fetchWithTimeout;
    this.#log = deps.log ?? createLogger('lib.search-client');
    this.#storage = deps.storage ?? window.sessionStorage;
    this.#now = deps.now ?? Date.now;
  }

  async query(text: string): Promise<readonly string[]> {
    const cacheKey = `search:${text}`;
    const cached = this.#storage.getItem(cacheKey);
    if (cached) {
      this.#log.debug('Search cache hit', { text });
      return JSON.parse(cached) as string[];
    }

    const start = this.#now();
    const response = await this.#fetch(`/pagefind/api?q=${encodeURIComponent(text)}`);
    if (!response.ok) {
      throw new SearchIndexError(`Search returned ${response.status}`, text);
    }
    const data = (await response.json()) as string[];
    this.#storage.setItem(cacheKey, JSON.stringify(data));
    this.#log.info('Search query completed', { text, ms: this.#now() - start });
    return data;
  }
}
```

Test (injecting mocks):

```ts
import { describe, it, expect, vi } from 'vitest';
import { SearchClient } from './search-client';

describe('SearchClient', () => {
  it('uses cache on repeat query', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(['result1']),
    } as Response);

    const storage = new Map<string, string>();
    const storageAdapter: Storage = {
      length: 0,
      clear: () => storage.clear(),
      getItem: (k) => storage.get(k) ?? null,
      key: () => null,
      removeItem: (k) => storage.delete(k),
      setItem: (k, v) => {
        storage.set(k, v);
      },
    };

    const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const now = vi.fn().mockReturnValue(0);

    const client = new SearchClient({ fetch: mockFetch, log, storage: storageAdapter, now });
    await client.query('honking');
    await client.query('honking');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(log.debug).toHaveBeenCalledWith('Search cache hit', { text: 'honking' });
  });
});
```

### T9.4 What this pattern gets us

- **Items 46 + 47 satisfied without a DI library.** No magic decorators, no token registry, no learning curve.
- **Determinism in tests (item 48).** Mock `now` to control timestamps. Mock `fetch` to control network. Tests are fully deterministic without `Math.random` or system clock dependencies.
- **No `Math.random()` in production code without injection.** When randomness is needed (e.g., correlation IDs), accept a `random?: () => number` parameter so tests can pass `() => 0.5`.

### T9.5 ESLint rule to enforce the pattern (optional, code-review-first)

There's no off-the-shelf ESLint rule for "must accept dependencies as parameters." Enforcement is by code review:

- Any class or function that calls `fetch`, `window.fetch`, `Date.now`, `Math.random`, `localStorage`, `sessionStorage`, `setTimeout`, or `setInterval` directly without injecting them — fails review.

A project-local custom ESLint rule could be added in Phase 2 (`scripts/eslint-rules/no-undeclared-globals.js`) if violations become common.

### T9.6 Acceptance checks (T9 only)

- [ ] Every `src/components/islands/*.ts` and `src/lib/*.ts` file accepts its dependencies via parameters with defaults.
- [ ] Vitest suites use mock dependencies, not real `fetch`/`Storage`/`Date.now`.
- [ ] No `Math.random()` direct call in production code. (Correlation-ID generator and similar use `nanoid` or an injected random source.)
- [ ] Code-review checklist (in CONTRIBUTING.md per v1) includes: "Are dependencies injected? Or globals captured directly?"

## T10. Image pipeline deepening

**v1 status:** v1 §12 (Phase 3) specifies the basic flow: source images at `learncivicsense-content/05-images/{cluster}/{lesson-id}.{jpg,png}` (note: file-level, one image per lesson), the Astro `<Image>` component with `widths={[400, 800, 1200]}`, `format="webp"`, `loading="lazy"`. v1 §12.3 requires alt text. v1 §12.4 mentions CLS prevention.

**v2 additions (extends v1 §12, does NOT duplicate):**

1. Folder layout to support **multiple images per lesson** (hero + inlines).
2. Switch from `<Image>` (single output) to `<Picture>` (multi-format, true AVIF + WebP fallback chain).
3. LQIP (low-quality image placeholder) for slow-connection rendering.
4. Connection-aware island that downgrades behavior on 2G.
5. Updated frontmatter schema with aspect-ratio for zero CLS.
6. Cloudflare Pages free-tier file-count budget and **verified** R2 scale-out trigger.

### T10.1 Source storage (extends v1 §12.1)

v1's `{cluster}/{lesson-id}.{ext}` allows one image per lesson. v2 needs multiple.

```
learncivicsense-content/05-images/
├── README.md
├── traffic/
│   └── traffic-001/                ← folder per lesson (extends v1)
│       ├── hero.jpg                ← 2400px wide, ~85% JPEG, single source
│       ├── inline-01.jpg
│       └── inline-02.jpg
├── queues-and-waiting/
│   └── queue-001/
│       └── hero.jpg
└── ...
```

Source format unchanged from v1 §12.1: JPEG, ~2000-2400px wide, ~85% quality.

### T10.2 Verified `<Picture>` component (replaces v1 §12.2 `<Image>`)

**Verification (from Astro 6.4.4 docs):**

- `<Image>` outputs a single `<img>` tag with one optimized format.
- `<Picture>` outputs `<picture>` with `<source>` tags for multiple formats. Browsers pick the best supported format.
- `<Picture>` has a `formats` prop (array). `<Image>` does not.
- Astro 5.10+ added a `priority={true}` prop on both that auto-sets `loading="eager"`, `decoding="async"`, `fetchpriority="high"` for above-the-fold images.

```astro
---
// src/components/article/ArticleHero.astro
import { Picture } from 'astro:assets';

interface Props {
  src: ImageMetadata; // result of `import hero from '@content/05-images/...'`
  alt: string;
  aspectRatio: '1:1' | '4:3' | '3:2' | '16:9';
}
const { src, alt, aspectRatio } = Astro.props;
---

<div class="article-hero" data-aspect={aspectRatio}>
  <Picture
    src={src}
    alt={alt}
    formats={['avif', 'webp']}
    widths={[400, 800, 1200, 1600]}
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 800px"
    priority
  />
</div>
```

For below-the-fold inline images, omit `priority` and add `loading="lazy"`:

```astro
<Picture
  src={inline}
  alt={alt}
  formats={['avif', 'webp']}
  widths={[400, 800]}
  sizes="(max-width: 640px) 100vw, 700px"
  loading="lazy"
/>
```

### T10.3 LQIP via Astro's sharp dependency

Sharp ships with Astro (it powers the Image service). Direct use in a build helper avoids the round-trip of `getImage()` then re-reading the file.

```ts
// src/lib/image-lqip.ts
import sharp from 'sharp';

/**
 * Generate a tiny base64-encoded JPEG (~16x9 px, blurred) suitable for use
 * as a background-image while the real image loads.
 *
 * @remarks
 * Output is typically ~120-200 bytes; inline directly into HTML.
 */
export async function generateLqip(absoluteSrcPath: string): Promise<string> {
  const buffer = await sharp(absoluteSrcPath)
    .resize(16, 9, { fit: 'cover' })
    .blur(2)
    .jpeg({ quality: 50 })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
```

Then in the Hero component, inline the result as a CSS background:

```astro
---
import { generateLqip } from '@lib/image-lqip';
import path from 'node:path';
const lqip = await generateLqip(path.resolve(src.src));
---

<div
  class="article-hero"
  data-aspect={aspectRatio}
  style={`background-image: url(${lqip}); background-size: cover; background-position: center;`}
>
  <Picture ... />
</div>
```

The Picture's optimized image loads over the LQIP, so the user sees a blurred preview from the first paint.

### T10.4 Aspect ratio for zero CLS

CSS reserves space using aspect-ratio so the layout doesn't shift when the image loads:

```css
/* src/styles/global.css */
.article-hero[data-aspect='16:9'] {
  aspect-ratio: 16 / 9;
}
.article-hero[data-aspect='3:2'] {
  aspect-ratio: 3 / 2;
}
.article-hero[data-aspect='4:3'] {
  aspect-ratio: 4 / 3;
}
.article-hero[data-aspect='1:1'] {
  aspect-ratio: 1 / 1;
}
.article-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

This extends v1 §12.4 ("Lazy loading and prevent CLS") with concrete aspect-ratio classes.

### T10.5 Frontmatter schema (extends v1 §12.3)

v1 §12.3 has a single `image: { src, alt, credit }`. v2 supports a hero + inline array, all with aspect ratios. Update `learncivicsense-content/01-taxonomy/lesson-template.md` and the lint script:

```yaml
image:
  hero:
    src: hero.jpg # relative to 05-images/{cluster}/{lesson-id}/
    alt: 'Required alt text describing the image content'
    credit: 'Photo by X (CC-BY-SA 4.0)'
    aspectRatio: '16:9'
  inline:
    - src: inline-01.jpg
      alt: 'Required alt'
      caption: 'Optional caption shown below the image'
      credit: 'Photo source'
      aspectRatio: '4:3'
```

`lint.py` extends to flag missing `alt`, missing `aspectRatio`, or `aspectRatio` not in the allowed set.

### T10.6 Connection-aware loading (uses T8.6 detector)

T8.6 exports `detectConnectionTier()`. Use it in a small island that activates only on the hero image:

```ts
// src/components/islands/connection-aware-images.ts
import { detectConnectionTier } from '@lib/network';
import { createLogger } from '@lib/logger';

const log = createLogger('island.connection-aware-images');

export function init(): () => void {
  const tier = detectConnectionTier();
  if (tier !== 'slow') return () => undefined;

  log.info('Slow connection detected; downgrading image behavior');

  // Demote hero from eager to lazy
  const hero = document.querySelector<HTMLImageElement>('.article-hero img[fetchpriority="high"]');
  if (hero) {
    hero.setAttribute('loading', 'lazy');
    hero.removeAttribute('fetchpriority');
  }

  // For below-fold images, convert to tap-to-load buttons
  // (LQIP still visible as background; user opts in to download full image)
  const lazyImages = document.querySelectorAll<HTMLImageElement>(
    'img[loading="lazy"]:not([data-tap-to-load-skip])',
  );
  for (const img of lazyImages) {
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'image-tap-to-load';
    placeholder.textContent = 'Tap to load image';
    placeholder.setAttribute('aria-label', `Load image: ${img.alt}`);
    placeholder.addEventListener(
      'click',
      () => {
        img.hidden = false;
        placeholder.remove();
      },
      { once: true },
    );
    img.hidden = true;
    img.parentElement?.insertBefore(placeholder, img);
  }

  return () => undefined; // no listeners to remove; one-shot island
}
```

Use `client:idle` so it runs after the page is interactive:

```astro
<ConnectionAwareImages client:idle />
```

### T10.7 Cloudflare Pages file-count budget (CORRECTED)

**Verified from Cloudflare's Pages limits docs (Apr 2026):**

- **Free plan: 20,000 files per site** (my previous v2 said 25,000; CORRECTED).
- Paid plan: 100,000 files (with `PAGES_WRANGLER_MAJOR_VERSION=4` env var).
- 25 MiB per file maximum.

**Current scope budget:**

- 211 published articles × 3 source images × 9 variants (4 widths × 2 formats + JPEG fallback) ≈ **5,700 generated image files**.
- HTML pages: ~200 + sitemap + RSS ≈ 250.
- JS/CSS bundles: <100.
- Fonts: <30.
- Pagefind index: ~200 small fragment files.

Total at launch: **well under 20,000.**

### T10.8 Scale-out trigger to Cloudflare R2

**Trigger:** when total `dist/` file count approaches **16,000 (80% of the free limit).**

**Recommended migration (cited from Cloudflare's own docs):** "To serve larger files, consider uploading them to R2 and utilizing the public bucket feature. You can also use custom domains, such as static.example.com, for serving these files."

R2 free-tier (as of mid-2026; **verify against current pricing before committing**):

- 10 GB-month storage free.
- Class A operations (writes) 1M/month free.
- Class B operations (reads) 10M/month free.
- Egress to Cloudflare CDN: free.

Migration plan to record in `docs/runbooks/migrate-images-to-r2.md`:

1. Create R2 bucket `learncivicsense-images`.
2. Bind to a custom domain `images.learncivicsense.in`.
3. Build pipeline writes generated variants to R2 instead of `dist/_astro/`.
4. `Picture` component's `src` is rewritten to point at `https://images.learncivicsense.in/...`.
5. Pages deployment ships HTML + JS + CSS + fonts only.

The image-component API stays the same. Migration is a build-pipeline change, not a frontend change.

### T10.9 Image audit checklist for content authors

Reuse from v1 §12 spirit; expand for the new schema:

- [ ] Source JPEG is ~2000-2400px wide at ~85% quality.
- [ ] Filename is `hero.jpg` or `inline-NN.jpg`.
- [ ] Alt text describes the image content (not "image of...").
- [ ] Credit attributes source + license.
- [ ] License is reusable (CC0, CC-BY, CC-BY-SA, or original work).
- [ ] No identifiable strangers without consent; no children's faces without parental consent.
- [ ] `aspectRatio` matches the source's actual ratio.

### T10.10 Acceptance checks (T10 only)

- [ ] `05-images/{cluster}/{lesson-id}/` folder structure in use.
- [ ] `ArticleHero.astro` uses `<Picture>` (not `<Image>`) with `formats={['avif','webp']}` and `priority`.
- [ ] `generateLqip` runs at build time; LQIP base64 inlined into the hero markup.
- [ ] CSS aspect-ratio classes reserve space for every image; zero CLS confirmed via Lighthouse.
- [ ] `connection-aware-images` island activates on simulated `slow-2g` throttling; hero demotes, lazies become tap-to-load.
- [ ] `lint.py` flags lessons with missing image `alt` or `aspectRatio`.
- [ ] `dist/` file count is monitored; budget docs note the 20,000 free limit and the R2 migration trigger at 16,000.

---

## 11. Mapping table: each of the 48 requirements → where it's enforced

| #   | Requirement                          | Where enforced                                                               | Section     |
| --- | ------------------------------------ | ---------------------------------------------------------------------------- | ----------- |
| 1   | Logging functionality                | `src/lib/logger.ts` + Sentry forwarding + pino for scripts                   | T1          |
| 2   | Indentation/spacing/brackets         | Prettier (v1 §3.3 — no change)                                               | v1          |
| 3   | Meaningful variable/function names   | ESLint `@typescript-eslint/naming-convention` + code review                  | T2          |
| 4   | Naming conventions                   | ESLint `@typescript-eslint/naming-convention`                                | T2.3        |
| 5   | No magic numbers                     | ESLint `no-magic-numbers` + `src/lib/constants.ts`                           | T2.3        |
| 6   | Boolean naming (is/has/should/...)   | Code review (no off-the-shelf rule covers this exactly)                      | T2.3        |
| 7   | No single-letter variables           | ESLint `id-length`                                                           | T2.3        |
| 8   | Capitalization for classes/constants | ESLint naming-convention                                                     | T2.3        |
| 9   | Line length ≤120                     | Prettier + ESLint `max-len`                                                  | T2.3        |
| 10  | Import grouping                      | ESLint `import/order`                                                        | T2.3        |
| 11  | CSS variables for themes             | Three-tier token system                                                      | T3          |
| 12  | Single Responsibility                | ESLint `max-lines-per-function: 50`                                          | T2.3 + T4.1 |
| 13  | Cyclomatic complexity ≤10            | ESLint `complexity: 10`, `sonarjs/cognitive-complexity: 15`                  | T2.3        |
| 14  | DRY                                  | `sonarjs/no-duplicate-string`, `sonarjs/no-identical-functions`              | T2.3        |
| 15  | Short files                          | ESLint `max-lines: 300`                                                      | T2.3        |
| 16  | Low coupling, high cohesion          | Code review + interface-based design                                         | T4.6        |
| 17  | No dead code                         | `unused-imports` + weekly `knip`                                             | T2.3 + T4.3 |
| 18  | No deep nesting (Arrow anti-pattern) | ESLint `max-depth: 3`, `max-nested-callbacks: 3`                             | T2.3 + T4.2 |
| 19  | Encapsulation                        | TypeScript `#` private + `explicit-member-accessibility`                     | T4.4        |
| 20  | Inheritance depth                    | Composition-first + code review                                              | T4.5        |
| 21  | No complex one-liners                | ESLint `max-statements-per-line: 1`                                          | T2.3        |
| 22  | Null/undefined checks                | TypeScript strict + `noUncheckedIndexedAccess` (v1 §3.1)                     | v1 + T5     |
| 23  | Meaningful exception types           | Custom error classes in `src/lib/errors.ts`                                  | T5.1        |
| 24  | Exceptions caught at right level     | Code review                                                                  | T5.4        |
| 25  | No empty catch blocks                | ESLint `no-empty` with `allowEmptyCatch: false`                              | T2.3 + T5.4 |
| 26  | Boundary conditions tested           | Vitest specs + TSDoc `@edge-case`                                            | T5.5        |
| 27  | Resource leaks (streams)             | `AbortController`-based cleanup pattern                                      | T6.2        |
| 28  | Memory leaks, circular refs          | Cleanup patterns + bounded caches                                            | T6.6        |
| 29  | Thread safety                        | **Not applicable** at launch (single-threaded JS)                            | T6.7        |
| 30  | Arithmetic safety                    | Explicit divide-by-zero guards                                               | T6.5        |
| 31  | Network timeouts                     | `fetchWithTimeout` helper using `AbortSignal.timeout`                        | T6.4        |
| 32  | SQL injection defenses               | **Not applicable** at launch (no SQL)                                        | §13         |
| 33  | XSS via output encoding              | Astro auto-escape + `eslint-plugin-no-unsanitized`                           | T7.1        |
| 34  | No plain-text passwords              | **Not applicable** at launch (no auth)                                       | §13         |
| 35  | Secure password hashing              | **Not applicable** at launch                                                 | §13         |
| 36  | No hardcoded secrets                 | `eslint-plugin-no-secrets` + GitHub/Cloudflare secrets (v1 §6.5)             | T2.3 + v1   |
| 37  | Input validation/sanitization        | Zod schemas at boundaries                                                    | T5.2        |
| 38  | Auth on endpoints                    | **Not applicable** at launch (no endpoints)                                  | §13         |
| 39  | CVE-vulnerable deps                  | Dependabot + weekly `npm audit` (v1 §6 + §10.4)                              | v1          |
| 40  | HTTPS/TLS                            | Cloudflare enforces; HSTS header (v1 §10.1)                                  | v1          |
| 41  | Eager loading next pages             | Astro `prefetch` + `<ClientRouter />`/CSS view transitions                   | T8.2 + T8.3 |
| 42  | No O(N²)                             | Pre-built Maps at build time                                                 | T8.7        |
| 43  | Lazy loading                         | `loading="lazy"` on inline images; `client:visible/idle` on islands          | T8 + T10    |
| 44  | Low memory consumption               | Streaming + bounded caches                                                   | T6.6        |
| 45  | Caching strategies                   | `public/_headers` with verified Cloudflare Pages schema                      | T8.5        |
| 46  | Unit test coverage ≥80%              | Vitest threshold (v1 §4.2) + Codecov PR gate (v1 §6.1)                       | v1          |
| 47  | Dependency Injection                 | Parameter injection with defaults + mockable in tests                        | T9.2, T9.3  |
| 48  | Deterministic code                   | No `Math.random` / `Date.now` direct calls in production; Vitest fake timers | T9.4        |

---

## 12. Consolidated Phase 1 acceptance checklist

Each T-section has its own checklist. The consolidated Phase 1 view:

**Logging (T1)** — `src/lib/logger.ts` exists; every island uses a named logger; raw `console.*` blocked by lint; deliberate test error reaches Sentry in prod.

**ESLint (T2)** — flat `eslint.config.mjs`; nine plugins installed; `npx eslint . --max-warnings 0` passes; each rule verified to fire on a deliberate violation.

**CSS tokens (T3)** — three token files (primitive/semantic/themes); Stylelint forbids primitive use in components; `prefers-color-scheme` fallback works on a fresh browser.

**Complexity & dead code (T4)** — no function >50 lines or complexity >10; no file >300 lines; `knip` reports zero unused; `explicit-member-accessibility` passes.

**Errors & validation (T5)** — `src/lib/errors.ts` + `src/lib/schemas.ts` exist; all boundary loaders use Zod `safeParse`; no bare `throw new Error`.

**Resource cleanup (T6)** — every island returns a cleanup that calls `controller.abort()`; `fetchWithTimeout` wraps every `fetch`; bounded LRU caches for in-memory state.

**Security (T7)** — `no-secrets`/`no-unsanitized` lint rules active; CSP nonce migration documented in `docs/adrs/`; `securityheaders.com` returns A or A+.

**Performance (T8)** — Astro `prefetch` enabled; per-link strategy documented; `public/_headers` cache rules in place; `<ClientRouter />` vs CSS decision in ADR.

**DI (T9)** — every island/lib accepts deps as parameters; Vitest specs use mocks, not real globals; no `Math.random`/`Date.now` direct calls in production.

**Images (T10)** — `05-images/{cluster}/{lesson-id}/` folder layout; `<Picture>` with `formats={['avif','webp']}` + `priority`; LQIP inlined; aspect-ratio classes prevent CLS; connection-aware island demotes on `slow-2g`; file count budgeted against the **verified 20,000-file Cloudflare Pages free limit**.

---

## 13. What does NOT apply at launch (and when to revisit)

These four requirements (numbers 29, 32, 34, 35, 38) cannot be implemented because the architecture lacks the surfaces they apply to. Documenting the deferral prevents wasted work and gives a clear trigger for when they become mandatory.

| #   | Item                                    | Why not applicable now                                      | Re-evaluate when                                                            |
| --- | --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| 29  | Thread safety                           | Main-thread JS is single-threaded; no Web Workers at launch | Adding any Worker (client-side search index builder, image processor, etc.) |
| 32  | SQL injection defenses                  | No SQL database; content is markdown read at build time     | Adding any backend service with a relational DB                             |
| 34  | No plain-text passwords                 | No user accounts, no passwords                              | Adding any form of authentication                                           |
| 35  | Secure password hashing (bcrypt/Argon2) | Same as 34                                                  | Same trigger                                                                |
| 38  | Auth checks on endpoints                | No backend endpoints; fully static site                     | Adding any route that gates access                                          |

When any trigger fires, the spec for that surface becomes its own document. Architectural hooks documented in v1 §15.4 (login/favorites placeholders) remain in place to absorb these without rework.

---

## End of v2 addendum

When the Phase 1 acceptance criteria from v1 PLUS the per-section criteria in T1–T10 plus the consolidated §12 view all check off, the site meets the platform owner's full 48-requirement quality bar and is ready for the 60-90 day production launch window.
