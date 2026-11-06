import "server-only";

import { AiError } from "@/lib/ai/errors";
import { classifyGeminiHttp } from "@/lib/ai/providers/gemini";
import type { InspirationImageProvider } from "@/lib/ai/types";
import type { OutfitRecommendation } from "@/lib/ai/schemas";

/** Mode A: inspiration image of the OUTFIT (flat-lay / mannequin), never of the user. */
export function buildInspirationPrompt(o: OutfitRecommendation) {
  const pieces = [o.items.top, o.items.bottom, o.items.outerwear, o.items.footwear, ...o.items.accessories].filter(Boolean);
  return [
    "Editorial fashion flat-lay photograph on a warm off-white paper background, soft natural light, minimal and premium.",
    `Outfit "${o.name}" (${o.style}): ${pieces.join("; ")}.`,
    `Colour palette: ${o.color_palette.map((c) => c.name).join(", ")}.`,
    "Show only the garments and accessories neatly arranged. No people, no faces, no body, no text, no logos, no watermarks.",
  ].join(" ");
}

export class GeminiImageProvider implements InspirationImageProvider {
  name = "gemini-image";
  constructor(private apiKey: string, private model: string, private fetchImpl: typeof fetch = fetch) {}

  async generate(prompt: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    let res: Response;
    try {
      res = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
          }),
          signal: controller.signal,
        },
      );
    } catch (e) {
      if (controller.signal.aborted) throw new AiError("timeout", "image");
      throw new AiError("network", String(e));
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw classifyGeminiHttp(res.status, body);
    const part = body?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
    if (!part) throw new AiError("invalid_response", "no image returned");
    const mime = part.inlineData.mimeType as string;
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new AiError("invalid_response", `mime ${mime}`);
    return {
      mimeType: mime as "image/png" | "image/jpeg" | "image/webp",
      data: new Uint8Array(Buffer.from(part.inlineData.data, "base64")),
      model: this.model,
    };
  }
}

/** Returns the image provider, or null when not configured. Also gated by the admin flag (see isImageGenerationEnabled). */
export function getImageProvider(): InspirationImageProvider | null {
  const kind = (process.env.IMAGE_PROVIDER ?? "none").toLowerCase();
  if (kind === "gemini" && process.env.GEMINI_API_KEY) {
    return new GeminiImageProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image");
  }
  return null;
}

export const IMAGE_DAILY_LIMIT = Number(process.env.IMAGE_DAILY_LIMIT ?? 5);

/** Provider configured AND switched on by an admin. */
export async function isImageGenerationEnabled() {
  if (!getImageProvider()) return false;
  const { getFeatureFlags } = await import("@/lib/settings/features");
  return (await getFeatureFlags()).image_generation;
}
