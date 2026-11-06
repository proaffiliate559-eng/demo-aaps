import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { fulfilOrder } from "@/lib/payments/fulfil";

export const runtime = "nodejs";

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

/**
 * Called by the browser after checkout. We never trust the client's "success":
 * the signature is verified server-side before the plan is granted.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Please sign in again." } }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: "Invalid payment details." } }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    console.warn(`[payments] bad signature user=${user.id} order=${orderId}`);
    return NextResponse.json({ error: { code: "bad_signature", message: "We couldn't verify this payment." } }, { status: 400 });
  }

  const { data: payment } = await createAdminClient()
    .from("payments")
    .select("user_id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (!payment || payment.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Payment not found." } }, { status: 404 });
  }

  const result = await fulfilOrder(orderId, paymentId);
  if (!result.ok) return NextResponse.json({ error: { code: result.reason, message: "We couldn't activate your plan. Contact support." } }, { status: 409 });
  return NextResponse.json({ ok: true });
}
