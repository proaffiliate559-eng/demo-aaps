"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAT_MESSAGE_MAX } from "@/lib/ai/chat/schemas";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string };
type GenerateHint = { mood: string; occasion: string; style: string; weather?: string | null } | null;

const STARTERS = [
  "What should I wear for a college party?",
  "I only have black jeans — what tops go with them?",
  "Help me plan a Diwali outfit under ₹3,000",
  "What should I wear to a summer office day?",
];

export function StylistChat({ conversationId, initialMessages, name }: { conversationId: string | null; initialMessages: Msg[]; name: string }) {
  const router = useRouter();
  const [convoId, setConvoId] = useState(conversationId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generate, setGenerate] = useState<GenerateHint>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset only when the user switches to a different conversation (or starts a
  // new one) — not when the conversation we just created receives its id.
  const [prevProp, setPrevProp] = useState(conversationId);
  if (conversationId !== prevProp) {
    setPrevProp(conversationId);
    if (conversationId !== convoId) {
      setConvoId(conversationId);
      setMessages(initialMessages);
      setSuggestions([]);
      setGenerate(null);
      setError(null);
      setInput("");
    }
  }
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const firstScroll = useRef(true);
  useEffect(() => {
    // Jump to the latest message when a conversation opens; animate afterwards.
    endRef.current?.scrollIntoView({ behavior: firstScroll.current ? "auto" : "smooth", block: "end" });
    firstScroll.current = false;
  }, [messages, pending, error]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    setSuggestions([]);
    setGenerate(null);
    setInput("");
    const tempId = `temp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.messages) {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setError({ message: json?.error?.message ?? "Something went wrong.", retry: message });
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== tempId), ...json.messages]);
      setSuggestions(json.suggestions ?? []);
      setGenerate(json.generate ?? null);
      if (!convoId) {
        setConvoId(json.conversationId);
        window.history.replaceState(null, "", `/stylist?c=${json.conversationId}`);
      }
      router.refresh(); // update the conversation list
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setError({ message: "We couldn't reach the server. Check your connection.", retry: message });
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  const generateHref = generate
    ? `/generate?${new URLSearchParams(Object.entries(generate).filter(([, v]) => v) as [string, string][]).toString()}`
    : null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:min-h-dvh">
      <div className="flex-1 space-y-5 px-4 py-6 sm:px-8" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && !pending && (
          <div className="mx-auto max-w-xl py-10 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-beige">
              <Sparkles aria-hidden className="size-6" />
            </span>
            <h1 className="mt-5 font-display text-4xl sm:text-5xl">Hi {name}, what are we dressing for?</h1>
            <p className="mt-3 text-muted-foreground">Ask me anything about outfits, colours or what goes with what. I know your style profile and wardrobe.</p>
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)} className="w-full cursor-pointer rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-foreground/40">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-[1.25rem] px-4 py-3 text-[0.95rem] leading-relaxed sm:max-w-[70%]",
                m.role === "user" ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border border-border bg-surface",
              )}
              data-role={m.role}
            >
              {m.role === "assistant" && <span className="sr-only">Stylist: </span>}
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start" role="status" aria-label="Stylist is typing">
            <div className="flex gap-1.5 rounded-[1.25rem] rounded-bl-md border border-border bg-surface px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error.message}
            <Button size="sm" variant="outline" onClick={() => send(error.retry)}>
              <RotateCcw aria-hidden /> Try again
            </Button>
          </div>
        )}

        {!pending && (generateHref || suggestions.length > 0) && (
          <div className="flex flex-wrap gap-2 pl-1">
            {generateHref && (
              <Button asChild size="sm">
                <Link href={generateHref}><WandSparkles aria-hidden /> Create 3 full looks for this</Link>
              </Button>
            )}
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="cursor-pointer rounded-full border border-border bg-surface px-3.5 py-2 text-sm transition-colors hover:border-foreground/40">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} className="h-2 scroll-mb-28" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-0 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] border border-border bg-surface p-2 focus-within:border-foreground">
          <label htmlFor="chat-input" className="sr-only">Message your stylist</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={CHAT_MESSAGE_MAX}
            placeholder="Ask about any outfit, colour or occasion…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[0.95rem] outline-none [field-sizing:content]"
          />
          <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send message" className="shrink-0">
            <ArrowUp className="!size-5" />
          </Button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[0.7rem] text-muted-foreground">
          AI stylist — suggestions can be imperfect. Fashion and styling questions only.
        </p>
      </form>
    </div>
  );
}
