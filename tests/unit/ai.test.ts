import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("not in unit tests"); } }));

const { parseOutfitResponse, generateValidated } = await import("@/lib/ai/service");
const { GeminiOutfitProvider, classifyGeminiHttp, extractGeminiJson } = await import("@/lib/ai/providers/gemini");
const { AiError } = await import("@/lib/ai/errors");
const { buildOutfitPrompt } = await import("@/lib/ai/prompts/outfit");

const look = (tier: string) => ({
  tier,
  name: `Look ${tier}`,
  style: "Casual",
  description: "A look.",
  items: { top: "Tee", bottom: "Jeans", footwear: "Sneakers", accessories: ["Watch"] },
  color_palette: [{ name: "White", hex: "#FFFFFF" }],
  styling_explanation: "Works.",
  occasion_suitability: "Fits.",
  estimated_budget_inr: 1500,
  alternatives: [],
  styling_tips: ["Tip"],
});
const valid = { outfits: [look("bold"), look("safe"), look("trendy")] };

describe("parseOutfitResponse", () => {
  it("accepts valid output and orders looks safe → trendy → bold", () => {
    expect(parseOutfitResponse(valid).outfits.map((o) => o.tier)).toEqual(["safe", "trendy", "bold"]);
  });
  it("allows null bottom for one-piece outfits", () => {
    const v = structuredClone(valid);
    (v.outfits[0].items as { bottom: string | null }).bottom = null;
    expect(() => parseOutfitResponse(v)).not.toThrow();
  });
  it.each([
    ["two looks", { outfits: [look("safe"), look("bold")] }],
    ["duplicate tiers", { outfits: [look("safe"), look("safe"), look("bold")] }],
    ["bad hex", { outfits: [{ ...look("safe"), color_palette: [{ name: "x", hex: "red" }] }, look("trendy"), look("bold")] }],
    ["negative budget", { outfits: [{ ...look("safe"), estimated_budget_inr: -5 }, look("trendy"), look("bold")] }],
    ["string budget", { outfits: [{ ...look("safe"), estimated_budget_inr: "1500" }, look("trendy"), look("bold")] }],
    ["missing items", { outfits: [{ ...look("safe"), items: undefined }, look("trendy"), look("bold")] }],
    ["not an object", "Sure! Here are three outfits..."],
    ["null", null],
  ])("rejects %s", (_n, raw) => {
    expect(() => parseOutfitResponse(raw)).toThrow(AiError);
  });
});

describe("generateValidated", () => {
  it("retries once on invalid output, then succeeds", async () => {
    const gen = vi.fn()
      .mockResolvedValueOnce({ raw: { nope: true }, provider: "t", model: "m", isMock: false })
      .mockResolvedValueOnce({ raw: valid, provider: "t", model: "m", isMock: false });
    const r = await generateValidated({ name: "t", isMock: false, generateOutfits: gen }, { system: "", prompt: "" });
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.outfits.outfits).toHaveLength(3);
  });
  it("gives up after two invalid responses", async () => {
    const gen = vi.fn().mockResolvedValue({ raw: "garbage", provider: "t", model: "m", isMock: false });
    await expect(generateValidated({ name: "t", isMock: false, generateOutfits: gen }, { system: "", prompt: "" }))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("Gemini provider", () => {
  const ok = (payload: unknown) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: "STOP" }] }), { status: 200 });
  const err = (status: number) => new Response(JSON.stringify({ error: { code: status, status: "X", message: "m" } }), { status });

  it("falls back to the next model when the first is overloaded", async () => {
    const f = vi.fn().mockResolvedValueOnce(err(503)).mockResolvedValueOnce(ok(valid));
    const p = new GeminiOutfitProvider({ apiKey: "k", models: ["a", "b"], fetchImpl: f as typeof fetch });
    const r = await p.generateOutfits({ system: "s", prompt: "p" });
    expect(r.model).toBe("b");
    expect(f.mock.calls[0][0]).toContain("/a:generateContent");
    expect(f.mock.calls[1][0]).toContain("/b:generateContent");
  });
  it("sends the key in a header, never in the URL", async () => {
    const f = vi.fn().mockResolvedValue(ok(valid));
    await new GeminiOutfitProvider({ apiKey: "secret-key", models: ["a"], fetchImpl: f as typeof fetch }).generateOutfits({ system: "s", prompt: "p" });
    expect(f.mock.calls[0][0]).not.toContain("secret-key");
    expect(f.mock.calls[0][1].headers["x-goog-api-key"]).toBe("secret-key");
  });
  it("does not retry auth errors", async () => {
    const f = vi.fn().mockResolvedValue(err(403));
    const p = new GeminiOutfitProvider({ apiKey: "k", models: ["a", "b"], fetchImpl: f as typeof fetch });
    await expect(p.generateOutfits({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "not_configured" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("reports rate limiting when all models are throttled", async () => {
    const f = vi.fn().mockResolvedValue(err(429));
    const p = new GeminiOutfitProvider({ apiKey: "k", models: ["a", "b"], fetchImpl: f as typeof fetch });
    await expect(p.generateOutfits({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("times out slow models", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const p = new GeminiOutfitProvider({ apiKey: "k", models: ["a"], fetchImpl: f as unknown as typeof fetch, attemptTimeoutMs: 50, totalBudgetMs: 4000 });
    await expect(p.generateOutfits({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "timeout" });
  });
  it("maps network failures", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const p = new GeminiOutfitProvider({ apiKey: "k", models: ["a"], fetchImpl: f as typeof fetch });
    await expect(p.generateOutfits({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "network" });
  });
  it("classifies blocked and malformed responses", () => {
    expect(() => extractGeminiJson({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/couldn't style/);
    expect(() => extractGeminiJson({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })).toThrow(/incomplete/);
    expect(classifyGeminiHttp(500, null).code).toBe("unavailable");
  });
});

describe("prompt", () => {
  it("includes request and profile, with INR budget", () => {
    const p = buildOutfitPrompt({
      request: { mood: "confident", occasion: "office", style: "formal", weather: "rainy", budget: "2000_5000" },
      profile: {
        displayName: "A", genderPreference: "womenswear", ageGroup: null, country: "India", language: "en",
        preferredStyles: ["minimalist"], favouriteColours: ["beige"], preferredFit: null, sizes: {}, modesty: "more_coverage",
      },
      hasImage: false,
    });
    expect(p).toContain("Mood: Confident");
    expect(p).toContain("₹2000–₹5000");
    expect(p).toContain("Styling preference: womenswear");
    expect(p).toContain("Coverage preference: More coverage");
    expect(p).not.toContain("Name"); // name isn't needed by the model
  });
});
