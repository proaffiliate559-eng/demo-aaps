import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, razorpayConfig, RazorpayError } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

const err = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "unauthorized", "Please sign in again.");

  const cfg = razorpayConfig();
  if (!cfg.enabled) return err(503, "payments_disabled", "Payments aren't available yet.");

  const parsed = z.object({ planSlug: z.string().max(40) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err(400, "bad_request", "Invalid plan.");

  // Price always comes from the database, never from the client.
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("plans")
    .select("id, slug, name, price, is_active")
    .eq("slug", parsed.data.planSlug)
    .maybeSingle();
  if (!plan || !plan.is_active || plan.price <= 0) return err(400, "bad_plan", "That plan isn't available.");

  // Basic abuse limit: 10 checkout attempts per hour.
  const { count } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return err(429, "rate_limited", "Too many checkout attempts. Please try again later.");

  const amountPaise = plan.price * 100;
  try {
    const { orderId } = await createRazorpayOrder({
      amountPaise,
      receipt: `sm_${randomUUID().slice(0, 30)}`,
      notes: { user_id: user.id, plan: plan.slug },
    });
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      plan_id: plan.id,
      razorpay_order_id: orderId,
      amount_paise: amountPaise,
    });
    if (error) return err(500, "store_failed", "Couldn't start checkout. Please try again.");
    return NextResponse.json({
      orderId,
      keyId: cfg.keyId, // publishable key id — safe to expose
      amount: amountPaise,
      currency: "INR",
      planName: plan.name,
      email: user.email,
    });
  } catch (e) {
    console.error("[payments] create-order", e instanceof RazorpayError ? e.message : e);
    return err(502, "provider_error", "Couldn't reach the payment provider. Please try again.");
  }
}
