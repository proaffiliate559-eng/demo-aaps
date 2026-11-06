import { requirePerm } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui';
import { inr } from '@/lib/format';
import { BranchRuleForm, ProgramForm, type ProgramValues, type RuleValues } from './Forms';
import { removeBranchRule, saveBranchRule, saveProgram } from './actions';

export const metadata = { title: 'Loyalty rules' };

export default async function LoyaltyPage({ params }: { params: { slug: string } }) {
  const ctx = await requirePerm(params.slug, 'manage_loyalty');
  const supabase = createClient();
  const { data: prog } = await supabase.from('loyalty_programs').select('*').eq('tenant_id', ctx.tenant.id).eq('is_active', true).maybeSingle();
  if (!prog) return <EmptyState title="No loyalty program" body="Contact support: your program was not created." />;
  const { data: rules } = await supabase.from('loyalty_rules').select('*').eq('program_id', prog.id).eq('is_active', true);
  const def = (rules ?? []).find((r: { branch_id: string | null }) => r.branch_id === null) as RuleValues | undefined;
  const overrides = (rules ?? []).filter((r: { branch_id: string | null }) => r.branch_id !== null) as (RuleValues & { id: string; branch_id: string })[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Loyalty rules</h1>
        <p className="text-sm text-muted">How customers earn. Changes apply to new bills only; past rewards stay as they are.</p>
      </header>
      <ProgramForm action={saveProgram.bind(null, params.slug)} p={{ ...(prog as ProgramValues), ...(def ?? {}) }} />

      {ctx.branches.length > 1 && (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-display text-lg font-bold">Branch-specific rules</h2>
            <p className="text-sm text-muted">Optional. A branch with its own rule uses it instead of the rule above.</p>
          </div>
          {overrides.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
              <span><b>{ctx.branches.find((b) => b.id === r.branch_id)?.name}</b> · {r.points_per_100} pts/₹100 · min {inr(r.min_purchase_amount)}
                {Number(r.cashback_percent) > 0 && ` · ${r.cashback_percent}% cashback`}</span>
              <form action={removeBranchRule.bind(null, params.slug, r.id)}><button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">Remove</button></form>
            </div>
          ))}
          <BranchRuleForm action={saveBranchRule.bind(null, params.slug)} branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))} />
        </Card>
      )}
    </div>
  );
}
