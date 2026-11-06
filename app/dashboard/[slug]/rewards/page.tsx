import { requirePerm } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, EmptyState } from '@/components/ui';
import { inr, num, shortDate } from '@/lib/format';
import RewardForm from './RewardForm';
import { createReward, toggleReward } from './actions';

export const metadata = { title: 'Rewards' };

interface Reward {
  id: string; name: string; description: string | null; reward_type: string; cost_type: string; cost_value: number;
  discount_value: number | null; min_purchase_amount: number; max_per_customer: number | null; stock: number | null;
  is_active: boolean; ends_at: string | null; branch_id: string | null;
}

const costLabel = (r: Reward) => r.cost_type === 'points' ? `${num(r.cost_value)} pts` : r.cost_type === 'stamps' ? `${r.cost_value} stamps` : `${inr(r.cost_value)} cashback`;
const typeLabel = (r: Reward) => r.reward_type === 'free_item' ? 'Free item' : r.reward_type === 'percent_discount' ? `${r.discount_value}% off` : `${inr(r.discount_value)} off`;

export default async function RewardsPage({ params }: { params: { slug: string } }) {
  const ctx = await requirePerm(params.slug, 'manage_loyalty');
  const supabase = createClient();
  const [{ data: rewards }, { data: counts }] = await Promise.all([
    supabase.from('rewards').select('*').eq('tenant_id', ctx.tenant.id).order('is_active', { ascending: false }).order('sort_order').order('cost_value'),
    supabase.from('reward_redemptions').select('reward_id').eq('tenant_id', ctx.tenant.id).eq('status', 'fulfilled').limit(10000),
  ]);
  const used = new Map<string, number>();
  (counts ?? []).forEach((r: { reward_id: string }) => used.set(r.reward_id, (used.get(r.reward_id) ?? 0) + 1));
  const list = (rewards ?? []) as Reward[];
  const branchName = (id: string | null) => ctx.branches.find((b) => b.id === id)?.name;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Rewards</h1>
        <p className="text-sm text-muted">What customers can unlock with points, stamps or cashback.</p>
      </header>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-bold">Add a reward</h2>
        <RewardForm action={createReward.bind(null, params.slug)} branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))} />
      </Card>

      {list.length === 0 ? (
        <EmptyState title="No rewards yet" body="Add your first reward above, like a free coffee for 5 stamps." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">Reward</th><th className="p-3">Gives</th><th className="p-3">Costs</th><th className="p-3">Rules</th><th className="p-3">Used</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="p-3"><b>{r.name}</b>{r.description && <p className="text-xs text-muted">{r.description}</p>}</td>
                  <td className="p-3">{typeLabel(r)}</td>
                  <td className="p-3 font-semibold">{costLabel(r)}</td>
                  <td className="p-3 text-xs text-muted">
                    {Number(r.min_purchase_amount) > 0 && <div>Min bill {inr(r.min_purchase_amount)}</div>}
                    {r.max_per_customer && <div>{r.max_per_customer} per customer</div>}
                    {r.stock != null && <div>{r.stock} left</div>}
                    {r.ends_at && <div>Until {shortDate(r.ends_at)}</div>}
                    {r.branch_id && <div>Only {branchName(r.branch_id)}</div>}
                  </td>
                  <td className="p-3">{used.get(r.id) ?? 0}</td>
                  <td className="p-3">{r.is_active ? <Badge tone="good">Active</Badge> : <Badge>Paused</Badge>}</td>
                  <td className="p-3">
                    <form action={toggleReward.bind(null, params.slug, r.id, !r.is_active)}>
                      <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">{r.is_active ? 'Pause' : 'Activate'}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
