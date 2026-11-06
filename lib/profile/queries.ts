import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { COLOURS, budgetKeyFromRange } from "@/lib/config/options";
import type { FashionProfile } from "@/lib/validations/profile";
import type { Tables } from "@/types/database";

export type ProfileRow = Tables<"profiles">;
export type PreferencesRow = Tables<"user_preferences">;

const KNOWN_COLOURS = new Set<string>(COLOURS.map((c) => c.value));

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Profile + preferences rows for the signed-in user (RLS-scoped). Cached per request. */
export const getProfileRows = cache(async () => {
  const supabase = await createClient();
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("user_preferences").select("*").maybeSingle(),
  ]);
  return { profile, preferences };
});

/** Map DB rows to the editable form shape (with safe defaults). */
export function toFashionProfile(profile: ProfileRow | null, prefs: PreferencesRow | null): FashionProfile {
  const colours = asStringArray(profile?.favourite_colours);
  const sizes = (prefs?.preferred_sizes ?? {}) as Record<string, string | null | undefined>;
  return {
    basic: {
      displayName: profile?.display_name ?? "",
      ageGroup: (profile?.age_group as FashionProfile["basic"]["ageGroup"]) ?? null,
      genderPreference: (profile?.gender_preference as FashionProfile["basic"]["genderPreference"]) ?? (undefined as never),
      country: profile?.country ?? "India",
      language: (profile?.language as FashionProfile["basic"]["language"]) ?? "en",
    },
    styles: { styles: asStringArray(profile?.preferred_styles) as FashionProfile["styles"]["styles"] },
    colours: {
      colours: colours.filter((c) => KNOWN_COLOURS.has(c)) as FashionProfile["colours"]["colours"],
      customColours: colours.filter((c) => !KNOWN_COLOURS.has(c)),
    },
    budget: { budget: budgetKeyFromRange(profile?.budget_min ?? null, profile?.budget_max ?? null) ?? (undefined as never) },
    occasions: { occasions: asStringArray(prefs?.preferred_occasions) as FashionProfile["occasions"]["occasions"] },
    fit: {
      preferredFit: (prefs?.preferred_fit as FashionProfile["fit"]["preferredFit"]) ?? null,
      sizes: {
        top: (sizes.top as FashionProfile["fit"]["sizes"]["top"]) ?? null,
        waist: (sizes.waist as FashionProfile["fit"]["sizes"]["waist"]) ?? null,
        shoeUk: (sizes.shoeUk as FashionProfile["fit"]["sizes"]["shoeUk"]) ?? null,
      },
      heightRange: (prefs?.height_range as FashionProfile["fit"]["heightRange"]) ?? null,
      modesty: (prefs?.modesty_preference as FashionProfile["fit"]["modesty"]) ?? null,
    },
  };
}

export async function getFashionProfile() {
  const { profile, preferences } = await getProfileRows();
  return { profile, preferences, fashion: toFashionProfile(profile, preferences) };
}
