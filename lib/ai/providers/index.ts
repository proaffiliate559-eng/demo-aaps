import "server-only";

import { AiError } from "@/lib/ai/errors";
import { GeminiOutfitProvider } from "@/lib/ai/providers/gemini";
import { MockOutfitProvider } from "@/lib/ai/providers/mock";
import type { OutfitProvider, StylingContext } from "@/lib/ai/types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** Main model followed by configured fallbacks, de-duplicated. */
export function geminiModels() {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return Array.from(new Set([process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, ...fallbacks]));
}

/** Resolve the configured outfit provider. Throws `not_configured` instead of silently mocking. */
export function getOutfitProvider(ctx?: () => StylingContext | null): OutfitProvider {
  const provider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();

  if (provider === "mock") {
    if (process.env.VERCEL_ENV === "production") {
      throw new AiError("not_configured", "mock provider is disabled in production");
    }
    return new MockOutfitProvider(ctx);
  }

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AiError("not_configured", "GEMINI_API_KEY missing");
    return new GeminiOutfitProvider({ apiKey, models: geminiModels() });
  }

  throw new AiError("not_configured", `unknown AI_PROVIDER "${provider}"`);
}
