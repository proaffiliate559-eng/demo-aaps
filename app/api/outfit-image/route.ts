import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInspirationPrompt, getImageProvider, IMAGE_DAILY_LIMIT, isImageGenerationEnabled } from "@/lib/ai/providers/image";
import { AI_ERROR_STATUS, AiError } from "@/lib/ai/errors";
import { outfitSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ outfitId: z.uuid() });
const err = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

/** Mode A: generate an outfit inspiration image (not a picture of the user). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "unauthorized", "Please sign in again.");

  const provider = getImageProvider();
  if (!provider || !(await isImageGenerationEnabled())) return err(503, "not_configured", "Inspiration images aren't available yet.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err(400, "bad_request", "Invalid request.");

  // RLS: the user can only read their own outfit.
  const { data: outfit } = await supabase
    .from("outfits")
    .select("id, outfit_data, generated_image_path, is_mock")
    .eq("id", parsed.data.outfitId)
    .maybeSingle();
  if (!outfit) return err(404, "not_found", "Outfit not found.");
  if (outfit.is_mock) return err(400, "mock", "Images can't be generated for development mock looks.");

  const admin = createAdminClient();
  if (outfit.generated_image_path) {
    const { data } = await admin.storage.from("outfit-images").createSignedUrl(outfit.generated_image_path, 3600);
    return NextResponse.json({ url: data?.signedUrl });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("feature", "image_generation")
    .eq("status", "success")
    .gte("created_at", since);
  if ((count ?? 0) >= IMAGE_DAILY_LIMIT) {
    return err(402, "limit_reached", `You can create ${IMAGE_DAILY_LIMIT} inspiration images per day.`);
  }

  const look = outfitSchema.safeParse(outfit.outfit_data);
  if (!look.success) return err(422, "bad_outfit", "This outfit can't be visualised.");

  try {
    const img = await provider.generate(buildInspirationPrompt(look.data));
    const ext = img.mimeType === "image/png" ? "png" : img.mimeType === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${outfit.id}.${ext}`;
    const up = await admin.storage.from("outfit-images").upload(path, img.data, { contentType: img.mimeType, upsert: true });
    if (up.error) throw new AiError("unavailable", up.error.message);
    await admin.from("outfits").update({ generated_image_path: path }).eq("id", outfit.id);
    await admin.from("ai_usage").insert({ user_id: user.id, provider: `${provider.name}:${img.model}`, feature: "image_generation", status: "success" });
    const { data } = await admin.storage.from("outfit-images").createSignedUrl(path, 3600);
    return NextResponse.json({ url: data?.signedUrl });
  } catch (e) {
    const ae = e instanceof AiError ? e : new AiError("unavailable", String(e));
    await admin.from("ai_usage").insert({ user_id: user.id, provider: provider.name, feature: "image_generation", status: "error", error_code: ae.code });
    console.error(`[outfit-image] ${ae.code} ${ae.detail ?? ""}`);
    return err(AI_ERROR_STATUS[ae.code], ae.code, ae.userMessage);
  }
}
