'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import QrScanner from '@/components/QrScanner';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import { classifyScan } from '@/lib/qr-classify';
import { inr, num, daysAgo } from '@/lib/format';
import { maskPhone } from '@/lib/phone';

interface Wallet { points_balance: number; stamps_balance: number; cashback_balance: number; tier: string }
interface Customer {
  id: string; name: string | null; phone: string; status: string; total_visits: number; total_spent: number;
  last_visit_at: string | null; birthday: string | null; loyalty_wallets: Wallet | Wallet[] | null;
}
interface Item { name: string; qty: number; category: string }
interface ApiError { error?: { code: string; message: string } }

const walletOf = (c: Customer): Wallet => {
  const w = Array.isArray(c.loyalty_wallets) ? c.loyalty_wallets[0] : c.loyalty_wallets;
  return w ?? { points_balance: 0, stamps_balance: 0, cashback_balance: 0, tier: 'silver' };
};

async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; code?: string }> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json()) as T & ApiError;
    if (!r.ok) return { ok: false, message: j.error?.message ?? 'Something went wrong', code: j.error?.code };
    return { ok: true, data: j };
  } catch {
    return { ok: false, message: 'No connection. Check the internet and try again.' };
  }
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function CashierClient({ tenantId, slug, branches, cashbackEnabled }: {
  tenantId: string; slug: string; branches: { id: string; name: string }[]; cashbackEnabled: boolean;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [scan, setScan] = useState<null | 'any'>(null);
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // purchase form
  const [amount, setAmount] = useState('');
  const [billRef, setBillRef] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [useCashback, setUseCashback] = useState('');
  const [key, setKey] = useState(newKey);

  // walk-in form
  const [newName, setNewName] = useState('');
  const [consent, setConsent] = useState(false);

  // redemption
  const [code, setCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cr:branch:${slug}`);
      if (saved && branches.some((b) => b.id === saved)) setBranchId(saved);
    } catch { /* storage unavailable */ }
  }, [slug, branches]);
  useEffect(() => {
    try { if (branchId) localStorage.setItem(`cr:branch:${slug}`, branchId); } catch { /* ignore */ }
  }, [branchId, slug]);

  const resetPurchase = () => { setAmount(''); setBillRef(''); setItems([]); setUseCashback(''); setKey(newKey()); };

  const resolve = useCallback(async (body: { token?: string; phone?: string }) => {
    setBusy(true); setError(null); setResult(null); setNotFoundPhone(null);
    const r = await post<{ customer: Customer | null }>('/api/staff/resolve', { tenantId, ...body });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (!r.data.customer) { setCustomer(null); setNotFoundPhone(body.phone ?? null); return; }
    setCustomer(r.data.customer); resetPurchase();
  }, [tenantId]);

  const confirmCode = useCallback(async (c: string) => {
    setRedeemMsg(null);
    if (!branchId) return setRedeemMsg({ ok: false, text: 'Choose a branch first' });
    const r = await post<{ ok: boolean; message: string; reward?: string; customer?: { name: string | null } }>(
      '/api/staff/redemptions/confirm', { tenantId, branchId, code: c });
    if (!r.ok) return setRedeemMsg({ ok: false, text: r.message });
    setRedeemMsg({ ok: r.data.ok, text: r.data.ok ? `Valid · serve "${r.data.reward}"${r.data.customer?.name ? ` for ${r.data.customer.name}` : ''}` : r.data.message });
    if (r.data.ok) setCode('');
  }, [tenantId, branchId]);

  const onScan = useCallback((text: string) => {
    setScan(null);
    const s = classifyScan(text);
    if (s.kind === 'customer') resolve({ token: s.token });
    else if (s.kind === 'redemption') { setCode(s.code); confirmCode(s.code); }
    else setError('That QR is not a customer card or reward code.');
  }, [resolve, confirmCode]);

  async function registerWalkIn() {
    if (!notFoundPhone) return;
    setBusy(true); setError(null);
    const r = await post<{ customer_id: string }>('/api/staff/customers', { tenantId, branchId, phone: notFoundPhone, name: newName || undefined, whatsappConsent: consent });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setNewName(''); setConsent(false);
    resolve({ phone: notFoundPhone });
  }

  const amountNum = Number(amount);
  const cbNum = Number(useCashback || 0);
  const w = customer ? walletOf(customer) : null;

  async function recordPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    if (!branchId) return setError('Choose a branch first');
    if (!(amountNum >= 0) || amount === '') return setError('Enter the bill amount');
    if (cbNum > 0 && w && cbNum > Number(w.cashback_balance)) return setError('Not enough cashback');
    setBusy(true); setError(null);
    const r = await post<{ points_earned: number; stamps_earned: number; cashback_earned: number; duplicate: boolean; wallet: { points: number; stamps: number; cashback: number; tier: string } }>(
      '/api/staff/purchases', {
        tenantId, branchId, customerId: customer.id, amount: amountNum, idempotencyKey: key,
        billRef: billRef || undefined, cashbackToUse: cbNum,
        items: items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), qty: i.qty, category: i.category.trim() || undefined })),
      });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const d = r.data;
    const parts = [d.points_earned ? `+${d.points_earned} points` : null, d.stamps_earned ? `+${d.stamps_earned} stamp${d.stamps_earned > 1 ? 's' : ''}` : null,
      Number(d.cashback_earned) ? `+${inr(d.cashback_earned)} cashback` : null].filter(Boolean);
    setResult(`${d.duplicate ? 'Already recorded earlier. ' : ''}${parts.join(', ') || 'Visit recorded (bill below minimum for rewards)'}. New balance: ${num(d.wallet.points)} pts, ${d.wallet.stamps} stamps${cashbackEnabled ? `, ${inr(d.wallet.cashback)} cashback` : ''}.`);
    setCustomer({ ...customer, total_visits: customer.total_visits + (d.duplicate ? 0 : 1),
      loyalty_wallets: { points_balance: d.wallet.points, stamps_balance: d.wallet.stamps, cashback_balance: d.wallet.cashback, tier: d.wallet.tier } });
    resetPurchase();
  }

  const branchName = useMemo(() => branches.find((b) => b.id === branchId)?.name, [branches, branchId]);

  if (branches.length === 0) return <Alert tone="warn">You are not assigned to any branch. Ask the owner to add you to a branch.</Alert>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="flex flex-col gap-4" aria-label="Add points">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Field label="Branch" htmlFor="branch">
                <Select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            </div>
            <Button variant="accent" onClick={() => setScan('any')}>Scan QR</Button>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (phone.trim()) resolve({ phone }); }}>
            <label htmlFor="phone" className="sr-only">Customer mobile number</label>
            <Input id="phone" inputMode="tel" placeholder="Or type mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" variant="ghost" disabled={busy}>Find</Button>
          </form>
          {error && <Alert>{error}</Alert>}
          {result && <Alert tone="good">{result}</Alert>}
        </Card>

        {notFoundPhone && (
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold">New customer: {notFoundPhone}</h2>
            <p className="text-sm text-muted">Not a member yet. Register them now; they can open their card later by signing in with this number.</p>
            <Field label="Name (optional)" htmlFor="newName"><Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
              Customer agreed to receive offers on WhatsApp (ask them first)
            </label>
            <Button onClick={registerWalkIn} disabled={busy}>Register &amp; continue</Button>
          </Card>
        )}

        {customer && w && (
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{customer.name || 'Member'}</h2>
                <p className="text-sm text-muted">{maskPhone(customer.phone)} · {customer.total_visits} visits · last {daysAgo(customer.last_visit_at)}</p>
              </div>
              <Badge tone="brand">{w.tier}</Badge>
            </div>
            {customer.status !== 'active' && <Alert>This customer is blocked.</Alert>}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-ground p-3"><p className="font-display text-2xl font-extrabold">{num(w.points_balance)}</p><p className="text-xs text-muted">points</p></div>
              <div className="rounded-xl bg-ground p-3"><p className="font-display text-2xl font-extrabold">{w.stamps_balance}</p><p className="text-xs text-muted">stamps</p></div>
              <div className="rounded-xl bg-ground p-3"><p className="font-display text-2xl font-extrabold">{inr(w.cashback_balance)}</p><p className="text-xs text-muted">cashback</p></div>
            </div>

            <form onSubmit={recordPurchase} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bill amount (₹)" htmlFor="amount">
                  <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required />
                </Field>
                <Field label="Bill number (recommended)" htmlFor="bill" hint="Stops the same bill being used twice">
                  <Input id="bill" value={billRef} onChange={(e) => setBillRef(e.target.value)} />
                </Field>
              </div>
              {cashbackEnabled && Number(w.cashback_balance) > 0 && (
                <Field label={`Use cashback (available ${inr(w.cashback_balance)})`} htmlFor="cb">
                  <Input id="cb" inputMode="decimal" value={useCashback} onChange={(e) => setUseCashback(e.target.value.replace(/[^\d.]/g, ''))} />
                </Field>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Items (optional, for item-based stamps)</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setItems([...items, { name: '', qty: 1, category: '' }])}>+ Add item</Button>
                </div>
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2">
                    <Input aria-label={`Item ${i + 1} name`} placeholder="Cappuccino" value={it.name}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input aria-label={`Item ${i + 1} quantity`} inputMode="numeric" value={String(it.qty)}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) } : x)))} />
                    <Input aria-label={`Item ${i + 1} category`} placeholder="coffee" value={it.category}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} />
                    <Button type="button" size="sm" variant="ghost" aria-label={`Remove item ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={busy || customer.status !== 'active'}>
                {busy ? 'Saving…' : `Add points${branchName ? ` · ${branchName}` : ''}`}
              </Button>
            </form>
          </Card>
        )}
      </section>

      <section aria-label="Confirm reward" className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-bold">Confirm a reward</h2>
          <p className="text-sm text-muted">The customer shows a reward code or QR on their phone. Scan it or type the 8-letter code.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) confirmCode(code); }}>
            <label htmlFor="code" className="sr-only">Reward code</label>
            <Input id="code" placeholder="ABCD2345" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="uppercase tracking-widest" />
            <Button type="submit">Check</Button>
          </form>
          <Button variant="ghost" onClick={() => setScan('any')}>Scan reward QR</Button>
          {redeemMsg && <Alert tone={redeemMsg.ok ? 'good' : 'bad'}>{redeemMsg.text}</Alert>}
        </Card>
      </section>

      {scan && <QrScanner title="Scan customer card or reward" onResult={onScan} onClose={() => setScan(null)} />}
    </div>
  );
}
