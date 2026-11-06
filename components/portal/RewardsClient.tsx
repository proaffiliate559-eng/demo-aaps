'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QrImage from '@/components/QrImage';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { dateTime, inr, num } from '@/lib/format';

export interface PortalReward {
  id: string; name: string; description: string | null; reward_type: string; cost_type: 'points' | 'stamps' | 'cashback';
  cost_value: number; discount_value: number | null; min_purchase_amount: number; ends_at: string | null;
}
interface Pending { id: string; code: string; reward: string; expires_at: string }

const cost = (r: PortalReward) => r.cost_type === 'points' ? `${num(r.cost_value)} pts` : r.cost_type === 'stamps' ? `${r.cost_value} stamps` : `${inr(r.cost_value)} cashback`;

export default function RewardsClient({ slug, rewards, balance, pending, branchId, openCode }: {
  slug: string; rewards: PortalReward[]; balance: { points: number; stamps: number; cashback: number };
  pending: Pending[]; branchId: string | null; openCode: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirm, setConfirm] = useState<PortalReward | null>(null);
  const [show, setShow] = useState<Pending | null>(pending.find((p) => p.code === openCode) ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const have = (r: PortalReward) => Number(balance[r.cost_type]) >= Number(r.cost_value);

  async function redeem(r: PortalReward) {
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc('request_redemption', { p_reward_id: r.id, p_branch_id: branchId });
    setBusy(false);
    if (error) return setError(error.message);
    const d = data as { redemption_id: string; code: string; expires_at: string; reward: string };
    setConfirm(null);
    setShow({ id: d.redemption_id, code: d.code, reward: d.reward, expires_at: d.expires_at });
    router.refresh();
  }

  async function cancel(p: Pending) {
    setBusy(true);
    const { error } = await supabase.rpc('cancel_my_redemption', { p_redemption_id: p.id });
    setBusy(false);
    if (error) return setError(error.message);
    setShow(null);
    router.refresh();
  }

  return (
    <>
      {error && !confirm && <Alert>{error}</Alert>}
      {pending.length > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="font-display text-lg font-bold">Your codes</h2>
          {pending.map((p) => (
            <button key={p.id} onClick={() => setShow(p)} className="flex items-center justify-between rounded-xl bg-sand p-3 text-left text-sm">
              <span><b>{p.reward}</b><br /><span className="text-warn">until {dateTime(p.expires_at)}</span></span>
              <span className="font-display font-extrabold tracking-widest">{p.code}</span>
            </button>
          ))}
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {rewards.map((r) => {
          const ok = have(r);
          const pct = Math.min(100, Math.round((Number(balance[r.cost_type]) / Number(r.cost_value)) * 100));
          return (
            <Card key={r.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.description && <p className="text-sm text-muted">{r.description}</p>}
                  {Number(r.min_purchase_amount) > 0 && <p className="text-xs text-muted">On bills of {inr(r.min_purchase_amount)}+</p>}
                </div>
                <Badge tone={ok ? 'good' : 'neutral'}>{cost(r)}</Badge>
              </div>
              {ok ? (
                <Button size="sm" className="self-start" onClick={() => { setError(null); setConfirm(r); }}>Redeem</Button>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 overflow-hidden rounded bg-ground"><div className="h-1.5 rounded bg-accent" style={{ width: `${pct}%` }} /></div>
                  <span className="text-xs font-semibold text-warn">
                    {r.cost_type === 'cashback' ? `${inr(Number(r.cost_value) - Number(balance.cashback))} more` : `${num(Number(r.cost_value) - Number(balance[r.cost_type]))} more ${r.cost_type}`}
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {(confirm || show) && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={(e) => e.target === e.currentTarget && (setConfirm(null), setShow(null))}>
          <div role="dialog" aria-modal="true" aria-label={confirm ? 'Confirm redemption' : 'Reward code'} className="flex w-full max-w-md flex-col items-center gap-3 rounded-t-[28px] bg-white p-6 pb-10 text-center">
            <span className="h-1 w-10 rounded bg-line" />
            {confirm && (
              <>
                <h2 className="font-display text-xl font-bold">{confirm.name}</h2>
                <p className="text-sm text-muted">Use {cost(confirm)}? You&apos;ll get a code to show the staff. If you don&apos;t use it in time, it comes back.</p>
                {error && <Alert>{error}</Alert>}
                <Button className="w-full" disabled={busy} onClick={() => redeem(confirm)}>{busy ? 'Please wait…' : 'Get my code'}</Button>
                <Button variant="ghost" className="w-full" onClick={() => setConfirm(null)}>Not now</Button>
              </>
            )}
            {show && !confirm && (
              <>
                <h2 className="font-display text-xl font-bold">{show.reward}</h2>
                <p className="text-sm text-muted">Show this to the staff. Valid until {dateTime(show.expires_at)}.</p>
                <QrImage value={`CR:R:${show.code}`} size={180} label={`Reward code ${show.code}`} />
                <div className="w-full rounded-2xl border-2 border-dashed border-brand p-3 font-display text-3xl font-extrabold tracking-[0.2em] text-brand">{show.code}</div>
                <Button className="w-full" onClick={() => setShow(null)}>Done</Button>
                <button className="text-sm font-semibold text-bad" disabled={busy} onClick={() => cancel(show)}>Cancel code and return points</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
