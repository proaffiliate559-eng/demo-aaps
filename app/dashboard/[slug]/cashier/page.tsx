import { requirePerm } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import CashierClient from './CashierClient';

export const metadata = { title: 'Cashier' };

export default async function CashierPage({ params }: { params: { slug: string } }) {
  const ctx = await requirePerm(params.slug, 'record_purchases');
  const supabase = createClient();
  const { data: prog } = await supabase.from('loyalty_programs').select('cashback_enabled').eq('tenant_id', ctx.tenant.id).eq('is_active', true).maybeSingle();
  const branches = ctx.branches
    .filter((b) => b.is_active && (ctx.allowedBranchIds === null || ctx.allowedBranchIds.includes(b.id)))
    .map((b) => ({ id: b.id, name: b.name }));
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Cashier</h1>
        <p className="text-sm text-muted">Scan the customer&apos;s card, enter the bill, done. Every entry is saved to the ledger.</p>
      </header>
      <CashierClient tenantId={ctx.tenant.id} slug={ctx.tenant.slug} branches={branches} cashbackEnabled={!!prog?.cashback_enabled} />
    </div>
  );
}
