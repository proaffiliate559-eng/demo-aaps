import "server-only";

import { AiError } from "@/lib/ai/errors";
import { GeminiJsonClient, type GeminiContent } from "@/lib/ai/providers/gemini";
import { geminiModels } from "@/lib/ai/providers";
import { chatReplyJsonSchema } from "@/lib/ai/chat/schemas";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatProvider {
  name: string;
  isMock: boolean;
  reply(input: { system: string; history: ChatTurn[] }): Promise<{ raw: unknown; model: string }>;
}

class GeminiChatProvider implements ChatProvider {
  name = "gemini";
  isMock = false;
  constructor(private client: GeminiJsonClient) {}
  async reply({ system, history }: { system: string; history: ChatTurn[] }) {
    const contents: GeminiContent[] = history.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));
    return this.client.generateJson({ system, contents, schema: chatReplyJsonSchema, temperature: 0.7, maxOutputTokens: 2048 });
  }
}

/** DEVELOPMENT MOCK — fixed, clearly labelled reply. Requires AI_PROVIDER=mock. */
class MockChatProvider implements ChatProvider {
  name = "mock";
  isMock = true;
  async reply({ history }: { system: string; history: ChatTurn[] }) {
    const last = history.at(-1)?.content ?? "";
    return {
      raw: {
        reply: `[Development mock — not AI] You asked: "${last.slice(0, 80)}". Connect an AI provider for real styling advice.`,
        suggestions: ["What shoes would go with that?", "Make it more festive"],
        generate: { mood: "relaxed", occasion: "party", style: "streetwear", weather: null },
      },
      model: "mock",
    };
  }
}

export function getChatProvider(): ChatProvider {
  const provider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (provider === "mock") {
    if (process.env.VERCEL_ENV === "production") throw new AiError("not_configured", "mock disabled in production");
    return new MockChatProvider();
  }
  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AiError("not_configured", "GEMINI_API_KEY missing");
    return new GeminiChatProvider(new GeminiJsonClient({ apiKey, models: geminiModels(), attemptTimeoutMs: 25_000, totalBudgetMs: 45_000 }));
  }
  throw new AiError("not_configured", `unknown AI_PROVIDER "${provider}"`);
}
