import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/admin/stat-tile";
import { ActionButton } from "@/components/admin/action-button";
import { GrantPlanForm } from "@/components/admin/grant-plan-form";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserAsAdmin, revokePlan, setUserAdmin, setUserSuspended } from "@/lib/admin/actions";
import { GENDER_PREFERENCES, labelOf } from "@/lib/config/options";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(id);
  const u = authData?.user;
  if (!u) notFound();

  const [{ data: profile }, { data: sub }, { data: usage }, { data: payments }, { data: plans }, { data: roles }, { count: outfits }, { count: wardrobe }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).maybeSingle(),
    admin.from("subscriptions").select("expires_at, payment_reference, plans(name)").eq("user_id", id).eq("status", "active").maybeSingle(),
    admin.from("ai_usage").select("feature, status").eq("user_id", id),
    admin.from("payments").select("razorpay_order_id, amount_paise, status, created_at, plans(name)").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    admin.from("plans").select("slug, name").gt("price", 0).order("sort_order"),
    admin.from("user_roles").select("role").eq("user_id", id),
    admin.from("outfits").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("wardrobe_items").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("admin_audit_log").select("action, created_at, details").eq("target_user_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const suspended = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
  const gens = (usage ?? []).filter((x) => x.feature === "outfit_generation" && x.status === "success").length;
  const chats = (usage ?? []).filter((x) => x.feature === "chat" && x.status === "success").length;
  const errors = (usage ?? []).filter((x) => !["success", "pending"].includes(x.status)).length;
  const fmt = (d?: string | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(d)) : "—");
  const self = id === me.id;

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Users
      </Link>
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">{profile?.display_name ?? "Unnamed user"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {u.email} · joined {fmt(u.created_at)} · last sign-in {fmt(u.last_sign_in_at)}
          {suspended && <span className="ml-2 font-medium text-danger">Suspended</span>}
          {isAdmin && <span className="ml-2 rounded-full bg-beige px-2 py-0.5 text-xs text-foreground">Admin</span>}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Plan" value={sub?.plans?.name ?? "Free"} hint={sub?.expires_at ? `until ${fmt(sub.expires_at)}` : undefined} />
        <StatTile label="Generations" value={gens} />
        <StatTile label="Chat replies" value={chats} />
        <StatTile label="AI errors" value={errors} />
        <StatTile label="Looks / wardrobe" value={`${outfits ?? 0} / ${wardrobe ?? 0}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5 p-6">
          <h2 className="font-display text-2xl">Manage account</h2>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              variant="outline"
              disabled={self}
              action={setUserSuspended.bind(null, id, !suspended)}
              confirm={suspended ? undefined : "Suspend this user? They won't be able to sign in."}
            >
              {suspended ? "Reactivate account" : "Suspend account"}
            </ActionButton>
            <ActionButton variant="outline" disabled={self && isAdmin} action={setUserAdmin.bind(null, id, !isAdmin)} confirm={isAdmin ? "Remove admin access?" : "Give this user full admin access?"}>
              {isAdmin ? "Remove admin role" : "Make admin"}
            </ActionButton>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-medium">Complimentary plan</h3>
            <p className="mt-1 text-xs text-muted-foreground">Replaces any active plan. Logged in the audit trail.</p>
            <div className="mt-3"><GrantPlanForm userId={id} plans={plans ?? []} /></div>
            {sub && <div className="mt-3"><ActionButton variant="ghost" size="sm" action={revokePlan.bind(null, id)} confirm="Move this user back to Free?">Revoke current plan</ActionButton></div>}
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-medium text-danger">Danger zone</h3>
            <div className="mt-3">
              <ActionButton
                className="bg-danger text-white hover:bg-danger/90"
                disabled={self}
                action={deleteUserAsAdmin.bind(null, id)}
                confirm="Permanently delete this user and ALL their data and photos? This cannot be undone."
              >
                Delete user permanently
              </ActionButton>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-2xl">Profile</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Styling preference</dt><dd className="mt-1">{labelOf(GENDER_PREFERENCES, profile?.gender_preference) || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Country</dt><dd className="mt-1">{profile?.country ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Onboarding</dt><dd className="mt-1">{profile?.onboarding_completed_at ? "Complete" : "Not finished"}</dd></div>
            <div><dt className="text-muted-foreground">Language</dt><dd className="mt-1">{profile?.language ?? "—"}</dd></div>
          </dl>
          <h3 className="mt-6 text-sm font-medium">Payments</h3>
          {payments?.length ? (
            <ul className="mt-2 divide-y divide-border text-sm">
              {payments.map((p) => (
                <li key={p.razorpay_order_id} className="flex justify-between py-2">
                  <span>{fmt(p.created_at)} · {p.plans?.name}</span>
                  <span>{formatINR(p.amount_paise / 100)} · {p.status}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No payments.</p>}
          <h3 className="mt-6 text-sm font-medium">Admin activity on this user</h3>
          {audit?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {audit.map((a, i) => <li key={i}>{fmt(a.created_at)} — {a.action}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">None.</p>}
        </Card>
      </div>
    </div>
  );
}
