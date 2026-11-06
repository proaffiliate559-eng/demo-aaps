'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStaffContext } from '@/lib/staff';
import { toAppError } from '@/lib/errors';

export interface FormState { error?: string; ok?: string }

const n = (min = 0, max = 1_000_000) => z.preprocess((v) => Number(v || 0), z.number().min(min).max(max));
const optN = z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().positive().nullable());
const bool = z.preprocess((v) => v === 'on' || v === 'true', z.boolean());

const ruleSchema = z.object({
  points_per_100: n(0, 1000),
  max_points_per_txn: optN,
  stamps_per_visit: n(0, 20),
  stamp_item_keyword: z.string().trim().max(40).optional(),
  cashback_percent: n(0, 50),
  max_cashback_per_txn: optN,
  min_purchase_amount: n(0, 100000),
});

const programSchema = ruleSchema.extend({
  name: z.string().trim().min(2).max(80),
  points_enabled: bool, stamps_enabled: bool, cashback_enabled: bool,
  signup_bonus_points: n(0, 10000), referral_referrer_points: n(0, 10000), referral_referee_points: n(0, 10000),
  birthday_points: n(0, 10000),
  points_expiry_days: optN,
  redemption_valid_minutes: n(5, 10080),
  max_redemptions_per_day: n(1, 50),
  duplicate_window_seconds: n(0, 3600),
  gold_min: n(1, 1_000_000), gold_mult: n(1, 5), platinum_min: n(1, 1_000_000), platinum_mult: n(1, 5),
}).refine((v) => v.platinum_min > v.gold_min, 'Platinum needs more points than Gold');

function ruleFields(v: z.infer<typeof ruleSchema>) {
  return {
    points_per_100: v.points_per_100,
    max_points_per_txn: v.max_points_per_txn,
    stamps_per_visit: v.stamps_per_visit,
    stamp_item_keyword: v.stamp_item_keyword || null,
    cashback_percent: v.cashback_percent,
    max_cashback_per_txn: v.max_cashback_per_txn,
    min_purchase_amount: v.min_purchase_amount,
  };
}

export async function saveProgram(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await getStaffContext(slug);
  const parsed = programSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = createClient();

  const { data: prog, error: e1 } = await supabase.from('loyalty_programs').update({
    name: v.name, points_enabled: v.points_enabled, stamps_enabled: v.stamps_enabled, cashback_enabled: v.cashback_enabled,
    signup_bonus_points: v.signup_bonus_points, referral_referrer_points: v.referral_referrer_points,
    referral_referee_points: v.referral_referee_points, birthday_points: v.birthday_points,
    points_expiry_days: v.points_expiry_days, redemption_valid_minutes: v.redemption_valid_minutes,
    max_redemptions_per_day: v.max_redemptions_per_day, duplicate_window_seconds: v.duplicate_window_seconds,
    tiers: [
      { key: 'silver', name: 'Silver', min_points: 0, multiplier: 1 },
      { key: 'gold', name: 'Gold', min_points: v.gold_min, multiplier: v.gold_mult },
      { key: 'platinum', name: 'Platinum', min_points: v.platinum_min, multiplier: v.platinum_mult },
    ],
  }).eq('tenant_id', ctx.tenant.id).eq('is_active', true).select('id').maybeSingle();
  if (e1 || !prog) return { error: e1 ? toAppError(e1).message : 'No active program' };

  const { error: e2 } = await supabase.from('loyalty_rules').update(ruleFields(v))
    .eq('program_id', prog.id).is('branch_id', null).eq('is_active', true);
  if (e2) return { error: toAppError(e2).message };
  revalidatePath(`/dashboard/${slug}/loyalty`);
  return { ok: 'Saved. New rules apply from the next bill.' };
}

export async function saveBranchRule(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await getStaffContext(slug);
  const branchId = String(form.get('branch_id') || '');
  if (!ctx.branches.some((b) => b.id === branchId)) return { error: 'Choose a branch' };
  const parsed = ruleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = createClient();
  const { data: prog } = await supabase.from('loyalty_programs').select('id').eq('tenant_id', ctx.tenant.id).eq('is_active', true).maybeSingle();
  if (!prog) return { error: 'No active program' };

  const { data: existing } = await supabase.from('loyalty_rules').select('id')
    .eq('program_id', prog.id).eq('branch_id', branchId).eq('is_active', true).maybeSingle();
  const { error } = existing
    ? await supabase.from('loyalty_rules').update(ruleFields(parsed.data)).eq('id', existing.id)
    : await supabase.from('loyalty_rules').insert({ tenant_id: ctx.tenant.id, program_id: prog.id, branch_id: branchId, ...ruleFields(parsed.data) });
  if (error) return { error: toAppError(error).message };
  revalidatePath(`/dashboard/${slug}/loyalty`);
  return { ok: 'Branch rule saved' };
}

export async function removeBranchRule(slug: string, ruleId: string) {
  const ctx = await getStaffContext(slug);
  const supabase = createClient();
  await supabase.from('loyalty_rules').update({ is_active: false }).eq('id', ruleId).eq('tenant_id', ctx.tenant.id).not('branch_id', 'is', null);
  revalidatePath(`/dashboard/${slug}/loyalty`);
}
