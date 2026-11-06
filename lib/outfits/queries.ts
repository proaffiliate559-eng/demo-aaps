import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type OutfitRow = Tables<"outfits">;

export async function getRecentOutfits(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase.from("outfits").select("*").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getSavedOutfits(limit = 4) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_outfits")
    .select("created_at, outfits (*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).flatMap((r) => (r.outfits ? [r.outfits] : []));
}
