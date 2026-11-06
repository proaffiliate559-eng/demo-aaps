import type { Metadata } from "next";
import { GenerateWizard } from "@/components/generate/generate-wizard";
import { requireUser } from "@/lib/auth/session";
import { getFashionProfile } from "@/lib/profile/queries";
import { getCreditStatus } from "@/lib/usage/queries";
import { GEN_OCCASIONS, GEN_STYLES, MOODS, WEATHER } from "@/lib/config/options";

export const metadata: Metadata = { title: "Generate outfit" };

const pick = <T extends readonly { value: string }[]>(list: T, v: unknown) =>
  typeof v === "string" && list.some((o) => o.value === v) ? v : null;

// Map profile occasions onto generator options where they differ.
const PROFILE_TO_GEN_OCCASION: Record<string, string> = { date: "date_night", daily_wear: "casual_outing" };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/generate");
  const sp = await searchParams;
  const [{ fashion }, credits] = await Promise.all([getFashionProfile(), getCreditStatus()]);

  const firstOcc = fashion.occasions.occasions[0];
  const initial = {
    mood: pick(MOODS, sp.mood),
    occasion: pick(GEN_OCCASIONS, sp.occasion) ?? pick(GEN_OCCASIONS, PROFILE_TO_GEN_OCCASION[firstOcc] ?? firstOcc),
    style: pick(GEN_STYLES, sp.style) ?? pick(GEN_STYLES, fashion.styles.styles[0]),
    weather: pick(WEATHER, sp.weather),
    budget: fashion.budget.budget ?? null,
  };

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <GenerateWizard
        initial={initial}
        credits={{
          remaining: credits.remaining,
          limit: credits.limit,
          period: credits.period,
          resetsAt: credits.resetsAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
