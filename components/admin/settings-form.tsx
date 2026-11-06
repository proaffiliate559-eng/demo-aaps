"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updateAppSettings } from "@/lib/admin/actions";
import type { FeatureFlags } from "@/lib/settings/features";

const LABELS: Record<keyof FeatureFlags, { label: string; hint: string }> = {
  stylist_chat: { label: "AI stylist chat", hint: "Hides the chat and blocks its API when off." },
  wardrobe: { label: "Digital wardrobe", hint: "Hides the wardrobe pages when off. Data is kept." },
  image_generation: { label: "Outfit inspiration images", hint: "Also needs IMAGE_PROVIDER=gemini and billing on your Google AI account." },
};

export function SettingsForm({ freeDailyLimit, features, imageProviderReady }: { freeDailyLimit: number; features: FeatureFlags; imageProviderReady: boolean }) {
  const [limit, setLimit] = useState(String(freeDailyLimit));
  const [flags, setFlags] = useState(features);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateAppSettings({ freeDailyLimit: Number(limit), features: flags });
            setMsg({ ok: r.ok, text: r.message ?? "" });
          });
        }}
      >
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium">Free plan — generations per day</span>
          <Input type="number" min={0} max={100} value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="Free daily generation limit" />
        </label>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Features</legend>
          {(Object.keys(LABELS) as (keyof FeatureFlags)[]).map((k) => (
            <label key={k} className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} className="mt-1 accent-foreground" aria-label={LABELS[k].label} />
              <span>
                {LABELS[k].label}
                <span className="block text-xs text-muted-foreground">
                  {LABELS[k].hint}
                  {k === "image_generation" && !imageProviderReady && " (Provider not configured — stays off for users.)"}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </form>
    </Card>
  );
}
