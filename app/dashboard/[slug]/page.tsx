import Link from 'next/link';
import { getStaffContext } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { Alert, Card, Stat } from '@/components/ui';
import { inr, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Overview({ params, searchParams }: { params: { slug: string }; searchParams: { welcome?: string; denied?: string } }) {
  const ctx = await getStaffContext(params.slug);
  const t = ctx.tenant.id;

  if (!can(ctx.role, 'view_dashboard')) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-extrabold">Hi there</h1>
        <p className="text-muted">Your role is cashier. Use the cashier screen to add points and confirm rewards.</p>
        <Link href={`/dashboard/${params.slug}/cashier`} className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-white">Open cashier</Link>
      </div>
    );
  }

  const supabase = createClient();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [total, new30, returning, visits30, redeemed30, activeCoupons, revenue] = await Promise.all([
    count(supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', t)),
    count(supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', t).gte('created_at', since30)),
    count(supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', t).gte('total_visits', 2)),
    count(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('tenant_id', t).gte('created_at', since30)),
    count(supabase.from('reward_redemptions').select('id', { count: 'exact', head: true }).eq('tenant_id', t).eq('status', 'fulfilled').gte('created_at', since30)),
    count(supabase.from('coupons').select('id', { count: 'exact', head: true }).eq('tenant_id', t).eq('is_active', true)),
    supabase.from('purchases').select('amount, customers!inner(total_visits)').eq('tenant_id', t).gte('created_at', since30).limit(5000)
      .then((r) => (r.data ?? []) as unknown as { amount: number; customers: { total_visits: number } }[]),
  ]);

  const repeatPct = total ? Math.round((returning / total) * 100) : 0;
  const revenueReturning = revenue.filter((p) => p.customers.total_visits >= 2).reduce((a, p) => a + Number(p.amount), 0);
  const revenueAll = revenue.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Overview</h1>
          <p className="text-sm text-muted">Last 30 days · all branches</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/${params.slug}/qr`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold">Print QR codes</Link>
          <Link href={`/dashboard/${params.slug}/cashier`} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Open cashier</Link>
        </div>
      </header>

      {searchParams.welcome && (
        <Alert tone="good">Your cafe is ready. Next: print the QR code for your counter, then try the cashier screen.</Alert>
      )}
      {searchParams.denied && <Alert tone="warn">You don&apos;t have access to that page.</Alert>}

      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Stat label="Registered customers" value={num(total)} sub={`${num(new30)} new in 30 days`} />
        <Stat label="Returning customers" value={num(returning)} sub={`${repeatPct}% came back 2+ times`} />
        <Stat label="Visits" value={num(visits30)} sub="purchases recorded" />
        <Stat label="Rewards redeemed" value={num(redeemed30)} sub={`${num(activeCoupons)} active coupons`} />
        <Stat label="Revenue from returning customers" value={inr(revenueReturning)}
          sub={revenueAll ? `${Math.round((revenueReturning / revenueAll) * 100)}% of ${inr(revenueAll)} recorded` : 'Recorded at the cashier screen'} />
      </section>

      {total === 0 && (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="font-display text-lg font-bold">Get your first members</h2>
          <ol className="list-decimal pl-5 text-sm text-muted">
            <li>Open <b>QR codes</b> and print the counter QR.</li>
            <li>Customers scan it, enter their mobile number and join.</li>
            <li>At billing, open <b>Cashier</b>, scan their card QR and enter the amount.</li>
          </ol>
        </Card>
      )}
      <p className="text-xs text-muted">Charts, segments and campaign results arrive in Milestone 3.</p>
    </div>
  );
}
