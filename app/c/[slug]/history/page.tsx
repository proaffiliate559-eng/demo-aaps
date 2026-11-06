import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/portal';
import PortalNav from '@/components/portal/PortalNav';
import { Card, EmptyState } from '@/components/ui';
import { dateTime, inr, TXN_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({ params }: { params: { slug: string } }) {
  const { card } = await getPortalSession(params.slug);
  if (!card) redirect(`/c/${params.slug}`);
  const delta = (n: number, unit: string) => (n ? `${n > 0 ? '+' : '−'}${Math.abs(n)}${unit}` : null);

  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-extrabold">History</h1>
      <p className="text-sm text-muted">{card.customer.total_visits} visits since you joined.</p>

      <section aria-label="Rewards history" className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">Points, stamps &amp; cashback</h2>
        {card.history.length === 0 ? <EmptyState title="Nothing yet" body="Your first visit will show up here." /> : (
          <Card className="divide-y divide-line">
            {card.history.map((h) => {
              const parts = [delta(h.points_delta, ' pts'), delta(h.stamps_delta, h.stamps_delta === 1 || h.stamps_delta === -1 ? ' stamp' : ' stamps'),
                Number(h.cashback_delta) ? `${Number(h.cashback_delta) > 0 ? '+' : '−'}${inr(Math.abs(Number(h.cashback_delta)))}` : null].filter(Boolean);
              const positive = h.points_delta > 0 || h.stamps_delta > 0 || Number(h.cashback_delta) > 0;
              return (
                <div key={h.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{h.note && h.kind !== 'earn_points' ? h.note : TXN_LABEL[h.kind] ?? h.kind}</p>
                    <p className="text-xs text-muted">{dateTime(h.created_at)}{h.branch ? ` · ${h.branch}` : ''}{h.amount != null ? ` · bill ${inr(h.amount)}` : ''}</p>
                  </div>
                  <span className={`shrink-0 font-bold ${positive ? 'text-good' : 'text-bad'}`}>{parts.join(' ')}</span>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {card.visits.length > 0 && (
        <section aria-label="Visits" className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Visits</h2>
          <Card className="divide-y divide-line">
            {card.visits.map((v) => (
              <div key={v.id} className="flex justify-between p-4 text-sm">
                <span>{dateTime(v.created_at)}{v.branch ? ` · ${v.branch}` : ''}</span>
                {v.amount != null && <b>{inr(v.amount)}</b>}
              </div>
            ))}
          </Card>
        </section>
      )}
      <PortalNav slug={params.slug} />
    </main>
  );
}
