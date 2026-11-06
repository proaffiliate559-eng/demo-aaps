import { z } from "@/lib/zod";
import { SEASONS, WARDROBE_CATEGORIES, values } from "@/lib/config/options";
import { WARDROBE_PATH_RE } from "@/lib/validations/generate";

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max, `${label} must be at most ${max} characters`).nullable(),
  );

export const wardrobeItemSchema = z.object({
  name: z.string().trim().min(1, "Give this item a name").max(80, "Name must be at most 80 characters"),
  category: z.enum(values(WARDROBE_CATEGORIES), { error: "Choose a category" }),
  colour: optionalText(30, "Colour"),
  brand: optionalText(60, "Brand"),
  season: z.preprocess((v) => (v === "" ? null : v), z.enum(values(SEASONS)).nullable()),
  notes: optionalText(500, "Notes"),
  imagePath: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().regex(WARDROBE_PATH_RE, "Invalid image").nullable(),
  ),
});

export type WardrobeItemInput = z.infer<typeof wardrobeItemSchema>;
