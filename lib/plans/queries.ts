import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { PLANS, type PlanDefinition, type PlanId } from "@/lib/config/plans";
import type { Database } from "@/types/database";

export interface PlanView {
  slug: string;
  name: string;
  priceInr: number;
  period: "day" | "month";
  generationLimit: number;
  savedLimit: number | null;
  features: string[];
  highlighted: boolean;
  tagline: string;
}

const TAGLINES: Record<string, string> = Object.fromEntries(PLANS.map((p) => [p.id, p.tagline]));

function fromConfig(p: PlanDefinition): PlanView {
  return {
    slug: p.id, name: p.name, priceInr: p.priceInr, period: p.period, generationLimit: p.generationLimit,
    savedLimit: null, features: p.features, highlighted: Boolean(p.highlighted), tagline: p.tagline,
  };
}

/** Active plans from the database (public data). Falls back to the seed config if the DB is unavailable. */
export async function getActivePlans(): Promise<PlanView[]> {
  if (!isSupabaseConfigured()) return PLANS.map(fromConfig);
  try {
    const anon = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await anon.from("plans").select("*").eq("is_active", true).order("sort_order");
    if (error || !data?.length) return PLANS.map(fromConfig);
    return data.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceInr: p.price,
      period: p.period as "day" | "month",
      generationLimit: p.generation_limit,
      savedLimit: p.saved_limit,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
      highlighted: p.slug === "pro",
      tagline: TAGLINES[p.slug as PlanId] ?? "",
    }));
  } catch {
    return PLANS.map(fromConfig);
  }
}
