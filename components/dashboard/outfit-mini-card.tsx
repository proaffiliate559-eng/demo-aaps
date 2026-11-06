import Link from "next/link";
import { EditorialArt, type GarmentKind, type Tone } from "@/components/landing/editorial-art";
import { formatINR } from "@/lib/utils";
import type { OutfitRow } from "@/lib/outfits/queries";

const TIER_ART: Record<string, { garment: GarmentKind; tone: Tone; label: string }> = {
  safe: { garment: "tee", tone: "ivory", label: "Safe & comfortable" },
  trendy: { garment: "jacket", tone: "sage", label: "Trendy" },
  bold: { garment: "kurta", tone: "blush", label: "Bold" },
};

export function OutfitMiniCard({ outfit }: { outfit: OutfitRow }) {
  const art = TIER_ART[outfit.tier] ?? TIER_ART.safe;
  return (
    <Link href={`/generate/${outfit.request_id}`} className="block overflow-hidden rounded-[1.25rem] border border-border bg-surface transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)]">
    <article>
      <EditorialArt garment={art.garment} tone={art.tone} className="aspect-[4/3] rounded-none" />
      <div className="p-4">
        <p className="eyebrow !text-[0.62rem]">
          {art.label}
          {outfit.is_mock && " · Dev mock"}
        </p>
        <h3 className="mt-1 font-display text-2xl leading-tight">{outfit.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {outfit.mood} · {outfit.occasion}
          {outfit.estimated_budget != null && ` · ${formatINR(outfit.estimated_budget)}`}
        </p>
      </div>
    </article>
    </Link>
  );
}
