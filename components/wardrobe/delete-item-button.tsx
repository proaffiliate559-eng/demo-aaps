"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWardrobeItem } from "@/lib/wardrobe/actions";

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden /> Delete
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-danger/25 bg-danger-soft/60 p-3" role="group" aria-label="Confirm delete">
      <span className="text-sm text-danger">Delete “{name}”?</span>
      <Button
        size="sm"
        className="bg-danger text-white hover:bg-danger/90"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteWardrobeItem(id);
            if (res && !res.ok) setError(res.message);
          })
        }
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </Button>
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
