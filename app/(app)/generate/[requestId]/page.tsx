import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, WandSparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LookCard } from "@/components/outfits/look-card";
import { RegenerateButton } from "@/components/outfits/regenerate-button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { outfitSchema, TIERS } from "@/lib/ai/schemas";
import { isImageGenerationEnabled } from "@/lib/ai/providers/image";
import { getCreditStatus } from "@/lib/usage/queries";
import { BUDGETS, GEN_OCCASIONS, GEN_STYLES, MOODS, WEATHER, labelOf } from "@/lib/config/options";

export const metadata: Metadata = { title: "Your looks" };

export default async function ResultsPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(requestId)) notFound();
  await requireUser(`/generate/${requestId}`);
  const supabase = await createClient();

  const { data: rows } = await supabase.from("outfits").select("*").eq("request_id", requestId);
  if (!rows?.length) notFound(); // also covers other users' requests (RLS)

  const ids = rows.map((r) => r.id);
  const imagesEnabled = await isImageGenerationEnabled();
  const [{ data: saved }, { data: feedback }, credits] = await Promise.all([
    supabase.from("saved_outfits").select("outfit_id").in("outfit_id", ids),
    supabase.from("outfit_feedback").select("outfit_id, rating").in("outfit_id", ids),
    getCreditStatus(),
  ]);
  const savedSet = new Set(saved?.map((s) => s.outfit_id));
  const ratings = new Map(feedback?.map((f) => [f.outfit_id, f.rating]));

  const imagePaths = rows.map((r) => r.generated_image_path).filter((p): p is string => Boolean(p));
  const imageUrls = new Map<string, string>();
  if (imagePaths.length) {
    const { data } = await supabase.storage.from("outfit-images").createSignedUrls(imagePaths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && imageUrls.set(d.path, d.signedUrl));
  }

  const looks = rows
    .map((r) => ({ row: r, look: outfitSchema.safeParse(r.outfit_data) }))
    .filter((x) => x.look.success)
    .sort((a, b) => TIERS.indexOf(a.row.tier as never) - TIERS.indexOf(b.row.tier as never));

  const first = rows[0];
  const req = (first.outfit_data as { request?: Record<string, string> }).request ?? {};
  const isMock = rows.some((r) => r.is_mock);
  const created = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(first.created_at));

  return (
    <div className="container-page max-w-7xl py-8 sm:py-12">
      {isMock && (
        <Alert variant="info" className="mb-8">
          <span className="inline-flex items-center gap-2 font-medium">
            <FlaskConical aria-hidden className="size-4" /> Development mock — not AI.
          </span>{" "}
          These placeholder looks come from the test provider (AI_PROVIDER=mock), not a real AI stylist.
        </Alert>
      )}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your looks · {created}</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Three ways to wear today</h1>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Your request">
            {[
              labelOf(MOODS, first.mood),
              labelOf(GEN_OCCASIONS, first.occasion),
              labelOf(GEN_STYLES, first.style),
              labelOf(WEATHER, first.weather),
              labelOf(BUDGETS, req.budget),
            ].filter(Boolean).map((c) => (
              <li key={c} className="rounded-full border border-border bg-surface px-3 py-1">{c}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button asChild variant="ghost">
            <Link href="/generate"><WandSparkles aria-hidden /> New request</Link>
          </Button>
          {req.mood && (
            <RegenerateButton
              remaining={credits.remaining}
              request={{ mood: req.mood, occasion: req.occasion, style: req.style, weather: req.weather, budget: req.budget }}
            />
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {looks.map(({ row, look }) => (
          <LookCard
            key={row.id}
            id={row.id}
            look={look.data!}
            saved={savedSet.has(row.id)}
            rating={ratings.get(row.id) ?? null}
            imageUrl={row.generated_image_path ? imageUrls.get(row.generated_image_path) ?? null : null}
            imagesEnabled={imagesEnabled}
            isMock={row.is_mock}
          />
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        {isMock ? "Placeholder content for development." : "Recommendations are AI-generated suggestions."} Prices are
        approximate estimates for similar pieces in Indian retail, not live store prices.
      </p>
    </div>
  );
}
