"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function deleteConversation(id: string) {
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(id).success) redirect("/stylist");
  const supabase = await createClient();
  await supabase.from("chat_conversations").delete().eq("id", id); // RLS: own only; messages cascade
  revalidatePath("/stylist");
  redirect("/stylist");
}
