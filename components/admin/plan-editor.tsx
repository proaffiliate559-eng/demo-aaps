"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { updatePlan } from "@/lib/admin/actions";

type Plan = { slug: string; name: string; price: number; generation_limit: number; saved_limit: number | null; is_active: boolean; features: string[]; period: string };

export function PlanEditor({ plan }: { plan: Plan }) {
  const [v, setV] = useState({
    name: plan.name,
    price: String(plan.price),
    generationLimit: String(plan.generation_limit),
    savedLimit: plan.saved_limit == null ? "" : String(plan.saved_limit),
    isActive: plan.is_active,
    features: plan.features.join("\n"),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const free = plan.slug === "free";
  const field = (k: keyof typeof v) => ({
    value: v[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });

  return (
    <Card className="p-5" data-testid={`plan-editor-${plan.slug}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updatePlan(plan.slug, {
              name: v.name,
              price: Number(v.price),
              generationLimit: Number(v.generationLimit),
              savedLimit: v.savedLimit === "" ? null : Number(v.savedLimit),
              isActive: v.isActive,
              features: v.features.split("\n").map((f) => f.trim()).filter(Boolean),
            });
            setMsg({ ok: r.ok, text: r.message ?? "" });
          });
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold uppercase tracking-[0.14em] text-sm">{plan.slug}</h3>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={v.isActive} disabled={free} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="accent-foreground" />
            Active
          </label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">Name<Input {...field("name")} /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">Price ₹<Input type="number" min={0} disabled={free} aria-label={`${plan.slug} price`} {...field("price")} /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Gens / {plan.period}<Input type="number" min={0} aria-label={`${plan.slug} generation limit`} {...field("generationLimit")} /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Saved max<Input type="number" min={0} placeholder="∞" {...field("savedLimit")} /></label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">
          Features (one per line)
          <textarea rows={4} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground" {...field("features")} />
        </label>
        {free && <p className="text-xs text-muted-foreground">The free daily limit is set under App settings.</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save plan"}</Button>
          {msg && <span role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </form>
    </Card>
  );
}
