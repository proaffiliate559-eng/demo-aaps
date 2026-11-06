'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStaffContext } from '@/lib/staff';
import { toAppError } from '@/lib/errors';

export interface FormState { error?: string; ok?: string }

const schema = z.object({
  label: z.string().trim().min(2, 'Add a label like "Table 4"').max(80),
  kind: z.enum(['registration', 'table', 'branch', 'loyalty_card', 'campaign']),
  branch_id: z.string().uuid().optional().or(z.literal('')),
  count: z.preprocess((v) => Number(v || 1), z.number().int().min(1).max(50)),
});

export async function createQr(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await getStaffContext(slug);
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { label, kind, branch_id, count } = parsed.data;
  const supabase = createClient();
  for (let i = 1; i <= count; i++) {
    const { error } = await supabase.rpc('create_qr_code', {
      p_tenant_id: ctx.tenant.id,
      p_branch_id: branch_id || null,
      p_kind: kind,
      p_label: count > 1 ? `${label} ${i}` : label,
    });
    if (error) return { error: toAppError(error).message };
  }
  revalidatePath(`/dashboard/${slug}/qr`);
  return { ok: count > 1 ? `${count} QR codes created` : 'QR code created' };
}

export async function toggleQr(slug: string, id: string, active: boolean) {
  const ctx = await getStaffContext(slug);
  const supabase = createClient();
  await supabase.from('qr_codes').update({ is_active: active }).eq('id', id).eq('tenant_id', ctx.tenant.id);
  revalidatePath(`/dashboard/${slug}/qr`);
}
