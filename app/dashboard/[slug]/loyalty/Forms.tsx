'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui';
import type { FormState } from './actions';

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

export interface RuleValues {
  points_per_100: number; max_points_per_txn: number | null; stamps_per_visit: number; stamp_item_keyword: string | null;
  cashback_percent: number; max_cashback_per_txn: number | null; min_purchase_amount: number;
}
export interface ProgramValues extends RuleValues {
  name: string; points_enabled: boolean; stamps_enabled: boolean; cashback_enabled: boolean;
  signup_bonus_points: number; referral_referrer_points: number; referral_referee_points: number; birthday_points: number;
  points_expiry_days: number | null; redemption_valid_minutes: number; max_redemptions_per_day: number; duplicate_window_seconds: number;
  tiers: { key: string; min_points: number; multiplier: number }[];
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button>;
}

const v = (x: number | null | undefined) => (x == null ? '' : String(x));

function RuleFields({ r, prefix }: { r: Partial<RuleValues>; prefix: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Points per ₹100" htmlFor={`${prefix}p100`}><Input id={`${prefix}p100`} name="points_per_100" inputMode="decimal" defaultValue={v(r.points_per_100 ?? 10)} /></Field>
      <Field label="Max points per bill" htmlFor={`${prefix}maxp`} hint="Empty = no cap"><Input id={`${prefix}maxp`} name="max_points_per_txn" inputMode="numeric" defaultValue={v(r.max_points_per_txn)} /></Field>
      <Field label="Minimum bill for rewards ₹" htmlFor={`${prefix}min`}><Input id={`${prefix}min`} name="min_purchase_amount" inputMode="decimal" defaultValue={v(r.min_purchase_amount ?? 0)} /></Field>
      <Field label="Stamps per visit" htmlFor={`${prefix}spv`}><Input id={`${prefix}spv`} name="stamps_per_visit" inputMode="numeric" defaultValue={v(r.stamps_per_visit ?? 1)} /></Field>
      <Field label="…or 1 stamp per item matching" htmlFor={`${prefix}kw`} hint='e.g. "coffee". Empty = per visit'>
        <Input id={`${prefix}kw`} name="stamp_item_keyword" defaultValue={r.stamp_item_keyword ?? ''} />
      </Field>
      <Field label="Cashback %" htmlFor={`${prefix}cb`}><Input id={`${prefix}cb`} name="cashback_percent" inputMode="decimal" defaultValue={v(r.cashback_percent ?? 0)} /></Field>
      <Field label="Max cashback per bill ₹" htmlFor={`${prefix}cbmax`} hint="Empty = no cap"><Input id={`${prefix}cbmax`} name="max_cashback_per_txn" inputMode="decimal" defaultValue={v(r.max_cashback_per_txn)} /></Field>
    </div>
  );
}

export function ProgramForm({ action, p }: { action: Action; p: ProgramValues }) {
  const [state, formAction] = useFormState(action, {});
  const gold = p.tiers.find((t) => t.key === 'gold');
  const plat = p.tiers.find((t) => t.key === 'platinum');
  const check = (name: keyof ProgramValues, label: string) => (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name={name} defaultChecked={!!p[name]} className="h-4 w-4" /> {label}
    </label>
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Program</h2>
        <Field label="Program name" htmlFor="name"><Input id="name" name="name" defaultValue={p.name} /></Field>
        <div className="flex flex-wrap gap-5">{check('points_enabled', 'Points')}{check('stamps_enabled', 'Stamps')}{check('cashback_enabled', 'Cashback')}</div>
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Earning rules (all branches)</h2>
        <RuleFields r={p} prefix="d" />
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Bonuses</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Welcome points" htmlFor="sb"><Input id="sb" name="signup_bonus_points" inputMode="numeric" defaultValue={p.signup_bonus_points} /></Field>
          <Field label="Referrer gets" htmlFor="rr" hint="After friend's first bill"><Input id="rr" name="referral_referrer_points" inputMode="numeric" defaultValue={p.referral_referrer_points} /></Field>
          <Field label="Friend gets" htmlFor="re" hint="On joining"><Input id="re" name="referral_referee_points" inputMode="numeric" defaultValue={p.referral_referee_points} /></Field>
          <Field label="Birthday points" htmlFor="bd"><Input id="bd" name="birthday_points" inputMode="numeric" defaultValue={p.birthday_points} /></Field>
        </div>
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Tiers</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Gold from (lifetime pts)" htmlFor="gm"><Input id="gm" name="gold_min" inputMode="numeric" defaultValue={gold?.min_points ?? 500} /></Field>
          <Field label="Gold multiplier" htmlFor="gx"><Input id="gx" name="gold_mult" inputMode="decimal" defaultValue={gold?.multiplier ?? 1.25} /></Field>
          <Field label="Platinum from" htmlFor="pm"><Input id="pm" name="platinum_min" inputMode="numeric" defaultValue={plat?.min_points ?? 1500} /></Field>
          <Field label="Platinum multiplier" htmlFor="px"><Input id="px" name="platinum_mult" inputMode="decimal" defaultValue={plat?.multiplier ?? 1.5} /></Field>
        </div>
      </Card>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">Limits &amp; safety</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Points expire after (days without a visit)" htmlFor="exp" hint="Empty = never"><Input id="exp" name="points_expiry_days" inputMode="numeric" defaultValue={v(p.points_expiry_days)} /></Field>
          <Field label="Reward code valid (minutes)" htmlFor="rv"><Input id="rv" name="redemption_valid_minutes" inputMode="numeric" defaultValue={p.redemption_valid_minutes} /></Field>
          <Field label="Max rewards per customer per day" htmlFor="md"><Input id="md" name="max_redemptions_per_day" inputMode="numeric" defaultValue={p.max_redemptions_per_day} /></Field>
          <Field label="Block same bill repeat (seconds)" htmlFor="dw"><Input id="dw" name="duplicate_window_seconds" inputMode="numeric" defaultValue={p.duplicate_window_seconds} /></Field>
        </div>
      </Card>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="good">{state.ok}</Alert>}
      <div><Submit label="Save program" /></div>
    </form>
  );
}

export function BranchRuleForm({ action, branches }: { action: Action; branches: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Branch" htmlFor="branch_id">
        <Select id="branch_id" name="branch_id" defaultValue="">
          <option value="" disabled>Choose a branch</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <RuleFields r={{}} prefix="b" />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="good">{state.ok}</Alert>}
      <div><Submit label="Save branch rule" /></div>
    </form>
  );
}
