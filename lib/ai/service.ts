import "server-only";

import { randomUUID } from "node:crypto";
import { AiError } from "@/lib/ai/errors";
import { buildOutfitPrompt, OUTFIT_SYSTEM_PROMPT } from "@/lib/ai/prompts/outfit";
import { getOutfitProvider } from "@/lib/ai/providers";
import { outfitResponseSchema, type OutfitResponse } from "@/lib/ai/schemas";
import type { ImageInput, OutfitProvider, ProviderResult, StylingContext } from "@/lib/ai/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType } from "@/lib/validations/image";
import type { GenerateRequest } from "@/lib/validations/generate";
import type { Json } from "@/types/database";

const BURST_LIMIT_PER_MINUTE = 5;

/** Validate raw model output. Exported for tests. */
export function parseOutfitResponse(raw: unknown): OutfitResponse {
  const parsed = outfitResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError("invalid_response", parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
}

/** Call the provider, validating output; one extra attempt on invalid output. */
export async function generateValidated(
  provider: OutfitProvider,
  input: Parameters<OutfitProvider["generateOutfits"]>[0],
): Promise<{ result: ProviderResult; outfits: OutfitResponse }> {
  let lastError: AiError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await provider.generateOutfits(input);
    try {
      return { result, outfits: parseOutfitResponse(result.raw) };
    } catch (e) {
      lastError = e as AiError;
      console.warn(`[ai] invalid response from ${result.model} (attempt ${attempt + 1}): ${lastError.detail}`);
    }
  }
  throw lastError!;
}

async function loadContext(userId: string, req: GenerateRequest, hasImage: boolean): Promise<StylingContext> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    request: { mood: req.mood, occasion: req.occasion, style: req.style, weather: req.weather, budget: req.budget },
    profile: {
      displayName: profile?.display_name ?? null,
      genderPreference: profile?.gender_preference ?? null,
      ageGroup: profile?.age_group ?? null,
      country: profile?.country ?? "India",
      language: profile?.language ?? "en",
      preferredStyles: arr(profile?.preferred_styles),
      favouriteColours: arr(profile?.favourite_colours),
      preferredFit: prefs?.preferred_fit ?? null,
      sizes: (prefs?.preferred_sizes as Record<string, string | null>) ?? {},
      modesty: prefs?.modesty_preference ?? null,
    },
    hasImage,
  };
}

async function loadImage(userId: string, path: string): Promise<ImageInput> {
  if (!path.startsWith(`${userId}/`)) throw new AiError("bad_request", "image path not owned by user");
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("user-uploads").download(path);
  if (error || !data) throw new AiError("bad_request", "image not found");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const kind = detectImageType(bytes);
  if (!kind) throw new AiError("bad_request", "stored file is not an image");
  return { mimeType: kind.mime, base64: Buffer.from(bytes).toString("base64") };
}

/**
 * Full generation pipeline:
 * resolve provider → reserve credit atomically → call AI → validate → store → mark usage.
 * Any failure marks the reservation as failed, which refunds the credit.
 */
export async function generateOutfitsForUser(userId: string, req: GenerateRequest): Promise<{ requestId: string }> {
  const admin = createAdminClient();
  let ctx: StylingContext | null = null;
  // Resolve first so a missing key never consumes a credit.
  const provider = getOutfitProvider(() => ctx);

  // Burst protection (in addition to the plan quota).
  const { count: recent } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "outfit_generation")
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recent ?? 0) >= BURST_LIMIT_PER_MINUTE) throw new AiError("rate_limited", "burst limit");

  const image = req.imagePath && req.imageConsent ? await loadImage(userId, req.imagePath) : undefined;
  ctx = await loadContext(userId, req, Boolean(image));

  const { data: usageId, error: reserveError } = await admin.rpc("reserve_generation", {
    p_user: userId,
    p_provider: provider.name,
  });
  if (reserveError) throw new AiError("unavailable", `reserve failed: ${reserveError.message}`);
  if (!usageId) throw new AiError("limit_reached");

  try {
    const { result, outfits } = await generateValidated(provider, {
      system: OUTFIT_SYSTEM_PROMPT,
      prompt: buildOutfitPrompt(ctx),
      image,
    });

    const requestId = randomUUID();
    const rows = outfits.outfits.map((o) => ({
      user_id: userId,
      request_id: requestId,
      tier: o.tier,
      name: o.name,
      mood: req.mood,
      occasion: req.occasion,
      style: req.style,
      weather: req.weather,
      description: o.description,
      outfit_data: { ...o, request: { ...ctx!.request, hadImage: Boolean(image) }, model: result.model } as unknown as NonNullable<Json>,
      estimated_budget: o.estimated_budget_inr,
      provider: result.provider,
      is_mock: result.isMock,
    }));
    const { error: insertError } = await admin.from("outfits").insert(rows);
    if (insertError) throw new AiError("unavailable", `store failed: ${insertError.message}`);

    await admin.from("ai_usage").update({ status: "success", provider: `${result.provider}:${result.model}` }).eq("id", usageId);
    return { requestId };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("unavailable", e instanceof Error ? e.message : String(e));
    const status = err.code === "rate_limited" ? "rate_limited" : err.code === "invalid_response" ? "invalid_response" : "error";
    await admin.from("ai_usage").update({ status, error_code: err.code }).eq("id", usageId);
    throw err;
  }
}
