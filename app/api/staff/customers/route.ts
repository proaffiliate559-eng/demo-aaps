import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fail, fromDbError, json, limit, parseBody, sameOrigin } from '@/lib/api';

const schema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  phone: z.string().trim().min(10).max(20),
  name: z.string().trim().max(120).optional(),
  whatsappConsent: z.boolean().default(false),
  referralCode: z.string().trim().max(12).optional(),
});

// Walk-in registration at the counter (customer has no smartphone handy).
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('forbidden', 'Bad origin', 403);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in', 'Please sign in', 401);
  const limited = limit(`register:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await parseBody(request, schema);
  if ('response' in body) return body.response;
  const b = body.data;
  const { data, error } = await supabase.rpc('staff_register_customer', {
    p_tenant_id: b.tenantId,
    p_branch_id: b.branchId,
    p_phone: b.phone,
    p_name: b.name || null,
    p_whatsapp_consent: b.whatsappConsent,
    p_referral_code: b.referralCode || null,
  });
  if (error) return fromDbError(error);
  return json(data);
}
