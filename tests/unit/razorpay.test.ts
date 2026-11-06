import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyPaymentSignature, verifyWebhookSignature } = await import("@/lib/payments/razorpay");

describe("Razorpay signatures", () => {
  const sign = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");

  it("accepts a valid checkout signature and rejects tampering", () => {
    const sig = sign("order_1|pay_1", "secret");
    expect(verifyPaymentSignature("order_1", "pay_1", sig, "secret")).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_2", sig, "secret")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", sig, "other")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", "short", "secret")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", sig, "")).toBe(false);
  });

  it("verifies webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = sign(body, "wh");
    expect(verifyWebhookSignature(body, sig, "wh")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "wh")).toBe(false);
    expect(verifyWebhookSignature(body, "", "wh")).toBe(false);
  });
});
