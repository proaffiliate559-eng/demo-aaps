/** Minimal Gemini REST client (no SDK). The API key is sent in a header, never in the URL. */

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function mapHttpError(status, body) {
  const detail = body?.error?.message?.slice(0, 200) ?? "";
  console.error(`[gemini] HTTP ${status} ${detail}`);
  if (status === 429) return new AppError(429, "busy", "AI abhi busy hai, 1 minute baad try karo.");
  if (status === 401 || status === 403) return new AppError(503, "not_configured", "AI key sahi set nahi hai (GEMINI_API_KEY check karo).");
  if (status === 400) return new AppError(422, "bad_request", "AI ye photo process nahi kar paya. Doosri photo try karo.");
  return new AppError(503, "unavailable", "AI service abhi available nahi hai. Thodi der baad try karo.");
}

async function post(model, payload, { apiKey, timeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new AppError(504, "timeout", "AI ne bahut time liya. Dobara try karo.");
    console.error(`[gemini] network ${e?.message ?? e}`);
    throw new AppError(503, "network", "AI se connect nahi ho paya. Internet check karke dobara try karo.");
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw mapHttpError(res.status, body);
  if (body?.promptFeedback?.blockReason) {
    throw new AppError(422, "blocked", "Is photo par AI kaam nahi kar sakta. Ek saaf, full-dressed photo try karo.");
  }
  const cand = body?.candidates?.[0];
  if (!cand) throw new AppError(502, "empty", "AI se jawab nahi aaya. Dobara try karo.");
  if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"].includes(cand.finishReason)) {
    throw new AppError(422, "blocked", "Is photo par AI kaam nahi kar sakta. Ek saaf, full-dressed photo try karo.");
  }
  return cand;
}

/** Text model with image input → parsed JSON. Tries each model in order on availability errors. */
export async function generateJson({ models, system, prompt, image, schema, ...opts }) {
  let last;
  for (const model of models) {
    try {
      const cand = await post(
        model,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            temperature: 0.8,
            maxOutputTokens: 4096,
          },
        },
        { timeoutMs: 45_000, ...opts },
      );
      const text = (cand.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
      try {
        return JSON.parse(text);
      } catch {
        throw new AppError(502, "invalid", "AI ka jawab samajh nahi aaya. Dobara try karo.");
      }
    } catch (e) {
      last = e;
      if (!(e instanceof AppError) || !["unavailable", "busy", "invalid"].includes(e.code)) throw e;
    }
  }
  throw last;
}

/** Image-editing model: photo + instruction → edited photo. */
export async function editImage({ model, prompt, image, ...opts }) {
  const cand = await post(
    model,
    {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    },
    { timeoutMs: 90_000, ...opts },
  );
  const part = (cand.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) throw new AppError(502, "no_image", "AI photo nahi bana paya. 'Dobara banao' dabao.");
  const mimeType = part.inlineData.mimeType;
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new AppError(502, "no_image", "AI photo nahi bana paya.");
  return { mimeType, base64: part.inlineData.data };
}
