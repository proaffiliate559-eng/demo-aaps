"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportOutfit } from "@/lib/outfits/actions";

export function ReportButton({ outfitId }: { outfitId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | string>("idle");
  const [pending, start] = useTransition();

  if (status === "sent") return <p role="status" className="text-xs text-muted-foreground">Thanks — our team will review this look.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Flag aria-hidden className="size-3.5" /> Report a problem
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await reportOutfit({ outfitId, reason });
          setStatus(res.ok ? "sent" : res.message);
        });
      }}
      className="space-y-2"
    >
      <label htmlFor={`report-${outfitId}`} className="text-xs font-medium">What&apos;s wrong with this look?</label>
      <textarea
        id={`report-${outfitId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={2}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
      />
      {status !== "idle" && <p role="alert" className="text-xs text-danger">{status}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending || reason.trim().length < 3}>
          {pending ? "Sending…" : "Send report"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
