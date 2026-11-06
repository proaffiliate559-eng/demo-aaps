"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { AdminResult } from "@/lib/admin/actions";

/** Runs an admin server action with optional confirmation and shows the result. */
export function ActionButton({
  action,
  children,
  confirm,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & { action: () => Promise<AdminResult | void>; confirm?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        {...props}
        disabled={pending || props.disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            if (r) setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Done." : "Failed.") });
          });
        }}
      >
        {pending ? "Working…" : children}
      </Button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-success" : "text-xs text-danger"}>{msg.text}</span>}
    </span>
  );
}
