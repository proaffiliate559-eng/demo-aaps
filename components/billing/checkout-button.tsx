"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RazorpayOptions = Record<string, unknown>;
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({ planSlug, label, highlighted }: { planSlug: string; label: string; highlighted?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "starting" | "verifying">("idle");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  async function start() {
    setError(undefined);
    setState("starting");
    const res = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planSlug }),
    });
    const order = await res.json().catch(() => null);
    if (!res.ok) {
      setState("idle");
      setError(order?.error?.message ?? "Couldn't start checkout.");
      return;
    }
    if (!(await loadCheckout()) || !window.Razorpay) {
      setState("idle");
      setError("Couldn't load the payment window. Check your connection.");
      return;
    }
    const cancel = (reason: "dismissed" | "failed", detail?: string) =>
      fetch("/api/payments/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, reason, detail }),
      });

    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "StyleMood AI",
      description: `${order.planName} plan — 1 month`,
      prefill: { email: order.email },
      theme: { color: "#121110" },
      handler: async (resp: Record<string, string>) => {
        // The browser's "success" is NOT trusted — the server verifies the signature.
        setState("verifying");
        const v = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(resp),
        });
        const vj = await v.json().catch(() => null);
        setState("idle");
        if (v.ok) {
          setSuccess(true);
          router.refresh();
        } else {
          setError(vj?.error?.message ?? "We couldn't verify the payment. If you were charged, your plan will activate shortly.");
        }
      },
      modal: {
        ondismiss: () => {
          setState("idle");
          void cancel("dismissed");
        },
      },
    });
    rzp.on("payment.failed", (r) => {
      setError(r.error?.description ?? "Payment failed. You have not been charged.");
      void cancel("failed", r.error?.description);
    });
    rzp.open();
  }

  if (success) return <p role="status" className="text-sm font-medium text-success">Payment confirmed — enjoy your new plan!</p>;
  return (
    <div className="space-y-2">
      <Button className="w-full" variant={highlighted ? "beige" : "default"} onClick={start} disabled={state !== "idle"}>
        {state !== "idle" && <Loader2 aria-hidden className="animate-spin" />}
        {state === "starting" ? "Opening checkout…" : state === "verifying" ? "Confirming payment…" : label}
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
