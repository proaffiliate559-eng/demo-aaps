import { z } from "@/lib/zod";
import { BUDGETS, GEN_OCCASIONS, GEN_STYLES, MOODS, WEATHER, values } from "@/lib/config/options";

/** Storage path inside user-uploads: "<uuid>/style/<uuid>.<ext>". */
export const UPLOAD_PATH_RE = /^[0-9a-f-]{36}\/style\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
/** Storage path for wardrobe photos: "<uuid>/wardrobe/<uuid>.<ext>". */
export const WARDROBE_PATH_RE = /^[0-9a-f-]{36}\/wardrobe\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const generateRequestSchema = z
  .object({
    mood: z.enum(values(MOODS), { error: "Choose a mood" }),
    occasion: z.enum(values(GEN_OCCASIONS), { error: "Choose an occasion" }),
    style: z.enum(values(GEN_STYLES), { error: "Choose a style" }),
    weather: z.enum(values(WEATHER), { error: "Choose the weather" }),
    budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], { error: "Choose a budget" }),
    imagePath: z.string().regex(UPLOAD_PATH_RE, "Invalid image").nullish(),
    imageConsent: z.boolean().default(false),
  })
  .refine((d) => !d.imagePath || d.imageConsent, {
    message: "Please confirm you're happy for your photo to be sent to our AI provider",
    path: ["imageConsent"],
  });

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
