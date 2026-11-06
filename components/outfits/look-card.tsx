import { CircleDollarSign } from "lucide-react";
import { EditorialArt, type GarmentKind, type Tone } from "@/components/landing/editorial-art";
import { InspirationImage, RatingControl, SaveButton, ShareButton } from "@/components/outfits/look-actions";
import { ReportButton } from "@/components/outfits/report-button";
import type { OutfitRecommendation } from "@/lib/ai/schemas";
import { formatINR } from "@/lib/utils";

const TIER: Record<string, { label: string; garment: GarmentKind; tone: Tone }> = {
  safe: { label: "Look 01 · Safe & comfortable", garment: "tee", tone: "ivory" },
  trendy: { label: "Look 02 · Trendy & fashionable", garment: "jacket", tone: "sage" },
  bold: { label: "Look 03 · Bold & experimental", garment: "kurta", tone: "blush" },
};

export function shareText(o: OutfitRecommendation) {
  const pieces = [o.items.top, o.items.bottom, o.items.outerwear, o.items.footwear, ...o.items.accessories].filter(Boolean);
  return `${o.name} — ${o.description}\n\n• ${pieces.join("\n• ")}\n\nApprox. ${formatINR(o.estimated_budget_inr)}\nStyled with StyleMood AI`;
}

export function LookCard({
  id,
  look,
  saved,
  rating,
  imageUrl,
  imagesEnabled,
  isMock,
}: {
  id: string;
  look: OutfitRecommendation;
  saved: boolean;
  rating: number | null;
  imageUrl: string | null;
  imagesEnabled: boolean;
  isMock: boolean;
}) {
  const t = TIER[look.tier] ?? TIER.safe;
  const rows: [string, string | null | undefined][] = [
    ["Top", look.items.top],
    ["Bottom", look.items.bottom],
    ["Layer", look.items.outerwear],
    ["Footwear", look.items.footwear],
    ["Accessories", look.items.accessories.join(", ")],
  ];
  return (
    <article className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface" data-testid={`look-${look.tier}`}>
      {imageUrl ? null : <EditorialArt garment={t.garment} tone={t.tone} className="h-28 rounded-none sm:h-auto sm:aspect-[16/9]" />}
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow !text-[0.65rem]">{t.label}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight">{look.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{look.description}</p>

        <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {look.color_palette.map((c) => (
            <span key={c.hex + c.name} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
              <span aria-hidden className="size-3.5 rounded-full border border-black/10" style={{ background: c.hex }} />
              {c.name}
            </span>
          ))}
        </div>

        <p className="mt-5 flex items-center gap-2 text-sm">
          <CircleDollarSign aria-hidden className="size-4 text-sand" />
          <span className="text-muted-foreground">Estimated</span>
          <span className="font-medium">{formatINR(look.estimated_budget_inr)}</span>
        </p>

        <details className="group mt-5 rounded-2xl bg-muted/70 p-4 text-sm">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            Why it works & styling tips <span className="text-muted-foreground group-open:hidden">+</span>
          </summary>
          <div className="mt-3 space-y-3 leading-relaxed text-foreground/85">
            <p>{look.styling_explanation}</p>
            <p><span className="font-medium">Occasion: </span>{look.occasion_suitability}</p>
            {look.styling_tips.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {look.styling_tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            )}
            {look.alternatives.length > 0 && (
              <div>
                <p className="font-medium">Swap ideas</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {look.alternatives.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        </details>

        {imagesEnabled && !isMock && (
          <div className="mt-5">
            <InspirationImage outfitId={id} initialUrl={imageUrl} name={look.name} />
          </div>
        )}

        <div className="mt-auto space-y-4 pt-6">
          <RatingControl outfitId={id} initial={rating} />
          <div className="flex flex-wrap gap-2">
            <SaveButton outfitId={id} initialSaved={saved} name={look.name} />
            <ShareButton title={look.name} text={shareText(look)} />
          </div>
          <ReportButton outfitId={id} />
        </div>
      </div>
    </article>
  );
}
