// Tiny i18n helper. Loads the launch locale dictionary and offers a `t(key, vars)` lookup.
// Locale is currently English-only; the dictionary structure leaves room for ICU-style
// plural keys (`articleCount_one`, `articleCount_other`).

import en from '../i18n/en.json' with { type: 'json' };
import hi from '../i18n/hi.json' with { type: 'json' };
import ta from '../i18n/ta.json' with { type: 'json' };
import bn from '../i18n/bn.json' with { type: 'json' };
import mr from '../i18n/mr.json' with { type: 'json' };
import te from '../i18n/te.json' with { type: 'json' };
import pa from '../i18n/pa.json' with { type: 'json' };
import gu from '../i18n/gu.json' with { type: 'json' };
import { DEFAULT_LOCALE, type Locale } from '../config.ts';

// All 8 locale dictionaries are registered now so the locale router (Phase 3)
// won't crash on a missing file. The 7 non-English ones are stubs carrying
// `_translated: false`; until a stub is translated, lookups fall back to English.
// Keyed by string (not Locale) because the routing Locale union stays `'en'`
// until the router goes live — widening it is the follow-up at that point.
const dictionaries: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  hi: hi as Record<string, unknown>,
  ta: ta as Record<string, unknown>,
  bn: bn as Record<string, unknown>,
  mr: mr as Record<string, unknown>,
  te: te as Record<string, unknown>,
  pa: pa as Record<string, unknown>,
  gu: gu as Record<string, unknown>,
};

/** A locale dictionary is usable only when explicitly marked translated. */
function isTranslated(dict: Record<string, unknown> | undefined): boolean {
  return !!dict && dict._translated !== false;
}

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function t(
  key: string,
  vars: Record<string, string | number> = {},
  locale: Locale = DEFAULT_LOCALE,
): string {
  // Use the requested locale only when its dictionary is marked translated;
  // otherwise fall back to English so untranslated stubs never show their
  // (English-copied) placeholder values as if they were localised.
  const requested = dictionaries[locale];
  const dict =
    (isTranslated(requested) ? requested : dictionaries[DEFAULT_LOCALE]) ??
    (en as Record<string, unknown>);

  // Plural-suffix fallback: caller may pass a `count` var; pick `_one`/`_other` variant.
  let resolvedKey = key;
  if ('count' in vars) {
    const oneKey = `${key}_one`;
    const otherKey = `${key}_other`;
    resolvedKey = vars.count === 1 ? oneKey : otherKey;
    if (!lookup(dict, resolvedKey)) resolvedKey = key;
  }

  const template = lookup(dict, resolvedKey) ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    return name in vars ? String(vars[name]) : `{${name}}`;
  });
}

/**
 * Renders an ISO `YYYY-MM-DD` date for display next to article metadata.
 *
 * For English, the house style is `Mmm DD, YYYY` with a zero-padded day,
 * e.g. `Jun 04, 2026` (matches the convention documented in
 * `learncivicsense-content/01-taxonomy/lesson-template.md`). The en-US locale
 * via Intl drops the leading zero on the day, so we assemble the string
 * manually for English.
 *
 * For other locales, we defer to `Intl.DateTimeFormat` with the locale tag
 * so dates render natively (e.g. Hindi will pick up Devanagari numerals when
 * appropriate). The version chip is appended by the caller via the
 * `list.lastUpdatedWithVersion` template.
 */
export function formatDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  if (locale === 'en') {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    // Use UTC parts so an ISO date like "2026-06-04" doesn't shift by a day
    // depending on the build server's timezone.
    const month = months[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${month} ${day}, ${year}`;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(d);
}
