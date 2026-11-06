import "server-only";

import { cache } from "react";
import { z } from "@/lib/zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const featureFlagsSchema = z.object({
  image_generation: z.boolean().default(false),
  stylist_chat: z.boolean().default(true),
  wardrobe: z.boolean().default(true),
});
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

const DEFAULTS: FeatureFlags = { image_generation: false, stylist_chat: true, wardrobe: true };

/** Admin-controlled feature switches (app_settings.features). Cached per request. */
export const getFeatureFlags = cache(async (): Promise<FeatureFlags> => {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "features").maybeSingle();
    const parsed = featureFlagsSchema.safeParse(data?.value ?? {});
    return parsed.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
});
