import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPortalSession, getPublicTenant } from '@/lib/portal';
import RewardsClient, { type PortalReward } from '@/components/portal/RewardsClient';
import PortalNav from '@/components/portal/PortalNav';
import { Card, EmptyState } from '@/components/ui';
import { inr, shortDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Coupon { id: string; code: string; name: string; discount_type: string; discount_value: number; min_purchase_amount: number; valid_to: string | null }

export default async function PortalRewards({ params, searchParams }: { params: { slug: string }; searchParams: { code?: string; b?: string } }) {
  const t = await getPublicTenant(params.slug);
  const { card } = await getPortalSession(params.slug);
  if (!card) redirect(`/c/${params.slug}`);
  const supabase = createClient();
  const now = new Date().toISOString();
  const [{ data: rewards }, { data: coupons }] = await Promise.all([
    supabase.from('rewards')
      .select('id, name, description, reward_type, cost_type, cost_value, discount_value, min_purchase_amount, ends_at, starts_at, stock')
      .eq('tenant_id', t.id).eq('is_active', true).order('sort_order').order('cost_value'),
    supabase.from('coupons').select('id, code, name, discount_type, discount_value, min_purchase_amount, valid_to')
      .eq('tenant_id', t.id).eq('is_active', true).lte('valid_from', now).or(`valid_to.is.null,valid_to.gt."${now}"`),
  ]);
  const list = ((rewards ?? []) as (PortalReward & { starts_at: string | null; stock: number | null })[])
    .filter((r) => (!r.ends_at || r.ends_at > now) && (!r.starts_at || r.starts_at <= now) && r.stock !== 0);

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <h1 className="font-display text-3xl font-extrabold">Rewards</h1>
        <span className="rounded-full bg-brand px-3 py-1.5 text-sm font-bold text-white">{card.wallet.points} pts · {card.wallet.stamps} stamps</span>
      </header>
      {list.length === 0 ? <EmptyState title="No rewards right now" body="Check back soon." /> : (
        <RewardsClient slug={params.slug} rewards={list} pending={card.pending_redemptions}
          balance={{ points: card.wallet.points, stamps: card.wallet.stamps, cashback: Number(card.wallet.cashback) }}
          branchId={t.branches.some((b) => b.id === searchParams.b) ? searchParams.b! : null}
          openCode={searchParams.code ?? null} />
      )}
      {(coupons ?? []).length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Coupons">
          <h2 className="font-display text-xl font-bold">Your coupons</h2>
          {(coupons as Coupon[]).map((c) => (
            <Card key={c.id} className="flex items-center justify-between gap-3 border-dashed p-4">
              <div>
                <b>{c.name}</b>
                <p className="text-xs text-muted">
                  {c.discount_type === 'percent' ? `${c.discount_value}% off` : c.discount_type === 'fixed' ? `${inr(c.discount_value)} off` : 'Free item'}
                  {Number(c.min_purchase_amount) > 0 && ` · min ${inr(c.min_purchase_amount)}`}{c.valid_to && ` · till ${shortDate(c.valid_to)}`}
                </p>
              </div>
              <span className="font-display font-extrabold tracking-widest">{c.code}</span>
            </Card>
          ))}
          <p className="text-xs text-muted">Show the coupon code at billing.</p>
        </section>
      )}
      <PortalNav slug={params.slug} />
    </main>
  );
}
