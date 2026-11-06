import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { inr } from '@/lib/format';

export const revalidate = 3600;

interface Plan { code: string; name: string; price_monthly_inr: number | null; features: string[] }

const FEATURE_LABEL: Record<string, string> = {
  qr_loyalty: 'QR loyalty card', stamps: 'Digital stamps', basic_crm: 'Customer list', points: 'Points & tiers',
  coupons: 'Coupons', whatsapp: 'WhatsApp messages', campaigns: 'Campaigns', ai: 'AI marketing assistant',
  advanced_analytics: 'Advanced analytics', segments: 'Customer segments', automations: 'Automated campaigns',
  everything: 'Everything in Pro', multi_branch: 'Many branches', advanced_permissions: 'Advanced permissions',
  custom_integrations: 'Custom integrations',
};

export default async function Home() {
  let plans: Plan[] = [];
  try {
    const supabase = createClient();
    const { data } = await supabase.from('subscription_plans').select('code, name, price_monthly_inr, features').order('sort_order');
    plans = (data ?? []) as Plan[];
  } catch {
    plans = [];
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-5 py-10">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl font-extrabold text-brand">CafeRepeat AI</span>
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/login" className="rounded-xl px-4 py-2 hover:bg-white">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-brand px-4 py-2 text-white">Start free trial</Link>
        </nav>
      </header>

      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">Turn first-time guests into regulars.</h1>
          <p className="text-lg text-muted">
            A digital loyalty card your customers open by scanning a QR code. No app download. Stamps, points, cashback,
            birthday rewards and referrals, all tracked in one place.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-xl bg-brand px-6 py-3 font-semibold text-white">Create your cafe</Link>
            <Link href="/c/demo-cafe" className="rounded-xl border border-line bg-white px-6 py-3 font-semibold">See the customer card</Link>
          </div>
          <p className="text-sm text-muted">14-day free trial. No card needed.</p>
        </div>
        <div className="rounded-[28px] bg-brand p-6 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wider opacity-90">Brew Rewards</p>
          <p className="mt-6 font-display text-5xl font-extrabold">1,240</p>
          <p className="opacity-90">points · Gold member</p>
          <div className="mt-6 grid grid-cols-5 gap-2" aria-label="4 of 5 stamps collected">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`aspect-square rounded-full border-2 border-white/60 ${i <= 4 ? 'bg-accent' : ''}`} />
            ))}
          </div>
          <p className="mt-3 text-sm opacity-90">1 more coffee for a free one</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Scan & join in 20 seconds', 'Customers scan the table QR, verify their mobile with an OTP and get a digital card.'],
          ['Every reward is tracked', 'Each point, stamp and rupee of cashback is written to a ledger. No double rewards, no fake entries.'],
          ['Built for your counter', 'Cashiers scan the customer QR, enter the bill and confirm rewards with a one-time code.'],
        ].map(([t, b]) => (
          <div key={t} className="rounded-xl2 border border-line bg-white p-5">
            <h2 className="font-display text-lg font-bold">{t}</h2>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>

      {plans.length > 0 && (
        <section className="flex flex-col gap-5" aria-labelledby="pricing">
          <h2 id="pricing" className="font-display text-3xl font-extrabold">Simple monthly plans</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {plans.map((p) => (
              <div key={p.code} className="flex flex-col gap-3 rounded-xl2 border border-line bg-white p-5">
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                <p className="font-display text-3xl font-extrabold">
                  {p.price_monthly_inr == null ? 'Custom' : inr(p.price_monthly_inr)}
                  {p.price_monthly_inr != null && <span className="text-base font-medium text-muted">/month</span>}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {p.features.map((f) => <li key={f}>✓ {FEATURE_LABEL[f] ?? f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Launch prices. GST extra.</p>
        </section>
      )}
    </main>
  );
}
