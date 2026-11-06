import { en, type Dictionary } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";
import { DEFAULT_LOCALE, type Locale } from "./config";

function deepMerge<T>(base: T, override: unknown): T {
  if (Array.isArray(base) || typeof base !== "object" || base === null) {
    return (override ?? base) as T;
  }
  if (typeof override !== "object" || override === null) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], v);
  }
  return out as T;
}

const dictionaries: Record<Locale, Dictionary> = {
  en,
  hi: deepMerge(en, hi),
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type { Dictionary };
