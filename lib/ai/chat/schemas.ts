import { z } from "@/lib/zod";
import { GEN_OCCASIONS, GEN_STYLES, MOODS, WEATHER, values } from "@/lib/config/options";

export const CHAT_MESSAGE_MAX = 1000;

export const chatRequestSchema = z.object({
  conversationId: z.uuid().nullish(),
  message: z
    .string()
    .trim()
    .min(1, "Type a message")
    .max(CHAT_MESSAGE_MAX, `Keep messages under ${CHAT_MESSAGE_MAX} characters`),
});

/** Validated stylist reply. `generate` lets the UI offer a one-tap full outfit generation. */
export const chatReplySchema = z.object({
  reply: z.string().trim().min(1).max(3000),
  suggestions: z.array(z.string().trim().min(1).max(90)).max(3).default([]),
  generate: z
    .object({
      mood: z.enum(values(MOODS)),
      occasion: z.enum(values(GEN_OCCASIONS)),
      style: z.enum(values(GEN_STYLES)),
      weather: z.enum(values(WEATHER)).nullable().optional(),
    })
    .nullable()
    .optional()
    .catch(null), // an invalid suggestion is dropped, not fatal
});

export type ChatReply = z.infer<typeof chatReplySchema>;

export const chatReplyJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Your answer to the user, friendly and concise (under 180 words). Plain text, no markdown headings." },
    suggestions: {
      type: "array",
      maxItems: 3,
      items: { type: "string", description: "Short follow-up question the USER might ask next (under 12 words)" },
    },
    generate: {
      type: ["object", "null"],
      description: "Only when the user wants complete outfit ideas for a specific situation; otherwise null.",
      properties: {
        mood: { type: "string", enum: values(MOODS) },
        occasion: { type: "string", enum: values(GEN_OCCASIONS) },
        style: { type: "string", enum: values(GEN_STYLES) },
        weather: { type: ["string", "null"], enum: [...values(WEATHER), null] },
      },
      required: ["mood", "occasion", "style"],
    },
  },
  required: ["reply", "suggestions", "generate"],
} as const;
