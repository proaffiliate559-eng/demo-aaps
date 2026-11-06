import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { isRazorpayConfigured, razorpayConfig } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uptime/health check. Reports which integrations are configured (never secret
 * values) and whether the database answers. 200 = healthy, 503 = degraded.
 */
export async function GET() {
  let database: "ok" | "error" | "not_configured" = "not_configured";
  if (isSupabaseConfigured()) {
    try {
      const anon = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
      const { error } = await anon.from("plans").select("slug", { head: true, count: "exact" });
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }
  const ai = (process.env.AI_PROVIDER ?? "gemini") === "gemini" ? (process.env.GEMINI_API_KEY ? "gemini" : "not_configured") : process.env.AI_PROVIDER;
  const body = {
    status: database === "ok" && ai !== "not_configured" ? "ok" : "degraded",
    database,
    ai,
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    payments: isRazorpayConfigured() ? (razorpayConfig().webhookSecret ? "razorpay" : "razorpay_without_webhook") : "disabled",
    images: process.env.IMAGE_PROVIDER ?? "none",
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: body.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
