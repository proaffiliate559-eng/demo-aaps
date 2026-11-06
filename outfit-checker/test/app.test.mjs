import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";

process.env.AI_MODE = "mock";
const { server } = await import("../server.mjs");
const { validateCheckInput, sniffMime } = await import("../lib/validate.mjs");
const { buildSuggestionPrompt, buildTryOnPrompt } = await import("../lib/prompts.mjs");
const { editImage, generateJson, AppError } = await import("../lib/gemini.mjs");

/** A real (tiny, noisy so it's >1KB) PNG. */
function makePng(w = 40, h = 40) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let i = 0; i < raw.length; i++) raw[i] = i % (w * 3 + 1) === 0 ? 0 : (i * 2654435761) >>> 24;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
}
const png = makePng();
const image = { mimeType: "image/png", base64: png.toString("base64") };

let base;
before(async () => { await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());
const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("sniffMime detects real type", () => {
  assert.equal(sniffMime(png), "image/png");
  assert.equal(sniffMime(Buffer.from("hello world, not an image")), null);
});

test("validation: consent, mood and image are required", () => {
  assert.throws(() => validateCheckInput({ image, mood: "date" }), /consent/);
  assert.throws(() => validateCheckInput({ image, consent: true, mood: "beach" }), /Mood/);
  assert.throws(() => validateCheckInput({ consent: true, mood: "date" }), /photo/);
  assert.throws(() => validateCheckInput({ consent: true, mood: "date", image: { mimeType: "image/png", base64: Buffer.alloc(2000, 1).toString("base64") } }), /JPG/);
  const ok = validateCheckInput({ image: { ...image, mimeType: "image/jpeg" }, consent: true, mood: "party", note: "  kurta\n chahiye " });
  assert.equal(ok.image.mimeType, "image/png", "declared type is replaced by sniffed type");
  assert.equal(ok.weather, "mild");
  assert.equal(ok.note, "kurta  chahiye");
});

test("prompts include mood, budget and note; try-on keeps identity", () => {
  const p = buildSuggestionPrompt({ mood: "date", weather: "rainy", styleFor: "women", budget: "low", note: "black pasand" });
  assert.match(p, /date/);
  assert.match(p, /under ₹2,000/);
  assert.match(p, /black pasand/);
  const t = buildTryOnPrompt("a red silk saree");
  assert.match(t, /red silk saree/);
  assert.match(t, /same person/);
});

test("API: /api/check returns a labelled mock suggestion", async () => {
  const res = await post("/api/check", { image, consent: true, mood: "friends" });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.mock, true);
  assert.ok(d.suggestion.pieces.length >= 2);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
});

test("API: errors are JSON with a message", async () => {
  const res = await post("/api/check", { image, mood: "friends" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error.message, /consent/);
  const r2 = await fetch(base + "/api/check");
  assert.equal(r2.status, 405);
});

test("API: /api/tryon in mock mode echoes the photo", async () => {
  const res = await post("/api/tryon", { image, consent: true, tryonDescription: "a navy blazer with white shirt" });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.mock, true);
  assert.equal(d.image.base64, image.base64);
});

test("static: serves index, blocks path traversal", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Outfit Checker/);
  const bad = await fetch(base + "/..%2fserver.mjs");
  assert.equal(bad.status, 404);
});

test("gemini client: falls back to next model and parses JSON", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) return new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 503 });
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] });
  };
  const out = await generateJson({ apiKey: "k", models: ["a", "b"], system: "s", prompt: "p", image, schema: {}, fetchImpl });
  assert.deepEqual(out, { ok: true });
  assert.match(calls[1], /models\/b:generateContent/);
  assert.ok(!calls[0].includes("k"), "key not in URL");
});

test("gemini client: editImage returns image, maps safety block", async () => {
  const ok = async () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }] } }] });
  assert.deepEqual(await editImage({ apiKey: "k", model: "m", prompt: "p", image, fetchImpl: ok }), { mimeType: "image/png", base64: "AAAA" });
  const blocked = async () => Response.json({ candidates: [{ finishReason: "IMAGE_SAFETY" }] });
  await assert.rejects(editImage({ apiKey: "k", model: "m", prompt: "p", image, fetchImpl: blocked }), (e) => e instanceof AppError && e.code === "blocked");
  const auth = async () => Response.json({ error: { message: "bad key" } }, { status: 403 });
  await assert.rejects(editImage({ apiKey: "k", model: "m", prompt: "p", image, fetchImpl: auth }), (e) => e.code === "not_configured");
});
