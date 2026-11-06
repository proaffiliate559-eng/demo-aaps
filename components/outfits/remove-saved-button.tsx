"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSaveOutfit } from "@/lib/outfits/actions";

export function RemoveSavedButton({ outfitId, name }: { outfitId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Remove ${name} from saved looks`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await toggleSaveOutfit(outfitId, false);
            if (res.ok) router.refresh();
            else setError(res.message);
          })
        }
      >
        <HeartOff aria-hidden /> {pending ? "Removing…" : "Remove"}
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </>
  );
}
