import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { verifyQrToken } from '@/lib/qr-token';
import { normalizePhone } from '@/lib/phone';
import { serverEnv } from '@/lib/env';
import { fail, fromDbError, json, limit, parseBody, sameOrigin } from '@/lib/api';

const schema = z.object({
  tenantId: z.string().uuid(),
  token: z.string().max(400).optional(),
  phone: z.string().max(20).optional(),
}).refine((v) => v.token || v.phone, 'Scan a QR or enter a phone number');

// Cashier scans a customer card QR (or types a phone) → customer + wallet.
// RLS makes sure staff only ever find customers of their own business.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('forbidden', 'Bad origin', 403);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in', 'Please sign in', 401);
  const limited = limit(`resolve:${user.id}`, 60, 60_000);
  if (limited) return limited;

  const body = await parseBody(request, schema);
  if ('response' in body) return body.response;
  const { tenantId, token, phone } = body.data;

  let q = supabase
    .from('customers')
    .select('id, name, phone, status, total_visits, total_spent, last_visit_at, birthday, loyalty_wallets(points_balance, stamps_balance, cashback_balance, tier)')
    .eq('tenant_id', tenantId);

  if (token) {
    const v = verifyQrToken(token, serverEnv.qrSecret, tenantId);
    if (!v.ok) {
      const msg = { expired: 'This QR has expired. Ask the customer to refresh their card.', wrong_tenant: 'This card belongs to a different business.',
        bad_signature: 'This QR is not valid.', malformed: 'This is not a customer card QR.' }[v.reason];
      return fail(`qr_${v.reason}`, msg, 422);
    }
    q = q.eq('id', v.customerId);
  } else {
    const p = normalizePhone(phone!);
    if (!p) return fail('bad_phone', 'Enter a valid mobile number', 422);
    q = q.eq('phone', p);
  }

  const { data, error } = await q.maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return json({ customer: null });
  return json({ customer: data });
}
