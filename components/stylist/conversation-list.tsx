import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteConversation } from "@/lib/stylist/actions";
import { cn } from "@/lib/utils";

export function ConversationList({ conversations, activeId }: { conversations: { id: string; title: string }[]; activeId?: string }) {
  return (
    <div className="flex h-full flex-col">
      <Button asChild variant="outline" className="w-full">
        <Link href="/stylist"><Plus aria-hidden /> New conversation</Link>
      </Button>
      <h2 className="eyebrow mt-6 px-1">History</h2>
      {conversations.length === 0 ? (
        <p className="mt-3 px-1 text-sm text-muted-foreground">No conversations yet.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <Link
                href={`/stylist?c=${c.id}`}
                aria-current={c.id === activeId ? "page" : undefined}
                className={cn("min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm", c.id === activeId ? "bg-muted font-medium" : "text-foreground/75 hover:bg-muted")}
              >
                {c.title}
              </Link>
              {c.id === activeId && (
                <form action={deleteConversation.bind(null, c.id)}>
                  <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label={`Delete conversation: ${c.title}`}>
                    <Trash2 aria-hidden className="!size-3.5" />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
