import type { Dictionary } from "./en";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Hindi copy. Partial for now — missing keys fall back to English.
 * Fill in as translations are reviewed by a native speaker.
 */
export const hi: DeepPartial<Dictionary> = {
  nav: { home: "होम", login: "लॉगिन", getStarted: "शुरू करें" },
};
