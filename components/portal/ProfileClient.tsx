'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui';

export default function ProfileClient({ slug, cafeName, appUrl, customer, consents, referrals }: {
  slug: string; cafeName: string; appUrl: string;
  customer: { name: string | null; email: string | null; birthday: string | null; referral_code: string; phone: string };
  consents: Record<string, boolean>;
  referrals: { joined: number; completed: number; referrer_points: number; referee_points: number };
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(customer.name ?? '');
  const [email, setEmail] = useState(customer.email ?? '');
  const [birthday, setBirthday] = useState(customer.birthday ?? '');
  const [wa, setWa] = useState(!!consents.whatsapp);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string; where: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `${appUrl}/c/${slug}?ref=${customer.referral_code}`;
  const shareText = `Join ${cafeName} rewards with my code ${customer.referral_code} and get ${referrals.referee_points} bonus points: ${link}`;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('update_my_profile', { p_tenant_slug: slug, p_name: name, p_email: email || null, p_birthday: birthday || null });
    setMsg(error ? { tone: 'bad', text: error.message, where: 'profile' } : { tone: 'good', text: 'Saved', where: 'profile' });
    if (!error) router.refresh();
  }
  async function toggleWa(next: boolean) {
    setWa(next);
    const { error } = await supabase.rpc('set_my_consent', { p_tenant_slug: slug, p_channel: 'whatsapp', p_granted: next });
    if (error) { setWa(!next); setMsg({ tone: 'bad', text: error.message, where: 'consent' }); }
    else setMsg({ tone: 'good', text: next ? 'You will get offers on WhatsApp' : 'WhatsApp offers turned off', where: 'consent' });
  }
  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setMsg({ tone: 'bad', text: 'Pick a rating', where: 'feedback' });
    const { error } = await supabase.rpc('submit_feedback', { p_tenant_slug: slug, p_rating: rating, p_comment: comment || null });
    if (error) return setMsg({ tone: 'bad', text: error.message, where: 'feedback' });
    setRating(0); setComment('');
    setMsg({ tone: 'good', text: 'Thank you for the feedback!', where: 'feedback' });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  async function signOut() {
    await supabase.auth.signOut();
    router.replace(`/c/${slug}`);
    router.refresh();
  }
  const note = (where: string) => msg?.where === where && <Alert tone={msg.tone}>{msg.text}</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3 bg-brand p-5 text-white">
        <h2 className="font-display text-xl font-bold">Give {referrals.referee_points}, get {referrals.referrer_points}</h2>
        <p className="text-sm opacity-90">Your friend gets {referrals.referee_points} points on joining. You get {referrals.referrer_points} after their first bill.</p>
        <div className="flex gap-2">
          <span className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-accent font-display text-lg font-extrabold tracking-widest">{customer.referral_code}</span>
          <button onClick={copy} className="rounded-xl bg-accent px-4 font-semibold text-ink">{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-xl border border-white/50 font-semibold">Share on WhatsApp</a>
        <span className="text-sm opacity-90">{referrals.joined} joined · {referrals.completed} visited</span>
      </Card>

      <Card className="p-5">
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">Your details</h2>
          <p className="text-sm text-muted">Mobile: {customer.phone}</p>
          <Field label="Name" htmlFor="pn"><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="pe"><Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Birthday" htmlFor="pb" hint={customer.birthday ? 'Ask the cafe if this needs changing' : 'Add it to get a birthday reward'}>
            <Input id="pb" type="date" value={birthday} disabled={!!customer.birthday} onChange={(e) => setBirthday(e.target.value)} />
          </Field>
          {note('profile')}
          <Button type="submit">Save</Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold">Privacy &amp; messages</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Offers and reward updates on WhatsApp</span>
          <input type="checkbox" role="switch" aria-checked={wa} checked={wa} onChange={(e) => toggleWa(e.target.checked)} className="h-6 w-6" />
        </label>
        {note('consent')}
        <p className="text-xs text-muted">We only use your number for this cafe&apos;s loyalty program. You can turn messages off anytime.</p>
      </Card>

      <Card className="p-5">
        <form onSubmit={sendFeedback} className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">How was your last visit?</h2>
          <div role="radiogroup" aria-label="Rating" className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(n)} className={`h-12 w-12 rounded-xl border text-xl ${rating >= n ? 'border-accent bg-sand' : 'border-line bg-white'}`}>★</button>
            ))}
          </div>
          <label htmlFor="fc" className="sr-only">Comment</label>
          <Textarea id="fc" maxLength={1000} placeholder="Anything we should know? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          {note('feedback')}
          <Button type="submit" variant="ghost">Send feedback</Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={signOut}>Sign out</Button>
    </div>
  );
}
