import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createQrToken } from '@/lib/qr-token';
import { serverEnv } from '@/lib/env';
import { fail, json, limit } from '@/lib/api';

// Signed, 2-minute QR token for the signed-in customer's loyalty card.
export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in', 'Please sign in', 401);
  const limited = limit(`qrtoken:${user.id}`, 40, 60_000);
  if (limited) return limited;

  const { data: c } = await supabase
    .from('customers')
    .select('id, tenant_id, status, tenants!inner(slug)')
    .eq('auth_user_id', user.id)
    .eq('tenants.slug', slug)
    .maybeSingle();
  if (!c) return fail('not_registered', 'Join this cafe first', 404);
  if (c.status !== 'active') return fail('customer_blocked', 'Your account is on hold', 403);

  const { token, expiresAt } = createQrToken(c.tenant_id, c.id, serverEnv.qrSecret);
  return json({ token, expiresAt });
}
