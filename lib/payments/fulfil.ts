import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Grant the plan for a paid order. Idempotent (see public.fulfil_payment). */
export async function fulfilOrder(orderId: string, paymentId: string) {
  const { data, error } = await createAdminClient().rpc("fulfil_payment", { p_order_id: orderId, p_payment_id: paymentId });
  if (error) throw new Error(`fulfil failed: ${error.message}`);
  return data as { ok: boolean; already?: boolean; reason?: string };
}

export async function markOrderFailed(orderId: string, reason: string) {
  await createAdminClient()
    .from("payments")
    .update({ status: "failed", failure_reason: reason.slice(0, 300) })
    .eq("razorpay_order_id", orderId)
    .eq("status", "created");
}
