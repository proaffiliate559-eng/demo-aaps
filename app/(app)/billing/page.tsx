import type { Metadata } from "next";
import { Check, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { getActivePlans } from "@/lib/plans/queries";
import { getCreditStatus } from "@/lib/usage/queries";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { createClient } from "@/lib/supabase/server";
import { cn, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans & billing" };

const STATUS_LABEL: Record<string, string> = { created: "Started", paid: "Paid", failed: "Failed", cancelled: "Cancelled" };

export default async function BillingPage() {
  const supabase = await createClient();
  const [plans, credits, { data: sub }, { data: payments }] = await Promise.all([
    getActivePlans(),
    getCreditStatus(),
    supabase.from("subscriptions").select("expires_at, plans(name, slug)").eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle(),
    supabase.from("payments").select("id, amount_paise, status, created_at, plans(name)").order("created_at", { ascending: false }).limit(20),
  ]);
  const payEnabled = isRazorpayConfigured();
  const fmtDate = (d: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d));

  return (
    <div className="container-page max-w-6xl py-8 sm:py-12">
      <PageHeader eyebrow="Plans & billing" title="Choose how much styling you need" />

      <Card className="mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="current-plan">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-3xl">{credits.planName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {credits.remaining} of {credits.limit} generations left {credits.period === "day" ? "today" : "this period"}
            {sub?.expires_at && <> · Active until {fmtDate(sub.expires_at)}</>}
          </p>
        </div>
        {sub?.expires_at && (
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Plans are prepaid monthly passes — nothing renews automatically. Buy the same plan again to extend it by a month.
          </p>
        )}
      </Card>

      {!payEnabled && (
        <Alert variant="info" className="mt-6">
          Online payments are launching soon. Upgrades will be available here as soon as they open — your free plan keeps working meanwhile.
        </Alert>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const current = plan.slug === credits.planSlug;
          return (
            <article
              key={plan.slug}
              data-testid={`plan-${plan.slug}`}
              className={cn("flex flex-col rounded-[1.5rem] border p-6", plan.highlighted ? "border-foreground bg-foreground text-background" : "border-border bg-surface")}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">{plan.name}</h2>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl">{plan.priceInr === 0 ? "Free" : formatINR(plan.priceInr)}</span>
                {plan.priceInr > 0 && <span className={cn("text-sm", plan.highlighted ? "text-background/60" : "text-muted-foreground")}>/month</span>}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sand" />{f}</li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                {current ? (
                  <Button className="w-full" variant="outline" disabled>Current plan</Button>
                ) : plan.priceInr === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">Included for everyone</p>
                ) : payEnabled ? (
                  <CheckoutButton planSlug={plan.slug} label={`Get ${plan.name}`} highlighted={plan.highlighted} />
                ) : (
                  <Button className="w-full" variant={plan.highlighted ? "beige" : "outline"} disabled>Payments launching soon</Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section aria-labelledby="history-title" className="mt-12">
        <h2 id="history-title" className="font-display text-3xl">Payment history</h2>
        {payments?.length ? (
          <div className="mt-4 overflow-x-auto rounded-[1.25rem] border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground"><tr><th className="px-5 py-3 font-normal">Date</th><th className="px-5 py-3 font-normal">Plan</th><th className="px-5 py-3 font-normal">Amount</th><th className="px-5 py-3 font-normal">Status</th></tr></thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">{fmtDate(p.created_at)}</td>
                    <td className="px-5 py-3">{p.plans?.name}</td>
                    <td className="px-5 py-3">{formatINR(p.amount_paise / 100)}</td>
                    <td className="px-5 py-3">{STATUS_LABEL[p.status] ?? p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Info aria-hidden className="size-4" /> No payments yet.</p>
        )}
      </section>
    </div>
  );
}
