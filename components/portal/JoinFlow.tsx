'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizePhone } from '@/lib/phone';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

type Step = 'phone' | 'otp' | 'details';

export default function JoinFlow(props: {
  slug: string; cafeName: string; signedInPhone: string | null; signedInWithoutPhone: boolean;
  branchId: string | null; qrId: string | null; referralCode: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(props.signedInPhone ? 'details' : 'phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [ref, setRef] = useState(props.referralCode);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const p = normalizePhone(phone);
    if (!p) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (error) return setError(error.message.includes('rate') ? 'Too many tries. Please wait a minute.' : 'Could not send the code. Please try again.');
    setStep('otp');
    setCooldown(30);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = normalizePhone(phone)!;
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: p, token: otp, type: 'sms' });
    if (error) { setBusy(false); return setError('That code is wrong or expired.'); }
    // Already a member here? Go straight to the card.
    const { data } = await supabase.rpc('get_my_card', { p_tenant_slug: props.slug });
    setBusy(false);
    if (data) { router.replace(`/c/${props.slug}/card`); router.refresh(); return; }
    setStep('details');
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Please enter your name');
    setBusy(true);
    const { error } = await supabase.rpc('register_customer', {
      p_tenant_slug: props.slug,
      p_name: name.trim(),
      p_email: email.trim() || null,
      p_birthday: birthday || null,
      p_referral_code: ref.trim() || null,
      p_whatsapp_consent: consent,
      p_branch_id: props.branchId,
      p_qr_id: props.qrId,
    });
    setBusy(false);
    if (error) return setError(error.message || 'Could not join. Please try again.');
    router.replace(`/c/${props.slug}/card?welcome=1`);
    router.refresh();
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    router.refresh();
    setStep('phone');
  }

  if (props.signedInWithoutPhone && step !== 'otp') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm">You are signed in with an email (staff) account. Customers join with their mobile number.</p>
        <Button onClick={switchAccount}>Sign out and join with mobile</Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {step === 'phone' && (
        <form onSubmit={sendOtp} className="flex flex-col gap-4" noValidate>
          <div>
            <h2 className="font-display text-2xl font-bold">Join in 20 seconds</h2>
            <p className="text-sm text-muted">We&apos;ll send a code to your phone. Already a member? Same number logs you in.</p>
          </div>
          <Field label="Mobile number" htmlFor="phone">
            <div className="flex gap-2">
              <span className="flex h-12 items-center rounded-xl border border-line bg-white px-3 font-semibold">+91</span>
              <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210"
                value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Get code'}</Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <div>
            <h2 className="font-display text-2xl font-bold">Enter the code</h2>
            <p className="text-sm text-muted">Sent to +91 {phone}. <button type="button" className="font-semibold text-brand underline" onClick={() => setStep('phone')}>Change</button></p>
          </div>
          <Field label="6-digit code" htmlFor="otp">
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center text-2xl tracking-[0.5em]"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify'}</Button>
          <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendOtp()} className="text-sm font-semibold text-brand disabled:text-muted">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={register} className="flex flex-col gap-4" noValidate>
          <div>
            <h2 className="font-display text-2xl font-bold">Almost done</h2>
            <p className="text-sm text-muted">Joining {props.cafeName}{props.signedInPhone ? ` as ${props.signedInPhone}` : ''}.</p>
          </div>
          <Field label="Your name" htmlFor="name"><Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Birthday (for your birthday reward)" htmlFor="bday" hint="Can't be changed later">
            <Input id="bday" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthday(e.target.value)} />
          </Field>
          <Field label="Email (optional)" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Referral code (optional)" htmlFor="ref"><Input id="ref" value={ref} className="uppercase" onChange={(e) => setRef(e.target.value.toUpperCase())} /></Field>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" />
            <span>Send me offers and reward updates from {props.cafeName} on WhatsApp. I can stop anytime by replying STOP or in my profile.</span>
          </label>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join & get my card'}</Button>
          <p className="text-xs text-muted">By joining you agree to {props.cafeName}&apos;s use of your number for the loyalty program.</p>
        </form>
      )}
    </Card>
  );
}
