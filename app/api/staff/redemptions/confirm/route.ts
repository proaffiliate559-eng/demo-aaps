import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fail, fromDbError, json, limit, parseBody, sameOrigin } from '@/lib/api';

const schema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  code: z.string().trim().min(8).max(20),
});

const REASON: Record<string, string> = {
  not_found: 'Code not found for this business.',
  already_used: 'This code was already used.',
  expired: 'This code expired. The customer got their points back and can request a new one.',
  cancelled: 'The customer cancelled this code.',
  wrong_branch: 'This reward is only valid at another branch.',
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('forbidden', 'Bad origin', 403);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in', 'Please sign in', 401);
  const limited = limit(`confirm:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await parseBody(request, schema);
  if ('response' in body) return body.response;

  const { data, error } = await supabase.rpc('confirm_redemption', {
    p_tenant_id: body.data.tenantId,
    p_branch_id: body.data.branchId,
    p_code: body.data.code.replace(/^CR:R:/, ''),
  });
  if (error) return fromDbError(error);
  const r = data as { ok: boolean; reason?: string };
  return json({ ...r, message: r.ok ? 'Valid. Serve the reward.' : REASON[r.reason ?? ''] ?? 'Cannot use this code.' });
}
