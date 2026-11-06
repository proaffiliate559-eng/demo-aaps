import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StylistChat } from "@/components/stylist/chat";
import { StylistLayout } from "@/components/stylist/stylist-layout";
import { getConversation, listConversations } from "@/lib/stylist/queries";
import { getProfileRows } from "@/lib/profile/queries";
import { getFeatureFlags } from "@/lib/settings/features";

export const metadata: Metadata = { title: "AI stylist" };

/**
 * The open conversation is a query parameter (?c=<id>), not a path segment,
 * so the chat stays mounted when a brand-new conversation receives its id.
 */
export default async function StylistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getFeatureFlags()).stylist_chat) notFound();
  const sp = await searchParams;
  const id = typeof sp.c === "string" ? sp.c : null;

  const [convo, conversations, { profile }] = await Promise.all([
    id ? getConversation(id) : Promise.resolve(null),
    listConversations(),
    getProfileRows(),
  ]);
  if (id && !convo) notFound();

  return (
    <StylistLayout conversations={conversations} activeId={id ?? undefined}>
      <StylistChat
        conversationId={id}
        initialMessages={convo?.messages ?? []}
        name={profile?.display_name?.split(" ")[0] ?? "there"}
      />
    </StylistLayout>
  );
}
