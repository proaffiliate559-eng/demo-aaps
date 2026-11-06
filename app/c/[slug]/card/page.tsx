import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPortalSession, getPublicTenant } from '@/lib/portal';
import CardQr from '@/components/portal/CardQr';
import PortalNav from '@/components/portal/PortalNav';
import { Alert, Card } from '@/components/ui';
import { dateTime, inr, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CardPage({ params, searchParams }: { params: { slug: string }; searchParams: { welcome?: string } }) {
  const t = await getPublicTenant(params.slug);
  const { card } = await getPortalSession(params.slug);
  if (!card) redirect(`/c/${params.slug}`);
  const p = t.program;
  const { wallet, tier, next_tier: next } = card;
  const pct = next ? Math.min(100, Math.round(((wallet.lifetime_points - tier.min_points) / (next.min_points - tier.min_points)) * 100)) : 100;
  const goal = p?.stamp_goal ?? 0;
  const stampsInRound = Math.min(wallet.stamps, goal);
  const firstName = (card.customer.name ?? '').split(' ')[0] || 'there';

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{t.name}</p>
          <h1 className="font-display text-2xl font-bold">Hi {firstName}</h1>
        </div>
      </header>
      {searchParams.welcome && <Alert tone="good">Welcome! Your card is ready. Show the QR below when you pay.</Alert>}

      <section aria-label="Balance" className="flex flex-col gap-4 rounded-[24px] bg-brand p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider opacity-90">{p?.name}</span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-ink">{tier.name} member</span>
        </div>
        <div className="flex items-end gap-6">
          {p?.points_enabled !== false && (
            <div><p className="font-display text-5xl font-extrabold leading-none">{num(wallet.points)}</p><p className="text-sm opacity-90">points</p></div>
          )}
          {p?.cashback_enabled && (
            <div><p className="font-display text-3xl font-extrabold leading-none">{inr(wallet.cashback)}</p><p className="text-sm opacity-90">cashback</p></div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded bg-white/25"><div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} /></div>
          <span className="text-sm">{next ? `${num(next.min_points - wallet.lifetime_points)} points to ${next.name} (${next.multiplier}x points)` : 'Top tier reached'}</span>
        </div>
      </section>

      {p?.stamps_enabled && goal > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Stamp card</h2>
            <span className="text-sm text-muted">{wallet.stamps} collected</span>
          </div>
          <div className="grid grid-cols-5 gap-2" role="img" aria-label={`${stampsInRound} of ${goal} stamps`}>
            {Array.from({ length: goal }).map((_, i) => (
              <span key={i} className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg ${i < stampsInRound ? 'border-brand bg-brand text-white' : 'border-dashed border-line'}`}>
                {i < stampsInRound ? '✓' : ''}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted">
            {wallet.stamps >= goal ? <>You have enough for a free treat. <Link href={`/c/${params.slug}/rewards`} className="font-semibold text-brand underline">Redeem</Link></>
              : `${goal - stampsInRound} more ${p.stamp_item_keyword ? p.stamp_item_keyword + (goal - stampsInRound > 1 ? 's' : '') : 'visit' + (goal - stampsInRound > 1 ? 's' : '')} for a free treat`}
          </p>
        </Card>
      )}

      {card.pending_redemptions.length > 0 && (
        <Card className="flex flex-col gap-2 border-accent p-5">
          <h2 className="font-display text-lg font-bold">Ready to use</h2>
          {card.pending_redemptions.map((r) => (
            <Link key={r.id} href={`/c/${params.slug}/rewards?code=${r.code}`} className="flex items-center justify-between rounded-xl bg-sand p-3 text-sm">
              <span><b>{r.reward}</b><br /><span className="text-warn">until {dateTime(r.expires_at)}</span></span>
              <span className="font-display text-lg font-extrabold tracking-widest">{r.code}</span>
            </Link>
          ))}
        </Card>
      )}

      <Card className="p-5">
        <CardQr slug={params.slug} memberLabel={card.customer.referral_code ? `Member · ${card.customer.referral_code}` : 'Member'} />
      </Card>

      <PortalNav slug={params.slug} />
    </main>
  );
}
