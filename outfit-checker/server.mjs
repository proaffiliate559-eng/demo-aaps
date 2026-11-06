import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { AppError, editImage, generateJson } from "./lib/gemini.mjs";
import { buildSuggestionPrompt, buildTryOnPrompt, suggestionSchema, SYSTEM_PROMPT } from "./lib/prompts.mjs";
import { validateCheckInput, validateTryOnInput } from "./lib/validate.mjs";
import { mockSuggestion } from "./lib/mock.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  /* no .env file — use real environment variables */
}

const PORT = Number(process.env.PORT ?? 3000);
const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MOCK = (process.env.AI_MODE ?? "").toLowerCase() === "mock";
const TEXT_MODELS = (process.env.GEMINI_MODEL ?? "gemini-3.5-flash,gemini-3.5-flash-lite").split(",").map((s) => s.trim()).filter(Boolean);
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30);
const MAX_BODY = 7 * 1024 * 1024;

const PUBLIC = join(ROOT, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(self), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

/** Simple in-memory per-IP limiter (photos are never stored, so this is the only state). */
const hits = new Map();
function rateLimit(ip, cost = 1) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length + cost > LIMIT_PER_HOUR) throw new AppError(429, "rate_limited", "Bahut zyada try ho gaye. Thodi der baad aao.");
  for (let i = 0; i < cost; i++) list.push(now);
  hits.set(ip, list);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < 3_600_000)) hits.delete(ip);
}, 600_000).unref();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, "cache-control": "no-store", ...headers });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { "content-type": "application/json" });

async function readJson(req) {
  if (!(req.headers["content-type"] ?? "").includes("application/json")) throw new AppError(415, "bad_type", "JSON bhejo.");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new AppError(413, "too_large", "Photo bahut badi hai (max 4 MB).");
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "bad_json", "Request galat hai.");
  }
}

function requireAi() {
  if (!MOCK && !API_KEY) throw new AppError(503, "not_configured", "AI set up nahi hai: server par GEMINI_API_KEY daalo (ya demo ke liye AI_MODE=mock).");
}

async function handleCheck(req, res, ip) {
  requireAi();
  const input = validateCheckInput(await readJson(req));
  rateLimit(ip);
  if (MOCK) return json(res, 200, mockSuggestion(input.mood));
  const data = await generateJson({
    apiKey: API_KEY,
    models: TEXT_MODELS,
    system: SYSTEM_PROMPT,
    prompt: buildSuggestionPrompt(input),
    image: input.image,
    schema: suggestionSchema,
  });
  if (typeof data?.photo_ok !== "boolean" || !data.suggestion?.pieces || !data.current_outfit) {
    throw new AppError(502, "invalid", "AI ka jawab adhoora tha. Dobara try karo.");
  }
  json(res, 200, { mock: false, ...data });
}

async function handleTryOn(req, res, ip) {
  requireAi();
  const input = validateTryOnInput(await readJson(req));
  rateLimit(ip, 2); // image generation is the expensive call
  if (MOCK) return json(res, 200, { mock: true, image: input.image });
  const image = await editImage({ apiKey: API_KEY, model: IMAGE_MODEL, prompt: buildTryOnPrompt(input.tryonDescription), image: input.image });
  json(res, 200, { mock: false, image });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 404, "Not found");
  try {
    const data = await readFile(file);
    send(res, 200, data, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  } catch {
    send(res, 404, "Not found", { "content-type": "text/plain" });
  }
}

export const server = createServer(async (req, res) => {
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] ?? req.socket.remoteAddress ?? "?").trim();
  try {
    const path = new URL(req.url, "http://x").pathname;
    if (path === "/api/health") return json(res, 200, { ok: true, ai: MOCK ? "mock" : API_KEY ? "gemini" : "not_configured" });
    if (path === "/api/check" || path === "/api/tryon") {
      if (req.method !== "POST") return json(res, 405, { error: { code: "method", message: "POST only" } });
      return path === "/api/check" ? await handleCheck(req, res, ip) : await handleTryOn(req, res, ip);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return await serveStatic(req, res);
  } catch (e) {
    const err = e instanceof AppError ? e : new AppError(500, "server", "Kuch gadbad ho gayi. Dobara try karo.");
    if (!(e instanceof AppError)) console.error(e);
    if (!res.headersSent) json(res, err.status, { error: { code: err.code, message: err.message } });
  }
});
server.requestTimeout = 150_000;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => {
    const mode = MOCK ? "DEMO (mock)" : API_KEY ? "Gemini" : "NOT CONFIGURED — set GEMINI_API_KEY";
    console.log(`Outfit Checker running at http://localhost:${PORT}  [AI: ${mode}]`);
  });
}
