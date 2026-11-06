'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Input } from '@/components/ui';

export default function StaffAuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    const supabase = createClient();
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
      router.replace(next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) {
        router.replace('/onboarding');
        router.refresh();
      } else {
        setInfo('Check your email and click the link to confirm your account.');
      }
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {mode === 'signup' && (
        <Field label="Your name" htmlFor="name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
        <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="good">{info}</Alert>}
      <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Button>
    </form>
  );
}
