"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { grantPlan } from "@/lib/admin/actions";

export function GrantPlanForm({ userId, plans }: { userId: string; plans: { slug: string; name: string }[] }) {
  const [slug, setSlug] = useState(plans[0]?.slug ?? "");
  const [days, setDays] = useState("30");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await grantPlan(userId, { planSlug: slug, days: Number(days) });
          setMsg({ ok: r.ok, text: r.message ?? "" });
        });
      }}
    >
      <label className="w-40 space-y-1 text-xs text-muted-foreground">
        Plan
        <NativeSelect value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Plan to grant">
          {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </NativeSelect>
      </label>
      <label className="w-24 space-y-1 text-xs text-muted-foreground">
        Days
        <Input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days" />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Granting…" : "Grant plan"}</Button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`w-full text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
