"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

type Result = { ok: true; saved?: boolean } | { ok: false; message: string };

const id = z.uuid();

/** Save or unsave a look. RLS ensures the outfit belongs to the user. */
export async function toggleSaveOutfit(outfitId: string, save: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!id.safeParse(outfitId).success) return { ok: false, message: "Invalid outfit." };
  const supabase = await createClient();

  if (save) {
    // Enforce the plan's saved-look limit server-side.
    const [{ count }, { data: quota }] = await Promise.all([
      supabase.from("saved_outfits").select("id", { count: "exact", head: true }),
      supabase.rpc("my_generation_quota").single(),
    ]);
    const { data: plan } = await supabase.from("plans").select("saved_limit").eq("slug", quota?.plan_slug ?? "free").single();
    if (plan?.saved_limit != null && (count ?? 0) >= plan.saved_limit) {
      return { ok: false, message: `Your plan can keep ${plan.saved_limit} saved looks. Remove one to save another.` };
    }
    const { error } = await supabase.from("saved_outfits").insert({ user_id: user.id, outfit_id: outfitId });
    if (error && error.code !== "23505") return { ok: false, message: "Couldn't save this look." };
  } else {
    const { error } = await supabase.from("saved_outfits").delete().eq("outfit_id", outfitId);
    if (error) return { ok: false, message: "Couldn't remove this look." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/saved");
  return { ok: true, saved: save };
}

const ratingSchema = z.object({
  outfitId: id,
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional(),
});

/** Rate a look (1–5) with optional feedback; re-rating updates it. */
export async function rateOutfit(input: z.input<typeof ratingSchema>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a rating from 1 to 5." };
  const supabase = await createClient();
  const { error } = await supabase.from("outfit_feedback").upsert(
    {
      user_id: user.id,
      outfit_id: parsed.data.outfitId,
      rating: parsed.data.rating,
      feedback: parsed.data.feedback || null,
    },
    { onConflict: "user_id,outfit_id" },
  );
  if (error) return { ok: false, message: "Couldn't save your rating." };
  return { ok: true };
}

const reportSchema = z.object({ outfitId: id, reason: z.string().trim().min(3, "Tell us briefly what's wrong").max(500) });

/** Flag an AI recommendation as inappropriate or wrong, for admin review. */
export async function reportOutfit(input: z.input<typeof reportSchema>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid report." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_reports").insert({ reporter_id: user.id, outfit_id: parsed.data.outfitId, reason: parsed.data.reason });
  if (error) return { ok: false, message: "Couldn't send your report." };
  return { ok: true };
}
