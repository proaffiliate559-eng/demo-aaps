import { ALLOWED_MIME, BUDGETS, MAX_IMAGE_BYTES, MAX_NOTE_CHARS, MOODS, STYLE_FOR, WEATHER } from "./config.mjs";
import { AppError } from "./gemini.mjs";

const bad = (msg) => new AppError(400, "bad_request", msg);

/** Checks magic bytes so the declared type can't lie. */
export function sniffMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function validateImage(image) {
  if (!image || typeof image.base64 !== "string" || typeof image.mimeType !== "string") throw bad("Pehle apni photo upload karo.");
  if (!ALLOWED_MIME.includes(image.mimeType)) throw bad("Sirf JPG, PNG ya WEBP photo chalegi.");
  if (image.base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8) throw new AppError(413, "too_large", "Photo bahut badi hai (max 4 MB).");
  const buf = Buffer.from(image.base64, "base64");
  if (buf.length < 1000) throw bad("Photo kharab lag rahi hai. Doosri photo try karo.");
  const real = sniffMime(buf);
  if (!real) throw bad("Sirf JPG, PNG ya WEBP photo chalegi.");
  return { mimeType: real, base64: buf.toString("base64") };
}

/** Validates the outfit-check request body. Returns clean values. */
export function validateCheckInput(body) {
  if (!body || typeof body !== "object") throw bad("Request galat hai.");
  if (body.consent !== true) throw bad("Aage badhne ke liye consent box tick karo.");
  const pick = (value, table, fallback, label) => {
    const v = value ?? fallback;
    if (typeof v !== "string" || !Object.hasOwn(table, v)) throw bad(`${label} sahi chuno.`);
    return v;
  };
  const note = typeof body.note === "string" ? body.note.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, MAX_NOTE_CHARS) : "";
  return {
    image: validateImage(body.image),
    mood: pick(body.mood, MOODS, undefined, "Mood"),
    weather: pick(body.weather, WEATHER, "mild", "Weather"),
    styleFor: pick(body.styleFor, STYLE_FOR, "auto", "Style"),
    budget: pick(body.budget, BUDGETS, "mid", "Budget"),
    note,
  };
}

export function validateTryOnInput(body) {
  if (!body || typeof body !== "object") throw bad("Request galat hai.");
  if (body.consent !== true) throw bad("Aage badhne ke liye consent box tick karo.");
  const d = typeof body.tryonDescription === "string" ? body.tryonDescription.replace(/[\u0000-\u001f]/g, " ").trim() : "";
  if (d.length < 10 || d.length > 1200) throw bad("Outfit description missing hai. Pehle outfit check karo.");
  return { image: validateImage(body.image), tryonDescription: d };
}
