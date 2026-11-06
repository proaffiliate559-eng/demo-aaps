import { z } from "@/lib/zod";
import {
  AGE_GROUPS, BUDGETS, COLOURS, FITS, GENDER_PREFERENCES, HEIGHT_RANGES, LANGUAGES, MODESTY, OCCASIONS,
  SHOE_SIZES_UK, STYLES, TOP_SIZES, WAIST_SIZES, values,
} from "@/lib/config/options";

const optionalEnum = <T extends [string, ...string[]]>(v: T) =>
  z.preprocess((x) => (x === "" || x === undefined ? null : x), z.enum(v).nullable());

const uniqueArray = <T extends z.ZodType>(item: T, max: number) =>
  z.array(item).max(max).transform((a) => Array.from(new Set(a)));

/** Free-text "other" colour: letters/spaces only, short. */
const customColour = z
  .string()
  .trim()
  .min(2, "Colour name is too short")
  .max(24, "Keep it under 24 characters")
  .regex(/^[\p{L} -]+$/u, "Use letters only");

export const basicSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Tell us what to call you")
    .max(50, "Name must be at most 50 characters")
    .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces, apostrophes or hyphens only"),
  ageGroup: optionalEnum(values(AGE_GROUPS)),
  genderPreference: z.enum(values(GENDER_PREFERENCES), { error: "Choose a styling preference" }),
  country: z.string().trim().min(2, "Enter your country").max(56),
  language: z.enum(values(LANGUAGES)),
});

export const stylesSchema = z.object({
  styles: uniqueArray(z.enum(values(STYLES)), STYLES.length).refine((a) => a.length > 0, "Pick at least one style"),
});

export const coloursSchema = z.object({
  colours: uniqueArray(z.enum(values(COLOURS)), COLOURS.length),
  customColours: uniqueArray(customColour, 3),
}).refine((d) => d.colours.length + d.customColours.length > 0, {
  message: "Pick at least one colour",
  path: ["colours"],
});

export const budgetSchema = z.object({
  budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], { error: "Choose a budget" }),
});

export const occasionsSchema = z.object({
  occasions: uniqueArray(z.enum(values(OCCASIONS)), OCCASIONS.length).refine((a) => a.length > 0, "Pick at least one occasion"),
});

export const fitSchema = z.object({
  preferredFit: optionalEnum(values(FITS)),
  sizes: z
    .object({
      top: optionalEnum([...TOP_SIZES]),
      waist: optionalEnum([...WAIST_SIZES]),
      shoeUk: optionalEnum([...SHOE_SIZES_UK]),
    })
    .default({ top: null, waist: null, shoeUk: null }),
  heightRange: optionalEnum(values(HEIGHT_RANGES)),
  modesty: optionalEnum(values(MODESTY)),
});

/** Whole fashion profile (used by the profile editor). */
export const fashionProfileSchema = z.object({
  basic: basicSchema,
  styles: stylesSchema,
  colours: coloursSchema,
  budget: budgetSchema,
  occasions: occasionsSchema,
  fit: fitSchema,
});

export const ONBOARDING_STEPS = ["basic", "styles", "colours", "budget", "occasions", "fit"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const stepSchemas = {
  basic: basicSchema,
  styles: stylesSchema,
  colours: coloursSchema,
  budget: budgetSchema,
  occasions: occasionsSchema,
  fit: fitSchema,
} satisfies Record<OnboardingStep, z.ZodType>;

export type FashionProfileInput = z.input<typeof fashionProfileSchema>;
export type FashionProfile = z.output<typeof fashionProfileSchema>;
