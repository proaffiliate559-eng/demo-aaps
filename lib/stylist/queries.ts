import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listConversations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getConversation(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: convo } = await supabase.from("chat_conversations").select("id, title").eq("id", id).maybeSingle();
  if (!convo) return null;
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  return { ...convo, messages: messages ?? [] };
}
