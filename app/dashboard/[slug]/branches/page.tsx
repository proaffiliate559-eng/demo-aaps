import { revalidatePath } from 'next/cache';
import { requirePerm, getStaffContext } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { Badge, Button, Card, Field, Input } from '@/components/ui';

export const metadata = { title: 'Branches' };

async function addBranch(slug: string, form: FormData) {
  'use server';
  const ctx = await getStaffContext(slug);
  const name = String(form.get('name') || '').trim().slice(0, 120);
  const city = String(form.get('city') || '').trim().slice(0, 80);
  if (name.length < 2) return;
  const supabase = createClient();
  const { data } = await supabase.from('branches').insert({ tenant_id: ctx.tenant.id, name, city: city || null }).select('id').single();
  if (data) {
    await supabase.rpc('create_qr_code', { p_tenant_id: ctx.tenant.id, p_branch_id: data.id, p_kind: 'registration', p_label: `${name} · Join & earn` });
  }
  revalidatePath(`/dashboard/${slug}/branches`);
}

async function toggleBranch(slug: string, id: string, active: boolean) {
  'use server';
  const ctx = await getStaffContext(slug);
  const supabase = createClient();
  await supabase.from('branches').update({ is_active: active }).eq('id', id).eq('tenant_id', ctx.tenant.id);
  revalidatePath(`/dashboard/${slug}/branches`);
}

export default async function BranchesPage({ params }: { params: { slug: string } }) {
  const ctx = await requirePerm(params.slug, 'manage_branches');
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Branches</h1>
        <p className="text-sm text-muted">Each branch gets its own join QR. Rules can be set per branch in Loyalty rules.</p>
      </header>
      <Card className="p-5">
        <form action={addBranch.bind(null, params.slug)} className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Branch name" htmlFor="name"><Input id="name" name="name" required placeholder="Koramangala" /></Field>
          <Field label="City" htmlFor="city"><Input id="city" name="city" placeholder="Bengaluru" /></Field>
          <Button type="submit">Add branch</Button>
        </form>
      </Card>
      <Card className="divide-y divide-line">
        {ctx.branches.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 p-4">
            <div><b>{b.name}</b>{b.city && <span className="text-sm text-muted"> · {b.city}</span>}</div>
            <div className="flex items-center gap-3">
              {b.is_active ? <Badge tone="good">Active</Badge> : <Badge>Closed</Badge>}
              <form action={toggleBranch.bind(null, params.slug, b.id, !b.is_active)}>
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">{b.is_active ? 'Close' : 'Reopen'}</button>
              </form>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
