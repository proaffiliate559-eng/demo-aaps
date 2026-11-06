import { requirePerm } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { Badge, Card, EmptyState } from '@/components/ui';
import { num } from '@/lib/format';
import { PrintButton, QrForm } from './QrForm';
import { createQr, toggleQr } from './actions';

export const metadata = { title: 'QR codes' };
export const dynamic = 'force-dynamic';

interface Qr { id: string; code: string; label: string; kind: string; branch_id: string | null; scan_count: number; is_active: boolean }

export default async function QrPage({ params }: { params: { slug: string } }) {
  const ctx = await requirePerm(params.slug, 'manage_qr');
  const supabase = createClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data }, { data: recent }, { data: joined }] = await Promise.all([
    supabase.from('qr_codes').select('id, code, label, kind, branch_id, scan_count, is_active').eq('tenant_id', ctx.tenant.id).order('created_at'),
    supabase.from('qr_scans').select('qr_code_id').eq('tenant_id', ctx.tenant.id).gte('created_at', since).limit(20000),
    supabase.from('customers').select('source_qr_id').eq('tenant_id', ctx.tenant.id).not('source_qr_id', 'is', null).limit(20000),
  ]);
  const codes = (data ?? []) as Qr[];
  const tally = (rows: { [k: string]: string }[] | null, key: string) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => m.set(r[key], (m.get(r[key]) ?? 0) + 1));
    return m;
  };
  const week = tally(recent as { qr_code_id: string }[] | null, 'qr_code_id');
  const signups = tally(joined as { source_qr_id: string }[] | null, 'source_qr_id');
  const branchName = (id: string | null) => ctx.branches.find((b) => b.id === id)?.name ?? 'All branches';
  const app = serverEnv.appUrl;

  return (
    <div className="flex flex-col gap-6">
      <header className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">QR codes</h1>
          <p className="text-sm text-muted">Stick these on tables, the counter or flyers. Each scan is counted, and new members are linked to the QR they used.</p>
        </div>
        {codes.length > 0 && <PrintButton />}
      </header>

      <Card className="no-print p-5">
        <h2 className="mb-4 font-display text-lg font-bold">Create QR codes</h2>
        <QrForm action={createQr.bind(null, params.slug)} branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))} />
      </Card>

      {codes.length === 0 ? (
        <EmptyState title="No QR codes yet" body="Create one above." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {codes.map((q) => (
            <Card key={q.id} className={`print-break flex flex-col items-center gap-2 border-dashed p-4 text-center ${q.is_active ? '' : 'opacity-50'}`}>
              <span className="font-display text-sm font-extrabold text-brand">{ctx.tenant.name}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/qr/${q.code}/png?size=480`} width={180} height={180} alt={`QR code for ${q.label}`} />
              <b className="text-lg">{q.label}</b>
              <span className="text-xs text-muted">Scan to join &amp; earn rewards</span>
              <div className="no-print mt-2 flex w-full flex-col gap-2 border-t border-line pt-3 text-xs">
                <div className="flex justify-between"><span className="text-muted">{branchName(q.branch_id)}</span><Badge>{q.kind}</Badge></div>
                <div className="flex justify-between"><span>Scans</span><b>{num(q.scan_count)} · {num(week.get(q.id) ?? 0)} this week</b></div>
                <div className="flex justify-between"><span>New members</span><b>{num(signups.get(q.id) ?? 0)}</b></div>
                <span className="break-all text-muted">{app}/q/{q.code}</span>
                <div className="flex gap-2">
                  <a href={`/api/qr/${q.code}/png?download=1`} className="flex-1 rounded-lg border border-line py-1.5 font-semibold">Download PNG</a>
                  <form action={toggleQr.bind(null, params.slug, q.id, !q.is_active)} className="flex-1">
                    <button className="w-full rounded-lg border border-line py-1.5 font-semibold">{q.is_active ? 'Disable' : 'Enable'}</button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
