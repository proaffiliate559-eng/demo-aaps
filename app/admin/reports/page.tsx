import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/admin/action-button";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setReportStatus } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status === "reviewed" || sp.status === "dismissed" ? sp.status : "open";
  const { data: reports } = await createAdminClient()
    .from("content_reports")
    .select("id, reason, status, created_at, reporter_id, outfits(id, name, description, provider, is_mock, outfit_data)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  const fmt = (d: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(d));

  return (
    <div>
      <h1 className="font-display text-4xl sm:text-5xl">Reported content</h1>
      <nav aria-label="Report status" className="mt-4 flex gap-2">
        {(["open", "reviewed", "dismissed"] as const).map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} aria-current={s === status ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm capitalize", s === status ? "border-foreground bg-foreground text-background" : "border-border")}>
            {s}
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-3">
        {!reports?.length && <p className="text-sm text-muted-foreground">No {status} reports.</p>}
        {reports?.map((r) => {
          const items = (r.outfits?.outfit_data as { items?: Record<string, unknown> } | null)?.items;
          return (
            <Card key={r.id} className="p-5" data-testid="report">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{fmt(r.created_at)} · reporter {r.reporter_id?.slice(0, 8) ?? "deleted"}</p>
                  <p className="mt-2 font-medium">“{r.reason}”</p>
                  {r.outfits ? (
                    <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
                      <p className="font-medium">{r.outfits.name} <span className="text-xs text-muted-foreground">· {r.outfits.provider}{r.outfits.is_mock ? " (mock)" : ""}</span></p>
                      <p className="mt-1 text-muted-foreground">{r.outfits.description}</p>
                      {items && <p className="mt-1 text-xs text-muted-foreground">{Object.values(items).flat().filter(Boolean).join(" · ")}</p>}
                    </div>
                  ) : <p className="mt-2 text-sm text-muted-foreground">Outfit no longer exists.</p>}
                </div>
                <div className="flex gap-2">
                  {status !== "reviewed" && <ActionButton size="sm" action={setReportStatus.bind(null, r.id, "reviewed")}>Mark reviewed</ActionButton>}
                  {status !== "dismissed" && <ActionButton size="sm" variant="outline" action={setReportStatus.bind(null, r.id, "dismissed")}>Dismiss</ActionButton>}
                  {status !== "open" && <ActionButton size="sm" variant="ghost" action={setReportStatus.bind(null, r.id, "open")}>Reopen</ActionButton>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
