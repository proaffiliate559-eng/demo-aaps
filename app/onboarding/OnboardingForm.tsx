'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createBusiness, type OnboardingState } from './actions';
import { Alert, Button, Field, Input } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create my cafe'}</Button>;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

export default function OnboardingForm({ ownerName }: { ownerName: string }) {
  const [state, action] = useFormState<OnboardingState, FormData>(createBusiness, {});
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="ownerName" value={ownerName} />
      <Field label="Cafe or restaurant name" htmlFor="name">
        <Input id="name" name="name" value={name} required
          onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Your customer link" htmlFor="slug" hint={`Customers open: /c/${slug || 'your-cafe'}`}>
        <Input id="slug" name="slug" value={slug} required onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First branch" htmlFor="branch"><Input id="branch" name="branch" placeholder="Indiranagar" required /></Field>
        <Field label="City" htmlFor="city"><Input id="city" name="city" placeholder="Bengaluru" /></Field>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <Submit />
      <p className="text-xs text-muted">
        We set up a starter program for you: 10 points per ₹100, 1 stamp per visit, a free coffee after 5 stamps,
        50 welcome points and birthday points. You can change all of it later.
      </p>
    </form>
  );
}
