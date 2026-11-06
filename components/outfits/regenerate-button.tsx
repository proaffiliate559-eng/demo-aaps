"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Re-run the same request (uses one credit). Photos aren't re-sent. */
export function RegenerateButton({ request, remaining }: { request: Record<string, string>; remaining: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  if (remaining <= 0) {
    return (
      <Button asChild variant="outline">
        <Link href="/generate">No generations left</Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          const res = await fetch("/api/generate-outfit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
          });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.requestId) {
            router.push(`/generate/${json.requestId}`);
            router.refresh();
          } else {
            setPending(false);
            setError(json?.error?.message ?? "Couldn't regenerate. No credit was used.");
          }
        }}
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
        {pending ? "Restyling… (10–20s)" : "Regenerate"}
      </Button>
      <span className="text-xs text-muted-foreground">Uses 1 of your {remaining} remaining</span>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
