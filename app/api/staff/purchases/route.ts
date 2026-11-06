import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fail, fromDbError, json, limit, parseBody, sameOrigin } from '@/lib/api';

const item = z.object({
  name: z.string().trim().min(1).max(80),
  qty: z.number().int().min(1).max(100),
  price: z.number().min(0).max(100000).optional(),
  category: z.string().trim().max(40).optional(),
});
const schema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().min(0).max(1_000_000),
  idempotencyKey: z.string().min(8).max(80),
  billRef: z.string().trim().max(40).optional(),
  items: z.array(item).max(50).default([]),
  cashbackToUse: z.number().min(0).max(1_000_000).default(0),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail('forbidden', 'Bad origin', 403);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in', 'Please sign in', 401);
  const limited = limit(`purchase:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await parseBody(request, schema);
  if ('response' in body) return body.response;
  const b = body.data;

  // Permission, branch access, duplicates and the ledger are all enforced in SQL.
  const { data, error } = await supabase.rpc('record_purchase', {
    p_tenant_id: b.tenantId,
    p_branch_id: b.branchId,
    p_customer_id: b.customerId,
    p_amount: b.amount,
    p_idempotency_key: b.idempotencyKey,
    p_items: b.items,
    p_bill_ref: b.billRef || null,
    p_cashback_to_use: b.cashbackToUse,
  });
  if (error) return fromDbError(error);
  return json(data);
}
