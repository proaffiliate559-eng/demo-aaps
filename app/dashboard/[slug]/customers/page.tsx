import Link from 'next/link';
import { requirePerm } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, EmptyState, Input } from '@/components/ui';
import { daysAgo, inr, num, shortDate } from '@/lib/format';
import { maskPhone } from '@/lib/phone';
import { can } from '@/lib/permissions';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string; name: string | null; phone: string; email: string | null; created_at: string; last_visit_at: string | null;
  total_visits: number; total_spent: number; status: string;
  loyalty_wallets: { points_balance: number; stamps_balance: number; tier: string } | { points_balance: number; stamps_balance: number; tier: string }[] | null;
}

const PAGE = 50;

export default async function CustomersPage({ params, searchParams }: { params: { slug: string }; searchParams: { q?: string; page?: string } }) {
  const ctx = await requirePerm(params.slug, 'view_customers');
  const showFull = can(ctx.role, 'manage_customers');
  const q = (searchParams.q ?? '').trim().slice(0, 60);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const supabase = createClient();

  let query = supabase
    .from('customers')
    .select('id, name, phone, email, created_at, last_visit_at, total_visits, total_spent, status, loyalty_wallets(points_balance, stamps_balance, tier)', { count: 'exact' })
    .eq('tenant_id', ctx.tenant.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const safe = q.replace(/[%,()]/g, ' ');
    query = digits.length >= 4 ? query.ilike('phone', `%${digits}%`) : query.ilike('name', `%${safe}%`);
  }
  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const status = (r: Row) => {
    if (r.status !== 'active') return <Badge tone="bad">Blocked</Badge>;
    if (!r.last_visit_at) return <Badge>No visit yet</Badge>;
    const d = (Date.now() - new Date(r.last_visit_at).getTime()) / 86_400_000;
    return d > 30 ? <Badge tone="warn">Inactive</Badge> : <Badge tone="good">Active</Badge>;
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Customers</h1>
          <p className="text-sm text-muted">{num(count ?? 0)} members. Segments and profiles arrive in Milestone 3.</p>
        </div>
        <form className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Search customers</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Name or phone" className="h-11 w-64" />
          <button className="rounded-xl bg-brand px-4 font-semibold text-white">Search</button>
        </form>
      </header>

      {rows.length === 0 ? (
        <EmptyState title={q ? 'No matches' : 'No customers yet'} body={q ? 'Try another name or number.' : 'Print your QR code so customers can join.'} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">Customer</th><th className="p-3">Tier</th><th className="p-3">Visits</th><th className="p-3">Spent</th><th className="p-3">Points</th><th className="p-3">Stamps</th><th className="p-3">Joined</th><th className="p-3">Last visit</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = Array.isArray(r.loyalty_wallets) ? r.loyalty_wallets[0] : r.loyalty_wallets;
                return (
                  <tr key={r.id} className="border-t border-line">
                    <td className="p-3"><b>{r.name || '—'}</b><div className="text-xs text-muted">{showFull ? r.phone : maskPhone(r.phone)}{showFull && r.email ? ` · ${r.email}` : ''}</div></td>
                    <td className="p-3 capitalize">{w?.tier ?? '—'}</td>
                    <td className="p-3">{r.total_visits}</td>
                    <td className="p-3">{inr(r.total_spent)}</td>
                    <td className="p-3">{num(w?.points_balance ?? 0)}</td>
                    <td className="p-3">{w?.stamps_balance ?? 0}</td>
                    <td className="p-3">{shortDate(r.created_at)}</td>
                    <td className="p-3">{daysAgo(r.last_visit_at)}</td>
                    <td className="p-3">{status(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {(count ?? 0) > PAGE && (
        <nav className="flex gap-3 text-sm font-semibold" aria-label="Pages">
          {page > 1 && <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="underline">← Previous</Link>}
          {page * PAGE < (count ?? 0) && <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="underline">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
