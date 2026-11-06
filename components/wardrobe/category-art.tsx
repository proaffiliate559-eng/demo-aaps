import { EditorialArt, type GarmentKind, type Tone } from "@/components/landing/editorial-art";

const MAP: Record<string, { garment: GarmentKind; tone: Tone }> = {
  shirts: { garment: "tee", tone: "ivory" },
  t_shirts: { garment: "tee", tone: "sand" },
  trousers: { garment: "trousers", tone: "sand" },
  jeans: { garment: "trousers", tone: "sage" },
  jackets: { garment: "jacket", tone: "ink" },
  dresses: { garment: "dress", tone: "blush" },
  skirts: { garment: "dress", tone: "ivory" },
  shoes: { garment: "sneaker", tone: "sage" },
  accessories: { garment: "bag", tone: "sand" },
  traditional: { garment: "kurta", tone: "blush" },
};

export function CategoryArt({ category, className }: { category: string; className?: string }) {
  const m = MAP[category] ?? MAP.t_shirts;
  return <EditorialArt garment={m.garment} tone={m.tone} className={className} />;
}
