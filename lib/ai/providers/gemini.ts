import "server-only";

import { AiError } from "@/lib/ai/errors";
import { outfitJsonSchema } from "@/lib/ai/schemas";
import type { ImageInput, OutfitProvider, ProviderResult } from "@/lib/ai/types";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiConfig {
  apiKey: string;
  models: string[]; // primary first, then fallbacks
  attemptTimeoutMs?: number;
  totalBudgetMs?: number;
  fetchImpl?: typeof fetch;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

/** Map an HTTP failure to our error taxonomy. */
export function classifyGeminiHttp(status: number, body: GeminiResponse | null): AiError {
  const detail = `${status} ${body?.error?.status ?? ""} ${body?.error?.message?.slice(0, 200) ?? ""}`.trim();
  if (status === 429) return new AiError("rate_limited", detail);
  if (status === 401 || status === 403) return new AiError("not_configured", detail);
  if (status === 404) return new AiError("unavailable", detail); // model retired → try fallback
  if (status === 400) return new AiError("bad_request", detail);
  if (status >= 500) return new AiError("unavailable", detail);
  return new AiError("unavailable", detail);
}

/** Pull the JSON payload out of a successful response. */
export function extractGeminiJson(body: GeminiResponse): unknown {
  if (body.promptFeedback?.blockReason) throw new AiError("blocked", body.promptFeedback.blockReason);
  const cand = body.candidates?.[0];
  if (!cand) throw new AiError("invalid_response", "no candidates");
  if (cand.finishReason && ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(cand.finishReason)) {
    throw new AiError("blocked", cand.finishReason);
  }
  const text = (cand.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  if (!text) throw new AiError("invalid_response", `empty (${cand.finishReason ?? "?"})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("invalid_response", "not JSON");
  }
}

export type GeminiContent = { role: "user" | "model"; parts: Record<string, unknown>[] };

/** Shared Gemini JSON client: model fallback, per-attempt timeout, error taxonomy. */
export class GeminiJsonClient {
  private fetch: typeof fetch;
  constructor(private cfg: GeminiConfig) {
    this.fetch = cfg.fetchImpl ?? fetch;
  }

  async generateJson(opts: {
    system: string;
    contents: GeminiContent[];
    schema: object;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<{ raw: unknown; model: string }> {
    const started = Date.now();
    const total = this.cfg.totalBudgetMs ?? 55_000;
    let lastError: AiError = new AiError("unavailable", "no models configured");

    for (const model of this.cfg.models) {
      const remaining = total - (Date.now() - started);
      if (remaining < 3_000) break;
      try {
        const raw = await this.callModel(model, opts, Math.min(this.cfg.attemptTimeoutMs ?? 30_000, remaining));
        return { raw, model };
      } catch (e) {
        lastError = e instanceof AiError ? e : new AiError("network", String(e));
        // Config/auth problems and blocked content won't improve on another model.
        if (!lastError.retryable && lastError.code !== "unavailable") throw lastError;
        console.warn(`[ai] gemini model ${model} failed: ${lastError.code} ${lastError.detail ?? ""}`);
      }
    }
    throw lastError;
  }

  private async callModel(
    model: string,
    opts: { system: string; contents: GeminiContent[]; schema: object; temperature?: number; maxOutputTokens?: number },
    timeoutMs: number,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        // Key goes in a header, never in the URL (URLs end up in logs).
        headers: { "content-type": "application/json", "x-goog-api-key": this.cfg.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: opts.contents,
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: opts.schema,
            temperature: opts.temperature ?? 0.9,
            maxOutputTokens: opts.maxOutputTokens ?? 8192,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) throw new AiError("timeout", `${model} after ${timeoutMs}ms`);
      throw new AiError("network", e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }

    let body: GeminiResponse | null = null;
    try {
      body = (await res.json()) as GeminiResponse;
    } catch {
      body = null;
    }
    if (!res.ok) throw classifyGeminiHttp(res.status, body);
    if (!body) throw new AiError("invalid_response", "unreadable body");
    return extractGeminiJson(body);
  }
}

export class GeminiOutfitProvider implements OutfitProvider {
  name = "gemini";
  isMock = false;
  private client: GeminiJsonClient;

  constructor(cfg: GeminiConfig) {
    this.client = new GeminiJsonClient(cfg);
  }

  async generateOutfits(input: { system: string; prompt: string; image?: ImageInput }): Promise<ProviderResult> {
    const parts: Record<string, unknown>[] = [{ text: input.prompt }];
    if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
    const { raw, model } = await this.client.generateJson({
      system: input.system,
      contents: [{ role: "user", parts }],
      schema: outfitJsonSchema,
    });
    return { raw, provider: this.name, model, isMock: false };
  }
}
