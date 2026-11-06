"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { wardrobeItemSchema } from "@/lib/validations/wardrobe";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";
import { getFeatureFlags } from "@/lib/settings/features";

export type WardrobeFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

const MAX_ITEMS = 500;

function read(formData: FormData) {
  const get = (k: string) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : "");
  return {
    name: get("name"),
    category: get("category"),
    colour: get("colour"),
    brand: get("brand"),
    season: get("season"),
    notes: get("notes"),
    imagePath: get("imagePath"),
  };
}

export async function createWardrobeItem(_prev: WardrobeFormState, formData: FormData): Promise<WardrobeFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  if (!(await getFeatureFlags()).wardrobe) return { status: "error", message: "The wardrobe is currently unavailable." };
  const parsed = wardrobeItemSchema.safeParse(read(formData));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.imagePath && !d.imagePath.startsWith(`${user.id}/`)) return { status: "error", message: "Invalid image." };

  const supabase = await createClient();
  const { count } = await supabase.from("wardrobe_items").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_ITEMS) return { status: "error", message: `Your wardrobe can hold up to ${MAX_ITEMS} items.` };

  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert({
      user_id: user.id,
      name: d.name,
      category: d.category,
      colour: d.colour,
      brand: d.brand,
      season: d.season,
      notes: d.notes,
      image_path: d.imagePath,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "We couldn't add this item. Please try again." };
  revalidatePath("/wardrobe");
  redirect(`/wardrobe?added=${data.id}`);
}

export async function updateWardrobeItem(
  id: string,
  _prev: WardrobeFormState,
  formData: FormData,
): Promise<WardrobeFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  const parsed = wardrobeItemSchema.safeParse(read(formData));
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.imagePath && !d.imagePath.startsWith(`${user.id}/`)) return { status: "error", message: "Invalid image." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("wardrobe_items").select("image_path").eq("id", id).maybeSingle();
  if (!existing) return { status: "error", message: "This item no longer exists." };

  const { error } = await supabase
    .from("wardrobe_items")
    .update({ name: d.name, category: d.category, colour: d.colour, brand: d.brand, season: d.season, notes: d.notes, image_path: d.imagePath })
    .eq("id", id);
  if (error) return { status: "error", message: "We couldn't save your changes. Please try again." };

  // Clean up the replaced/removed photo.
  if (existing.image_path && existing.image_path !== d.imagePath) {
    await supabase.storage.from("user-uploads").remove([existing.image_path]);
  }
  revalidatePath("/wardrobe");
  redirect(`/wardrobe/${id}?saved=1`);
}

export async function deleteWardrobeItem(id: string): Promise<{ ok: false; message: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const supabase = await createClient();
  const { data: deleted, error } = await supabase.from("wardrobe_items").delete().eq("id", id).select("image_path");
  if (error || !deleted?.length) return { ok: false, message: "We couldn't delete this item." };
  if (deleted[0].image_path) await supabase.storage.from("user-uploads").remove([deleted[0].image_path]);
  revalidatePath("/wardrobe");
  redirect("/wardrobe?deleted=1");
}
