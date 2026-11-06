import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRequestSchema } from "@/lib/validations/generate";
import { generateOutfitsForUser } from "@/lib/ai/service";
import { AI_ERROR_STATUS, AiError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Please sign in again." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid request." } }, { status: 400 });
  }
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  try {
    const { requestId } = await generateOutfitsForUser(user.id, parsed.data);
    return NextResponse.json({ requestId });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("unavailable", String(e));
    console.error(`[generate-outfit] user=${user.id} code=${err.code} detail=${err.detail ?? ""}`);
    return NextResponse.json(
      { error: { code: err.code, message: err.userMessage } },
      { status: AI_ERROR_STATUS[err.code] },
    );
  }
}
