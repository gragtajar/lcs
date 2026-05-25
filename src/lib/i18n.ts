// Tiny i18n helper. Loads the launch locale dictionary and offers a `t(key, vars)` lookup.
// Locale is currently English-only; the dictionary structure leaves room for ICU-style
// plural keys (`articleCount_one`, `articleCount_other`).

import en from '../i18n/en.json' with { type: 'json' };
import { DEFAULT_LOCALE, type Locale } from '../config.ts';

const dictionaries: Record<Locale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
};

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
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];

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

export function formatDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === 'en' ? 'en-IN' : locale;
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
