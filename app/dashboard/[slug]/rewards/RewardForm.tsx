'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import type { FormState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add reward'}</Button>;
}

export default function RewardForm({ action, branches }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  branches: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(action, {});
  const [type, setType] = useState('free_item');
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <Field label="Reward name" htmlFor="name"><Input id="name" name="name" placeholder="Free cold coffee" required /></Field>
      <Field label="Type" htmlFor="reward_type">
        <Select id="reward_type" name="reward_type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="free_item">Free item</option>
          <option value="percent_discount">% discount</option>
          <option value="fixed_discount">₹ off</option>
        </Select>
      </Field>
      {type !== 'free_item' && (
        <Field label={type === 'percent_discount' ? 'Discount %' : 'Discount ₹'} htmlFor="discount_value">
          <Input id="discount_value" name="discount_value" inputMode="decimal" required />
        </Field>
      )}
      <Field label="Customer pays with" htmlFor="cost_type">
        <Select id="cost_type" name="cost_type" defaultValue="points">
          <option value="points">Points</option>
          <option value="stamps">Stamps</option>
          <option value="cashback">Cashback ₹</option>
        </Select>
      </Field>
      <Field label="Cost" htmlFor="cost_value" hint="e.g. 300 points or 5 stamps"><Input id="cost_value" name="cost_value" inputMode="decimal" required /></Field>
      <Field label="Minimum bill ₹" htmlFor="min_purchase_amount"><Input id="min_purchase_amount" name="min_purchase_amount" inputMode="decimal" defaultValue="0" /></Field>
      <Field label="Max per customer" htmlFor="max_per_customer" hint="Empty = no limit"><Input id="max_per_customer" name="max_per_customer" inputMode="numeric" /></Field>
      <Field label="Stock" htmlFor="stock" hint="Empty = unlimited"><Input id="stock" name="stock" inputMode="numeric" /></Field>
      <Field label="Valid until" htmlFor="ends_at" hint="Empty = no end date"><Input id="ends_at" name="ends_at" type="date" /></Field>
      {branches.length > 1 && (
        <Field label="Branch" htmlFor="branch_id">
          <Select id="branch_id" name="branch_id" defaultValue="">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Description" htmlFor="description"><Input id="description" name="description" placeholder="Shown to customers" /></Field>
      <div className="flex flex-col justify-end gap-2 md:col-span-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert tone="good">{state.ok}</Alert>}
        <div><Submit /></div>
      </div>
    </form>
  );
}
