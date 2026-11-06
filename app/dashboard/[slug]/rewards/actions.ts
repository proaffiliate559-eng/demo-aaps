'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStaffContext } from '@/lib/staff';
import { toAppError } from '@/lib/errors';

export interface FormState { error?: string; ok?: string }

const optNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().optional());
const schema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  description: z.string().trim().max(300).optional(),
  reward_type: z.enum(['free_item', 'percent_discount', 'fixed_discount']),
  cost_type: z.enum(['points', 'stamps', 'cashback']),
  cost_value: z.preprocess(Number, z.number().positive('Cost must be more than 0').max(1_000_000)),
  discount_value: optNum,
  min_purchase_amount: z.preprocess((v) => Number(v || 0), z.number().min(0)),
  max_per_customer: optNum,
  stock: optNum,
  branch_id: z.string().uuid().optional().or(z.literal('')),
  ends_at: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.reward_type !== 'free_item' && !(v.discount_value && v.discount_value > 0)) ctx.addIssue({ code: 'custom', message: 'Enter the discount value' });
  if (v.reward_type === 'percent_discount' && (v.discount_value ?? 0) > 100) ctx.addIssue({ code: 'custom', message: 'Percent cannot be over 100' });
  if (v.cost_type === 'stamps' && !Number.isInteger(v.cost_value)) ctx.addIssue({ code: 'custom', message: 'Stamps must be a whole number' });
});

export async function createReward(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await getStaffContext(slug);
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from('rewards').insert({
    tenant_id: ctx.tenant.id,
    name: v.name,
    description: v.description || null,
    reward_type: v.reward_type,
    cost_type: v.cost_type,
    cost_value: v.cost_value,
    discount_value: v.reward_type === 'free_item' ? null : v.discount_value,
    min_purchase_amount: v.min_purchase_amount,
    max_per_customer: v.max_per_customer ?? null,
    stock: v.stock ?? null,
    branch_id: v.branch_id || null,
    ends_at: v.ends_at ? new Date(v.ends_at + 'T23:59:59+05:30').toISOString() : null,
  });
  if (error) return { error: toAppError(error).message };
  revalidatePath(`/dashboard/${slug}/rewards`);
  return { ok: `Added “${v.name}”` };
}

export async function toggleReward(slug: string, id: string, active: boolean) {
  const ctx = await getStaffContext(slug);
  const supabase = createClient();
  await supabase.from('rewards').update({ is_active: active }).eq('id', id).eq('tenant_id', ctx.tenant.id);
  revalidatePath(`/dashboard/${slug}/rewards`);
}
