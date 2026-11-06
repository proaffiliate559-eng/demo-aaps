import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType, MAX_UPLOAD_BYTES } from "@/lib/validations/image";
import { UPLOAD_PATH_RE, WARDROBE_PATH_RE } from "@/lib/validations/generate";
import { sanitizeImage } from "@/lib/images/process";

export const runtime = "nodejs";

const UPLOADS_PER_HOUR = 30;

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

/** Upload a style or wardrobe photo to the user's private folder. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Please sign in again.");

  // Rate limit: 30 uploads per hour per user.
  const { data: recent } = await createAdminClient().rpc("recent_upload_count", { p_user: user.id });
  if ((recent ?? 0) >= UPLOADS_PER_HOUR) return fail(429, "rate_limited", "You've uploaded a lot of photos recently. Please try again in a while.");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "too_large", "Photos must be 5 MB or smaller.");

  let file: File | null = null;
  let folder: "style" | "wardrobe" = "style";
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
    if (form.get("kind") === "wardrobe") folder = "wardrobe";
  } catch {
    return fail(400, "bad_request", "We couldn't read that upload.");
  }
  if (!file) return fail(400, "no_file", "Choose a photo to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "too_large", "Photos must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageType(bytes);
  if (!kind) return fail(415, "bad_type", "Please upload a JPG, PNG or WEBP image.");

  let clean;
  try {
    clean = await sanitizeImage(bytes, kind.ext);
  } catch {
    return fail(415, "bad_image", "That image looks damaged. Please try another photo.");
  }

  const path = `${user.id}/${folder}/${randomUUID()}.${clean.ext}`;
  const { error } = await supabase.storage
    .from("user-uploads")
    .upload(path, clean.data, { contentType: clean.mime, upsert: false });
  if (error) return fail(500, "upload_failed", "Upload failed. Please try again.");

  const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(path, 600);
  return NextResponse.json({ path, url: signed?.signedUrl ?? null });
}

/** Remove one of the user's own style photos. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Please sign in again.");

  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!(UPLOAD_PATH_RE.test(path) || WARDROBE_PATH_RE.test(path)) || !path.startsWith(`${user.id}/`)) return fail(400, "bad_path", "Invalid photo.");
  const { error } = await supabase.storage.from("user-uploads").remove([path]);
  if (error) return fail(500, "delete_failed", "Couldn't remove the photo.");
  return NextResponse.json({ ok: true });
}
