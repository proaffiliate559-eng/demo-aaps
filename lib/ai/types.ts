import type { GenerateRequest } from "@/lib/validations/generate";

/** Everything the prompt builder needs. Built from validated input + saved profile only. */
export interface StylingContext {
  request: Omit<GenerateRequest, "imagePath" | "imageConsent">;
  profile: {
    displayName: string | null;
    genderPreference: string | null;
    ageGroup: string | null;
    country: string;
    language: string;
    preferredStyles: string[];
    favouriteColours: string[];
    preferredFit: string | null;
    sizes: Record<string, string | null>;
    modesty: string | null;
  };
  hasImage: boolean;
}

export interface ImageInput {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface ProviderResult {
  /** Parsed JSON from the model — NOT yet validated. */
  raw: unknown;
  provider: string;
  model: string;
  isMock: boolean;
}

export interface OutfitProvider {
  name: string;
  isMock: boolean;
  generateOutfits(input: { system: string; prompt: string; image?: ImageInput }): Promise<ProviderResult>;
}

/** Mode A — outfit inspiration images (not a picture of the user). */
export interface InspirationImageProvider {
  name: string;
  generate(prompt: string): Promise<{ mimeType: "image/png" | "image/jpeg" | "image/webp"; data: Uint8Array; model: string }>;
}

/**
 * Mode B — realistic virtual try-on using the user's photo.
 * Interface only; no provider is connected yet. Results must be labelled
 * as a try-on simulation and require explicit per-request consent.
 */
export interface VirtualTryOnProvider {
  name: string;
  tryOn(input: { personImage: ImageInput; garmentDescription: string }): Promise<{ mimeType: string; data: Uint8Array }>;
}
