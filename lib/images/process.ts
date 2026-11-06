import "server-only";

import sharp from "sharp";

/**
 * Normalise an uploaded photo:
 * - applies EXIF orientation, then strips ALL metadata (GPS location, camera, etc.)
 * - downsizes to max 1600px (faster AI calls, smaller storage)
 * - re-encodes to JPEG/WEBP; also defeats polyglot files hiding other content
 */
export async function sanitizeImage(input: Uint8Array, kind: "jpg" | "png" | "webp") {
  const pipeline = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
  if (kind === "webp") {
    return { data: await pipeline.webp({ quality: 85 }).toBuffer(), ext: "webp" as const, mime: "image/webp" as const };
  }
  return { data: await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), ext: "jpg" as const, mime: "image/jpeg" as const };
}
