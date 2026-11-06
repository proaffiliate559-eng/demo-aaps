import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/ai/chat/schemas";
import { sendChatMessage } from "@/lib/ai/chat/service";
import { AI_ERROR_STATUS, AiError } from "@/lib/ai/errors";
import { getFeatureFlags } from "@/lib/settings/features";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Please sign in again." } }, { status: 401 });

  if (!(await getFeatureFlags()).stylist_chat) {
    return NextResponse.json({ error: { code: "disabled", message: "The AI stylist is currently unavailable." } }, { status: 503 });
  }

  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid message." } }, { status: 400 });
  }

  try {
    return NextResponse.json(await sendChatMessage(user.id, parsed.data));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("unavailable", String(e));
    console.error(`[chat] user=${user.id} code=${err.code} detail=${err.detail ?? ""}`);
    const message =
      err.code === "limit_reached"
        ? "You've reached today's chat limit. Your stylist will be back tomorrow."
        : err.code === "bad_request"
          ? "That conversation couldn't be found."
          : err.userMessage;
    return NextResponse.json({ error: { code: err.code, message } }, { status: AI_ERROR_STATUS[err.code] });
  }
}
