import "server-only";

import { AiError } from "@/lib/ai/errors";
import { buildStylistSystemPrompt } from "@/lib/ai/chat/prompt";
import { getChatProvider, type ChatTurn } from "@/lib/ai/chat/provider";
import { chatReplySchema, type ChatReply } from "@/lib/ai/chat/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const CHAT_DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT ?? 40);
const HISTORY_TURNS = 20;

function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60_000);
}

export function parseChatReply(raw: unknown): ChatReply {
  const parsed = chatReplySchema.safeParse(raw);
  if (!parsed.success) throw new AiError("invalid_response", parsed.error.issues[0]?.message);
  // Models occasionally mangle the rupee sign into a curly quote before a number.
  return { ...parsed.data, reply: parsed.data.reply.replace(/[’‘](?=\d)/g, "₹") };
}

function titleFrom(message: string) {
  const t = message.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

/**
 * Send a message to the stylist. Messages (and a new conversation) are only
 * stored once the AI has replied successfully, so failures can simply be retried.
 */
export async function sendChatMessage(userId: string, input: { conversationId?: string | null; message: string }) {
  const provider = getChatProvider();
  const admin = createAdminClient();

  const { count } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "chat")
    .eq("status", "success")
    .gte("created_at", istDayStart().toISOString());
  if ((count ?? 0) >= CHAT_DAILY_LIMIT) throw new AiError("limit_reached", "chat daily limit");

  // Burst protection: at most 8 messages per minute.
  const { count: burst } = await admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "chat")
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((burst ?? 0) >= 8) throw new AiError("rate_limited", "chat burst");

  let history: ChatTurn[] = [];
  if (input.conversationId) {
    const { data: convo } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("id", input.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!convo) throw new AiError("bad_request", "conversation not found");
    const { data: msgs } = await admin
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    history = (msgs ?? []).reverse().map((m) => ({ role: m.role as ChatTurn["role"], content: m.content }));
  }

  const [{ data: profile }, { data: prefs }, { data: wardrobe }] = await Promise.all([
    admin.from("profiles").select("gender_preference, preferred_styles, favourite_colours, budget_min, budget_max").eq("id", userId).single(),
    admin.from("user_preferences").select("modesty_preference").eq("user_id", userId).maybeSingle(),
    admin.from("wardrobe_items").select("name, category, colour").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
  ]);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const system = buildStylistSystemPrompt({
    genderPreference: profile?.gender_preference ?? null,
    styles: arr(profile?.preferred_styles),
    colours: arr(profile?.favourite_colours),
    budgetMin: profile?.budget_min ?? null,
    budgetMax: profile?.budget_max ?? null,
    modesty: prefs?.modesty_preference ?? null,
    wardrobe: wardrobe ?? [],
  });

  let reply: ChatReply;
  let model = "";
  try {
    let lastErr: AiError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await provider.reply({ system, history: [...history, { role: "user", content: input.message }] });
      model = res.model;
      try {
        reply = parseChatReply(res.raw);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e as AiError;
      }
    }
    if (lastErr) throw lastErr;
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("unavailable", String(e));
    await admin.from("ai_usage").insert({ user_id: userId, provider: provider.name, feature: "chat", status: err.code === "rate_limited" ? "rate_limited" : err.code === "invalid_response" ? "invalid_response" : "error", error_code: err.code });
    throw err;
  }

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const { data: convo, error } = await admin
      .from("chat_conversations")
      .insert({ user_id: userId, title: titleFrom(input.message) })
      .select("id")
      .single();
    if (error || !convo) throw new AiError("unavailable", "could not create conversation");
    conversationId = convo.id;
  }

  const now = Date.now();
  const { data: inserted, error: msgError } = await admin
    .from("chat_messages")
    .insert([
      { conversation_id: conversationId, role: "user", content: input.message, created_at: new Date(now).toISOString() },
      { conversation_id: conversationId, role: "assistant", content: reply!.reply, created_at: new Date(now + 1).toISOString() },
    ])
    .select("id, role, content, created_at");
  if (msgError) throw new AiError("unavailable", "could not store messages");

  await Promise.all([
    admin.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId),
    admin.from("ai_usage").insert({ user_id: userId, provider: `${provider.name}:${model}`, feature: "chat", status: "success" }),
  ]);

  return {
    conversationId,
    messages: inserted ?? [],
    suggestions: reply!.suggestions,
    generate: reply!.generate ?? null,
    isMock: provider.isMock,
  };
}
