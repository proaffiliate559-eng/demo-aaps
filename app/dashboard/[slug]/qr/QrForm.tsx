'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import type { FormState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create QR'}</Button>;
}

export function QrForm({ action, branches }: { action: (p: FormState, f: FormData) => Promise<FormState>; branches: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-4">
      <Field label="Label" htmlFor="label" hint='Printed on the card, e.g. "Table"'><Input id="label" name="label" placeholder="Table" required /></Field>
      <Field label="Type" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="table">
          <option value="table">Table</option>
          <option value="registration">Counter / join</option>
          <option value="branch">Branch entrance</option>
          <option value="campaign">Campaign / flyer</option>
        </Select>
      </Field>
      <Field label="Branch" htmlFor="branch_id">
        <Select id="branch_id" name="branch_id" defaultValue={branches[0]?.id ?? ''}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="How many" htmlFor="count" hint="e.g. 10 makes Table 1…10"><Input id="count" name="count" inputMode="numeric" defaultValue="1" /></Field>
      <div className="flex flex-col gap-2 md:col-span-4">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert tone="good">{state.ok}</Alert>}
        <div><Submit /></div>
      </div>
    </form>
  );
}

export function PrintButton() {
  return <Button variant="ghost" onClick={() => window.print()}>Print all</Button>;
}
