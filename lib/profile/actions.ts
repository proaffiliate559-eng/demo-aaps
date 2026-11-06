"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeUserFiles } from "@/lib/storage/cleanup";
import { getCurrentUser } from "@/lib/auth/session";
import { BUDGETS } from "@/lib/config/options";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";
import { ONBOARDING_STEPS, stepSchemas, type OnboardingStep } from "@/lib/validations/profile";
import type { TablesUpdate } from "@/types/database";

export type SaveResult = { ok: true } | { ok: false; message?: string; fieldErrors?: FieldErrors };

/** Flatten nested Zod paths ("sizes.top") so the UI can show them per field. */
function flatErrors(error: import("zod").ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return Object.keys(out).length ? out : toFieldErrors(error);
}

async function writeSection(step: OnboardingStep, input: unknown, userId: string): Promise<SaveResult> {
  const parsed = stepSchemas[step].safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flatErrors(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();

  let profileUpdate: TablesUpdate<"profiles"> | null = null;
  let prefsUpdate: TablesUpdate<"user_preferences"> | null = null;

  switch (step) {
    case "basic": {
      const b = d as import("zod").infer<typeof stepSchemas.basic>;
      profileUpdate = {
        display_name: b.displayName,
        age_group: b.ageGroup,
        gender_preference: b.genderPreference,
        country: b.country,
        language: b.language,
      };
      break;
    }
    case "styles":
      profileUpdate = { preferred_styles: (d as { styles: string[] }).styles };
      break;
    case "colours": {
      const c = d as { colours: string[]; customColours: string[] };
      profileUpdate = { favourite_colours: [...c.colours, ...c.customColours] };
      break;
    }
    case "budget": {
      const range = BUDGETS.find((b) => b.value === (d as { budget: string }).budget)!;
      profileUpdate = { budget_min: range.min, budget_max: range.max };
      break;
    }
    case "occasions":
      prefsUpdate = { preferred_occasions: (d as { occasions: string[] }).occasions };
      break;
    case "fit": {
      const f = d as import("zod").infer<typeof stepSchemas.fit>;
      prefsUpdate = {
        preferred_fit: f.preferredFit,
        preferred_sizes: f.sizes,
        height_range: f.heightRange,
        modesty_preference: f.modesty,
      };
      break;
    }
  }

  if (profileUpdate) {
    const { error, count } = await supabase
      .from("profiles")
      .update(profileUpdate, { count: "exact" })
      .eq("id", userId);
    if (error || count === 0) return { ok: false, message: "We couldn't save your profile. Please try again." };
  }
  if (prefsUpdate) {
    const { error, count } = await supabase
      .from("user_preferences")
      .update(prefsUpdate, { count: "exact" })
      .eq("user_id", userId);
    if (error || count === 0) return { ok: false, message: "We couldn't save your preferences. Please try again." };
  }
  return { ok: true };
}

/** Save one onboarding step. Called after each "Continue". */
export async function saveOnboardingStep(step: OnboardingStep, input: unknown): Promise<SaveResult> {
  if (!ONBOARDING_STEPS.includes(step)) return { ok: false, message: "Unknown step." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };
  return writeSection(step, input, user.id);
}

/** Mark onboarding complete (only after the required steps have data). */
export async function completeOnboarding(): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, gender_preference, preferred_styles, favourite_colours, budget_min")
    .eq("id", user.id)
    .single();
  const missing =
    !profile?.display_name ||
    !profile.gender_preference ||
    !(profile.preferred_styles as unknown[]).length ||
    !(profile.favourite_colours as unknown[]).length ||
    profile.budget_min === null;
  if (missing) return { ok: false, message: "A few required answers are missing. Please go back and complete them." };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, message: "We couldn't finish onboarding. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Save one section from the profile editor. */
export async function updateProfileSection(step: OnboardingStep, input: unknown): Promise<SaveResult> {
  const res = await saveOnboardingStep(step, input);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

/**
 * Permanently delete the signed-in user's account and all their data.
 * Rows cascade from auth.users; stored images are removed first.
 */
export async function deleteAccount(_prev: SaveResult | null, formData: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };
  if (formData.get("confirm") !== "DELETE") {
    return { ok: false, fieldErrors: { confirm: 'Type DELETE in capitals to confirm' } };
  }

  const admin = createAdminClient();
  // Remove every file under the user's folder in every bucket (including subfolders).
  await removeUserFiles(admin, user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, message: "We couldn't delete your account. Please try again or contact support." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
