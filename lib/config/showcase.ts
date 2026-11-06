import type { GarmentKind, Tone } from "@/components/landing/editorial-art";

/**
 * Static, clearly labelled illustration of the recommendation format shown on
 * the marketing page. NOT AI output and never shown as a user's result.
 */
export interface ShowcaseLook {
  tier: string;
  name: string;
  description: string;
  items: { label: string; value: string }[];
  palette: { name: string; hex: string }[];
  budgetInr: number;
  garment: GarmentKind;
  tone: Tone;
}

export const SHOWCASE_LOOKS: ShowcaseLook[] = [
  {
    tier: "Look 01 · Safe & comfortable",
    name: "Easy Linen Day",
    description: "Breathable and polished — confident without trying too hard.",
    items: [
      { label: "Top", value: "White linen-blend shirt, sleeves rolled" },
      { label: "Bottom", value: "Beige straight-fit chinos" },
      { label: "Footwear", value: "White canvas sneakers" },
      { label: "Accessories", value: "Tan leather strap watch" },
    ],
    palette: [
      { name: "White", hex: "#f7f5f0" },
      { name: "Beige", hex: "#d8c7ac" },
      { name: "Tan", hex: "#a8794f" },
    ],
    budgetInr: 1600,
    garment: "tee",
    tone: "ivory",
  },
  {
    tier: "Look 02 · Trendy & fashionable",
    name: "Campus Co-ord",
    description: "A relaxed co-ord set with a Korean-inspired oversized silhouette.",
    items: [
      { label: "Top", value: "Sage oversized cotton overshirt" },
      { label: "Bottom", value: "Matching wide-leg trousers" },
      { label: "Footwear", value: "Chunky white trainers" },
      { label: "Accessories", value: "Canvas tote, silver hoops" },
    ],
    palette: [
      { name: "Sage", hex: "#b6c0a3" },
      { name: "Cream", hex: "#efe9dc" },
      { name: "Silver", hex: "#c3c4c6" },
    ],
    budgetInr: 1900,
    garment: "jacket",
    tone: "sage",
  },
  {
    tier: "Look 03 · Bold & experimental",
    name: "Indo-Western Edge",
    description: "A short printed kurta over black denim — festive energy, street attitude.",
    items: [
      { label: "Top", value: "Rust block-print short kurta" },
      { label: "Bottom", value: "Black slim-fit jeans" },
      { label: "Footwear", value: "Black leather kolhapuris" },
      { label: "Accessories", value: "Oxidised silver bracelet" },
    ],
    palette: [
      { name: "Rust", hex: "#b4552d" },
      { name: "Black", hex: "#1d1a17" },
      { name: "Oxidised", hex: "#8a8a85" },
    ],
    budgetInr: 1800,
    garment: "kurta",
    tone: "blush",
  },
];

export const FAQS = [
  {
    q: "Do I have to upload a photo?",
    a: "No. Photos are optional. Without one, StyleMood uses your mood, occasion, weather, budget and fashion profile. If you choose to add a photo, we ask for your consent before it is sent to our AI provider for styling context.",
  },
  {
    q: "What happens to my photos?",
    a: "Photos are stored in private storage that only your account can access, through short-lived secure links. We never use photos to infer sensitive traits such as religion, ethnicity or health. You can delete any photo — or your whole account and data — from Settings at any time.",
  },
  {
    q: "Is the outfit image a preview of how I'll look?",
    a: "No. Outfit images are inspiration visuals that illustrate the recommended look. They are not a realistic virtual try-on of you. A dedicated try-on feature may come later and will be clearly labelled.",
  },
  {
    q: "Does StyleMood work for everyone?",
    a: "Yes. StyleMood supports men's, women's and gender-neutral styling, and you choose your own styling preference — including modesty and fit preferences — in your profile.",
  },
  {
    q: "How much does it cost?",
    a: "Every account starts free with 3 outfit generations per day. Paid plans from ₹99/month add more generations and advanced styling once payments go live.",
  },
  {
    q: "Will StyleMood be available in Hindi?",
    a: "English is available today. The app is built for multiple languages and Hindi support is on our roadmap.",
  },
  {
    q: "Are the prices shown real?",
    a: "Budget estimates are approximate ranges in ₹ for similar pieces in Indian retail, to help you plan. They are not live prices from a specific store.",
  },
];
