import { z } from "@/lib/zod";

/**
 * Strict schema for AI outfit output. Nothing from the AI reaches the
 * database or UI unless it passes this validation.
 */
const text = (max: number) => z.string().trim().min(1).max(max);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const TIERS = ["safe", "trendy", "bold"] as const;

export const outfitSchema = z.object({
  tier: z.enum(TIERS),
  name: text(80),
  style: text(40),
  description: text(300),
  items: z.object({
    top: text(160),
    bottom: z.string().trim().max(160).nullable(), // null for dresses, sarees, jumpsuits
    footwear: text(160),
    accessories: z.array(text(100)).max(5),
    outerwear: z.string().trim().max(160).nullable().optional(),
  }),
  color_palette: z.array(z.object({ name: text(30), hex })).min(1).max(5),
  styling_explanation: text(600),
  occasion_suitability: text(300),
  estimated_budget_inr: z.number().int().min(0).max(500_000),
  alternatives: z.array(text(160)).max(4),
  styling_tips: z.array(text(200)).min(1).max(5),
});

export const outfitResponseSchema = z
  .object({ outfits: z.array(outfitSchema).length(3) })
  .refine((r) => new Set(r.outfits.map((o) => o.tier)).size === 3, {
    message: "Expected one safe, one trendy and one bold look",
  })
  .transform((r) => ({
    outfits: [...r.outfits].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)),
  }));

export type OutfitRecommendation = z.infer<typeof outfitSchema>;
export type OutfitResponse = z.infer<typeof outfitResponseSchema>;

/**
 * JSON Schema sent to the model to constrain its output (kept to the subset
 * Gemini supports). Zod above remains the source of truth.
 */
const s = (description: string, maxLength?: number) => ({ type: "string", description, ...(maxLength ? { maxLength } : {}) });
export const outfitJsonSchema = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          tier: { type: "string", enum: [...TIERS] },
          name: s("Short evocative outfit name", 80),
          style: s("Style label, e.g. Smart casual", 40),
          description: s("One or two sentences", 300),
          items: {
            type: "object",
            properties: {
              top: s("Topwear with fabric and colour", 160),
              bottom: { type: ["string", "null"], description: "Bottomwear, or null for one-piece garments" },
              footwear: s("Footwear", 160),
              accessories: { type: "array", items: { type: "string" }, maxItems: 5 },
              outerwear: { type: ["string", "null"], description: "Optional layer" },
            },
            required: ["top", "bottom", "footwear", "accessories"],
          },
          color_palette: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              properties: { name: { type: "string" }, hex: s("Hex colour like #1A2B3C") },
              required: ["name", "hex"],
            },
          },
          styling_explanation: s("Why this works for the mood, occasion and weather", 600),
          occasion_suitability: s("How it suits the occasion", 300),
          estimated_budget_inr: { type: "integer", minimum: 0, description: "Approximate total in Indian rupees" },
          alternatives: { type: "array", items: { type: "string" }, maxItems: 4 },
          styling_tips: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
        },
        required: [
          "tier", "name", "style", "description", "items", "color_palette", "styling_explanation",
          "occasion_suitability", "estimated_budget_inr", "alternatives", "styling_tips",
        ],
      },
    },
  },
  required: ["outfits"],
} as const;
