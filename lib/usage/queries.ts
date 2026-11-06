import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CreditStatus {
  planSlug: string;
  planName: string;
  period: "day" | "month";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date | null;
}

/**
 * Credit summary for display. Uses the same Postgres function that enforces
 * the limit (public.generation_quota), so display and enforcement agree.
 */
export const getCreditStatus = cache(async (): Promise<CreditStatus> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_generation_quota").single();
  const limit = data?.lim ?? 3;
  const used = data?.used ?? 0;
  return {
    planSlug: data?.plan_slug ?? "free",
    planName: data?.plan_name ?? "Free",
    period: (data?.period as "day" | "month") ?? "day",
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: data?.resets_at ? new Date(data.resets_at) : null,
  };
});
