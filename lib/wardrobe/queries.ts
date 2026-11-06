import "server-only";

import { createClient } from "@/lib/supabase/server";
import { WARDROBE_CATEGORIES } from "@/lib/config/options";
import type { Tables } from "@/types/database";

export type WardrobeItem = Tables<"wardrobe_items"> & { imageUrl: string | null };

async function withImageUrls(rows: Tables<"wardrobe_items">[]): Promise<WardrobeItem[]> {
  const supabase = await createClient();
  const paths = rows.map((r) => r.image_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("user-uploads").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  }
  return rows.map((r) => ({ ...r, imageUrl: r.image_path ? urls.get(r.image_path) ?? null : null }));
}

/** Escape LIKE wildcards in user search text. */
export function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listWardrobe(filters: { category?: string; q?: string }) {
  const supabase = await createClient();
  let query = supabase.from("wardrobe_items").select("*").order("created_at", { ascending: false }).limit(200);
  if (filters.category && WARDROBE_CATEGORIES.some((c) => c.value === filters.category)) {
    query = query.eq("category", filters.category);
  }
  const q = filters.q?.trim().slice(0, 60);
  if (q) {
    // Commas/parentheses would break PostgREST's or() syntax.
    const term = escapeLike(q.replace(/[,()]/g, " "));
    query = query.or(`name.ilike.%${term}%,colour.ilike.%${term}%,brand.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  const { data } = await query;
  return withImageUrls(data ?? []);
}

export async function countWardrobeByCategory() {
  const supabase = await createClient();
  const { data } = await supabase.from("wardrobe_items").select("category");
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return { total: data?.length ?? 0, counts };
}

export async function getWardrobeItem(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("wardrobe_items").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return (await withImageUrls([data]))[0];
}
