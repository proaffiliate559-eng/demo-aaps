import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** User closed checkout or the payment failed in the widget. Only affects unpaid orders. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  const parsed = z
    .object({ orderId: z.string().min(1).max(64), reason: z.enum(["dismissed", "failed"]), detail: z.string().max(300).optional() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request" } }, { status: 400 });

  await createAdminClient()
    .from("payments")
    .update({
      status: parsed.data.reason === "failed" ? "failed" : "cancelled",
      failure_reason: parsed.data.detail ?? parsed.data.reason,
    })
    .eq("razorpay_order_id", parsed.data.orderId)
    .eq("user_id", user.id)
    .eq("status", "created"); // never downgrade a paid order
  return NextResponse.json({ ok: true });
}
