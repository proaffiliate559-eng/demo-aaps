/**
 * Proposed subscription plans (INR). Phase 5 moves these into the `plans`
 * table and enforces limits server-side; this file then becomes the seed.
 */
export type PlanId = "free" | "basic" | "pro" | "premium";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceInr: number;
  period: "day" | "month";
  generationLimit: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceInr: 0,
    period: "day",
    generationLimit: 3,
    tagline: "Try your AI stylist",
    features: ["3 outfit generations per day", "Basic recommendations", "Save up to 10 looks", "AI stylist chat (limited)"],
  },
  {
    id: "basic",
    name: "Basic",
    priceInr: 99,
    period: "month",
    generationLimit: 30,
    tagline: "For weekly styling",
    features: ["30 generations per month", "Save up to 100 looks", "Additional styling suggestions", "Digital wardrobe"],
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 199,
    period: "month",
    generationLimit: 100,
    tagline: "Your everyday stylist",
    highlighted: true,
    features: ["100 generations per month", "Advanced styling & personalisation", "Outfit inspiration images", "Priority generation"],
  },
  {
    id: "premium",
    name: "Premium",
    priceInr: 299,
    period: "month",
    generationLimit: 300,
    tagline: "For fashion lovers",
    features: ["300 generations per month", "Everything in Pro", "Premium styling tools", "Early access to virtual try-on"],
  },
];
