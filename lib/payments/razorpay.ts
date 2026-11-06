import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Razorpay integration over REST (no SDK). All secrets stay server-side.
 * Docs: https://razorpay.com/docs/api/orders/ and /docs/webhooks/validate-test/
 */
export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  return { keyId, keySecret, webhookSecret, enabled: Boolean(keyId && keySecret) };
}

export const isRazorpayConfigured = () => razorpayConfig().enabled;

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret = razorpayConfig().keySecret) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret). Must use the RAW body. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = razorpayConfig().webhookSecret) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export class RazorpayError extends Error {}

export async function createRazorpayOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  const { keyId, keySecret, enabled } = razorpayConfig();
  if (!enabled) throw new RazorpayError("Razorpay is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt, notes: input.notes }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
    if (!res.ok || !body?.id) throw new RazorpayError(body?.error?.description ?? `Razorpay error ${res.status}`);
    return { orderId: body.id };
  } catch (e) {
    if (e instanceof RazorpayError) throw e;
    throw new RazorpayError(controller.signal.aborted ? "Razorpay timed out" : "Couldn't reach Razorpay");
  } finally {
    clearTimeout(timer);
  }
}
