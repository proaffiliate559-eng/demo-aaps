import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";
const PAGE = 25;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { data: users } = await createAdminClient().rpc("admin_list_users", { p_search: q || undefined, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const total = Number(users?.[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d)) : "—");
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div>
      {sp.deleted && <Alert variant="success" className="mb-6">User deleted.</Alert>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl sm:text-5xl">Users</h1>
        <form role="search" className="relative w-full max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search email or name" aria-label="Search users" className="pl-11" />
        </form>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{total} user{total === 1 ? "" : "s"}{q && ` matching “${q}”`}</p>

      <div className="mt-6 overflow-x-auto rounded-[1.25rem] border border-border bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-normal">User</th><th className="px-5 py-3 font-normal">Plan</th>
              <th className="px-5 py-3 font-normal">Generations</th><th className="px-5 py-3 font-normal">Joined</th>
              <th className="px-5 py-3 font-normal">Last sign-in</th><th className="px-5 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users ?? []).map((u) => {
              const suspended = u.banned_until && new Date(u.banned_until) > new Date();
              return (
                <tr key={u.id} className="hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.display_name || "—"}</Link>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 capitalize">{u.plan_slug}</td>
                  <td className="px-5 py-3 tabular-nums">{u.generations}</td>
                  <td className="px-5 py-3">{fmt(u.created_at)}</td>
                  <td className="px-5 py-3">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-5 py-3">
                    {suspended ? <span className="text-danger">Suspended</span> : u.onboarded ? "Active" : "Onboarding"}
                    {u.is_admin && <span className="ml-2 rounded-full bg-beige px-2 py-0.5 text-xs">Admin</span>}
                  </td>
                </tr>
              );
            })}
            {!users?.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(page - 1)}>Previous</Link></Button> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Button asChild variant="outline" size="sm"><Link href={href(page + 1)}>Next</Link></Button> : <span />}
        </nav>
      )}
    </div>
  );
}
