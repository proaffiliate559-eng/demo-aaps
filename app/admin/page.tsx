import type { Metadata } from "next";
import Link from "next/link";
import { StatTile } from "@/components/admin/stat-tile";
import { DailyBars } from "@/components/admin/daily-bars";
import { RankBars } from "@/components/admin/rank-bars";
import { ActionButton } from "@/components/admin/action-button";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExpireSubscriptions } from "@/lib/admin/actions";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { GEN_OCCASIONS, GEN_STYLES, MOODS, labelOf } from "@/lib/config/options";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

type Overview = Record<
  | "total_users" | "new_users_7d" | "active_users_7d" | "onboarded_users" | "generations_total" | "generations_7d"
  | "ai_calls_7d" | "ai_errors_7d" | "chat_messages_7d" | "revenue_paise_total" | "revenue_paise_30d"
  | "active_subscriptions" | "open_reports" | "saved_looks" | "wardrobe_items",
  number
>;

export default async function AdminOverviewPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: ov }, { data: days }, { data: breakdown }, { data: usage }] = await Promise.all([
    admin.rpc("admin_overview"),
    admin.rpc("admin_daily_activity", { p_days: 14 }),
    admin.rpc("admin_outfit_breakdown", { p_days: 30 }),
    admin.rpc("admin_ai_usage", { p_days: 7 }),
  ]);
  const o = ov as Overview;
  const fmtDay = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));
  const series = (k: "signups" | "generations" | "ai_errors") => (days ?? []).map((d) => ({ label: fmtDay(d.day), value: Number(d[k]) }));
  const ranks = (dim: string, list: readonly { value: string; label: string }[]) =>
    (breakdown ?? []).filter((b) => b.dimension === dim).map((b) => ({ label: labelOf(list, b.value), value: Number(b.requests) }));
  const errorRate = o.ai_calls_7d ? Math.round((o.ai_errors_7d / o.ai_calls_7d) * 100) : 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live figures from the database. Times in IST.</p>
        </div>
        <ActionButton variant="outline" size="sm" action={runExpireSubscriptions}>Close expired passes</ActionButton>
      </div>

      <section aria-label="Users" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile testId="stat-total-users" label="Total users" value={o.total_users} hint={`${o.onboarded_users} finished onboarding`} />
        <StatTile testId="stat-new-users" label="New (7 days)" value={o.new_users_7d} />
        <StatTile testId="stat-active-users" label="Active (7 days)" value={o.active_users_7d} hint="Signed in this week" />
        <StatTile testId="stat-subscriptions" label="Paid subscribers" value={o.active_subscriptions} />
      </section>

      <section aria-label="AI and revenue" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile testId="stat-generations" label="Outfit generations" value={o.generations_total} hint={`${o.generations_7d} in the last 7 days`} />
        <StatTile testId="stat-ai-calls" label="AI calls (7 days)" value={o.ai_calls_7d} hint={`${o.chat_messages_7d} stylist chat replies`} />
        <StatTile testId="stat-ai-errors" label="AI errors (7 days)" value={o.ai_errors_7d} hint={`${errorRate}% of calls · credits refunded`} />
        <StatTile
          testId="stat-revenue"
          label="Revenue"
          value={formatINR(o.revenue_paise_total / 100)}
          hint={isRazorpayConfigured() ? `${formatINR(o.revenue_paise_30d / 100)} in 30 days` : "Payments not configured yet"}
        />
      </section>

      <section aria-label="Daily activity" className="grid gap-4 lg:grid-cols-3">
        <DailyBars title="Outfit generations per day" unit="generations" points={series("generations")} />
        <DailyBars title="New sign-ups per day" unit="sign-ups" points={series("signups")} />
        <DailyBars title="AI errors per day" unit="errors" points={series("ai_errors")} />
      </section>

      <section aria-label="Popularity (last 30 days)">
        <h2 className="font-display text-3xl">What people ask for <span className="text-base text-muted-foreground">· last 30 days</span></h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <RankBars title="Most popular moods" rows={ranks("mood", MOODS)} />
          <RankBars title="Most popular occasions" rows={ranks("occasion", GEN_OCCASIONS)} />
          <RankBars title="Most popular styles" rows={ranks("style", GEN_STYLES)} />
        </div>
      </section>

      <section aria-labelledby="usage-title">
        <h2 id="usage-title" className="font-display text-3xl">AI service usage <span className="text-base text-muted-foreground">· last 7 days</span></h2>
        {usage?.length ? (
          <div className="mt-4 overflow-x-auto rounded-[1.25rem] border border-border bg-surface">
            <table className="w-full text-left text-sm" data-testid="ai-usage-table">
              <thead className="text-muted-foreground">
                <tr><th className="px-5 py-3 font-normal">Feature</th><th className="px-5 py-3 font-normal">Provider / model</th><th className="px-5 py-3 font-normal">Status</th><th className="px-5 py-3 font-normal">Error</th><th className="px-5 py-3 text-right font-normal">Calls</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usage.map((u, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5">{u.feature.replace("_", " ")}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{u.provider}</td>
                    <td className="px-5 py-2.5">{u.status === "success" ? "✓ success" : `⚠ ${u.status.replace("_", " ")}`}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{u.error_code ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{u.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No AI calls in the last 7 days.</p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Saved looks" value={o.saved_looks} />
        <StatTile label="Wardrobe items" value={o.wardrobe_items} />
        <Link href="/admin/reports" className="block">
          <StatTile testId="stat-reports" label="Open reports" value={o.open_reports} hint="Review flagged looks →" />
        </Link>
      </section>
    </div>
  );
}
