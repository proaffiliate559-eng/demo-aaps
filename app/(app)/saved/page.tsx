import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Heart, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EditorialArt, type GarmentKind, type Tone } from "@/components/landing/editorial-art";
import { RemoveSavedButton } from "@/components/outfits/remove-saved-button";
import { ShareButton } from "@/components/outfits/look-actions";
import { shareText } from "@/components/outfits/look-card";
import { createClient } from "@/lib/supabase/server";
import { outfitSchema } from "@/lib/ai/schemas";
import { getCreditStatus } from "@/lib/usage/queries";
import { GEN_OCCASIONS, GEN_STYLES, MOODS, labelOf } from "@/lib/config/options";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved looks" };

const TIER_ART: Record<string, { garment: GarmentKind; tone: Tone; label: string }> = {
  safe: { garment: "tee", tone: "ivory", label: "Safe" },
  trendy: { garment: "jacket", tone: "sage", label: "Trendy" },
  bold: { garment: "kurta", tone: "blush", label: "Bold" },
};

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const style = typeof sp.style === "string" && GEN_STYLES.some((s) => s.value === sp.style) ? sp.style : "";
  const occasion = typeof sp.occasion === "string" && GEN_OCCASIONS.some((o) => o.value === sp.occasion) ? sp.occasion : "";

  const supabase = await createClient();
  let query = supabase
    .from("saved_outfits")
    .select("created_at, outfits!inner (*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (style) query = query.eq("outfits.style", style);
  if (occasion) query = query.eq("outfits.occasion", occasion);

  const [{ data }, { count: total }, credits] = await Promise.all([
    query,
    supabase.from("saved_outfits").select("id", { count: "exact", head: true }),
    getCreditStatus(),
  ]);
  const { data: plan } = await supabase.from("plans").select("saved_limit").eq("slug", credits.planSlug).single();

  const rows = (data ?? []).flatMap((r) => {
    const look = outfitSchema.safeParse(r.outfits.outfit_data);
    return look.success ? [{ savedAt: r.created_at, outfit: r.outfits, look: look.data }] : [];
  });
  const fmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  const filtered = Boolean(style || occasion);

  return (
    <div className="container-page max-w-6xl py-8 sm:py-12">
      <PageHeader
        eyebrow="Saved looks"
        title="Your lookbook"
        description={
          plan?.saved_limit != null
            ? `${total ?? 0} of ${plan.saved_limit} saved on the ${credits.planName} plan.`
            : `${total ?? 0} saved looks.`
        }
      />

      {(total ?? 0) > 0 && (
        <form action="/saved" className="mt-8 flex flex-wrap items-end gap-3" aria-label="Filter saved looks">
          <label className="w-44 space-y-1.5 text-sm">
            <span className="text-muted-foreground">Style</span>
            <NativeSelect name="style" defaultValue={style} aria-label="Style">
              <option value="">All styles</option>
              {GEN_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </NativeSelect>
          </label>
          <label className="w-44 space-y-1.5 text-sm">
            <span className="text-muted-foreground">Occasion</span>
            <NativeSelect name="occasion" defaultValue={occasion} aria-label="Occasion">
              <option value="">All occasions</option>
              {GEN_OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </label>
          <Button type="submit" variant="outline">Apply</Button>
          {filtered && (
            <Button asChild variant="ghost"><Link href="/saved"><X aria-hidden /> Clear</Link></Button>
          )}
        </form>
      )}

      <div className="mt-8">
        {(total ?? 0) === 0 ? (
          <EmptyState icon={Heart} title="No saved looks yet" body="Tap Save on any recommendation to build your lookbook.">
            <Button asChild><Link href="/generate">Generate outfits</Link></Button>
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon={Heart} title="No looks match these filters" body="Try another style or occasion.">
            <Button asChild variant="outline"><Link href="/saved">Clear filters</Link></Button>
          </EmptyState>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Saved looks">
            {rows.map(({ outfit, look }) => {
              const art = TIER_ART[outfit.tier] ?? TIER_ART.safe;
              return (
                <li key={outfit.id}>
                  <article className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border bg-surface">
                    <EditorialArt garment={art.garment} tone={art.tone} className="h-32 rounded-none" />
                    <div className="flex flex-1 flex-col p-5">
                      <p className="eyebrow !text-[0.62rem]">
                        {art.label} · {labelOf(MOODS, outfit.mood)} · {labelOf(GEN_OCCASIONS, outfit.occasion)}
                        {outfit.is_mock && " · Dev mock"}
                      </p>
                      <h2 className="mt-2 font-display text-2xl leading-tight">{look.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{look.description}</p>
                      <div className="mt-3 flex -space-x-1" aria-label={`Colours: ${look.color_palette.map((c) => c.name).join(", ")}`}>
                        {look.color_palette.map((c) => (
                          <span key={c.hex + c.name} aria-hidden className="size-5 rounded-full border-2 border-surface" style={{ background: c.hex }} />
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {labelOf(GEN_STYLES, outfit.style)} · {formatINR(look.estimated_budget_inr)} · Generated {fmt.format(new Date(outfit.created_at))}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/generate/${outfit.request_id}`}>View <ArrowUpRight aria-hidden /></Link>
                        </Button>
                        <ShareButton title={look.name} text={shareText(look)} />
                        <RemoveSavedButton outfitId={outfit.id} name={look.name} />
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
