import { ConversationList } from "@/components/stylist/conversation-list";

export function StylistLayout({
  conversations,
  activeId,
  children,
}: {
  conversations: { id: string; title: string }[];
  activeId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border px-4 py-6 lg:block">
        <div className="sticky top-6"><ConversationList conversations={conversations} activeId={activeId} /></div>
      </aside>
      <div className="min-w-0">
        <details className="border-b border-border px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">Conversations ({conversations.length})</summary>
          <div className="mt-3"><ConversationList conversations={conversations} activeId={activeId} /></div>
        </details>
        {children}
      </div>
    </div>
  );
}
