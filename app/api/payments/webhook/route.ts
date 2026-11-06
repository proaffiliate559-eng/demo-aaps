import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpayConfig, verifyWebhookSignature } from "@/lib/payments/razorpay";
import { fulfilOrder, markOrderFailed } from "@/lib/payments/fulfil";

export const runtime = "nodejs";

type Entity = { id?: string; order_id?: string; status?: string; error_description?: string };
type WebhookBody = { event?: string; payload?: { payment?: { entity?: Entity }; order?: { entity?: Entity } } };

/**
 * Razorpay webhook (configure: payment.captured, order.paid, payment.failed).
 * Source of truth for payments, even if the user closes the browser mid-checkout.
 */
export async function POST(request: NextRequest) {
  const { webhookSecret } = razorpayConfig();
  if (!webhookSecret) return NextResponse.json({ error: "webhooks not configured" }, { status: 503 });

  const raw = await request.text(); // must verify the exact raw body
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature, webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Idempotency: each event id is processed once.
  const eventId = request.headers.get("x-razorpay-event-id");
  if (eventId) {
    const { error } = await createAdminClient().from("webhook_events").insert({ id: eventId, event: body.event ?? "unknown" });
    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  }

  const payment = body.payload?.payment?.entity;
  const orderId = payment?.order_id ?? body.payload?.order?.entity?.id;
  try {
    if ((body.event === "payment.captured" || body.event === "order.paid") && orderId && payment?.id) {
      const res = await fulfilOrder(orderId, payment.id);
      if (!res.ok) console.warn(`[webhook] fulfil ${orderId}: ${res.reason}`);
    } else if (body.event === "payment.failed" && orderId) {
      await markOrderFailed(orderId, payment?.error_description ?? "payment failed");
    }
  } catch (e) {
    console.error("[webhook] processing error", e);
    // Allow Razorpay to retry: remove the idempotency marker and return 500.
    if (eventId) await createAdminClient().from("webhook_events").delete().eq("id", eventId);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
