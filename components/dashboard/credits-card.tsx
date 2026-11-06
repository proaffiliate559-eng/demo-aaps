import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CreditStatus } from "@/lib/usage/queries";

function formatReset(d: Date | null, period: "day" | "month") {
  if (!d) return "";
  if (period === "day") return "Resets at midnight IST";
  return `Renews ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d)}`;
}

export function CreditsCard({ credits }: { credits: CreditStatus }) {
  const pct = credits.limit ? Math.round((credits.remaining / credits.limit) * 100) : 0;
  return (
    <Card className="p-6" data-testid="credits-card">
      <div className="flex items-center justify-between">
        <p className="eyebrow">AI credits</p>
        <span className="rounded-full bg-beige px-2.5 py-0.5 text-xs font-medium">{credits.planName} plan</span>
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl" data-testid="credits-remaining">{credits.remaining}</span>
        <span className="text-sm text-muted-foreground">
          of {credits.limit} left {credits.period === "day" ? "today" : "this month"}
        </span>
      </p>
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Credits remaining"
        aria-valuenow={credits.remaining}
        aria-valuemin={0}
        aria-valuemax={credits.limit}
      >
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{formatReset(credits.resetsAt, credits.period)}</p>
      {credits.planSlug === "free" && (
        <div className="mt-6 rounded-2xl bg-muted p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 text-sand" /> Want more looks?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Paid plans from ₹99/month add up to 300 generations.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/billing">See plans</Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
