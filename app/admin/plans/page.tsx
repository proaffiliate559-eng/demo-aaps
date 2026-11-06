import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { PlanEditor } from "@/components/admin/plan-editor";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags } from "@/lib/settings/features";
import { getImageProvider } from "@/lib/ai/providers/image";
import { razorpayConfig } from "@/lib/payments/razorpay";

export const metadata: Metadata = { title: "Plans & settings" };
export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: plans }, { data: limit }, flags] = await Promise.all([
    admin.from("plans").select("*").order("sort_order"),
    admin.from("app_settings").select("value").eq("key", "free_daily_generation_limit").maybeSingle(),
    getFeatureFlags(),
  ]);
  const rz = razorpayConfig();
  return (
    <div className="space-y-10">
      <h1 className="font-display text-4xl sm:text-5xl">Plans & settings</h1>
      <section aria-labelledby="pay-title">
        <h2 id="pay-title" className="font-display text-3xl">Payments</h2>
        <Alert variant={rz.enabled && rz.webhookSecret ? "success" : "info"} className="mt-3">
          {rz.enabled
            ? `Razorpay connected (${rz.keyId.startsWith("rzp_live") ? "LIVE" : "test"} mode).${rz.webhookSecret ? " Webhooks verified." : " Add RAZORPAY_WEBHOOK_SECRET so payments complete even if users close the browser."}`
            : "Razorpay isn't configured. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET to enable upgrades."}
        </Alert>
      </section>
      <section aria-labelledby="settings-title">
        <h2 id="settings-title" className="font-display text-3xl">App settings</h2>
        <div className="mt-3">
          <SettingsForm freeDailyLimit={typeof limit?.value === "number" ? limit.value : 3} features={flags} imageProviderReady={Boolean(getImageProvider())} />
        </div>
      </section>
      <section aria-labelledby="plans-title">
        <h2 id="plans-title" className="font-display text-3xl">Plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">Changes apply immediately to the pricing page and to limits. Existing paid passes keep their plan until they expire.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).map((p) => (
            <PlanEditor key={p.slug} plan={{ ...p, features: Array.isArray(p.features) ? (p.features as string[]) : [] }} />
          ))}
        </div>
      </section>
    </div>
  );
}
