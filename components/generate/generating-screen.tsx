"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Honest waiting state: we can't measure the AI's internal progress, so we
 * show what is actually happening and the real elapsed time — no fake percentages.
 */
export function GeneratingScreen({ hasPhoto }: { hasPhoto: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const status =
    seconds < 20
      ? hasPhoto
        ? "Your stylist is reviewing your photo and preferences…"
        : "Your stylist is putting together three looks…"
      : seconds < 45
        ? "Still working — the AI is busier than usual. Thanks for waiting."
        : "Almost at our time limit. If this fails, your credit won't be used.";

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-16 text-center">
      <div className="relative size-28" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-foreground/30"
            animate={reduce ? undefined : { scale: [0.6, 1.15], opacity: [0.9, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}
        <span className="absolute inset-[30%] rounded-full bg-foreground" />
      </div>
      <h2 className="mt-10 font-display text-4xl">Styling your looks</h2>
      <p className="mt-3 max-w-sm text-muted-foreground">{status}</p>
      <p className="mt-6 text-xs tabular-nums text-muted-foreground">{seconds}s · usually 10–20 seconds</p>
    </div>
  );
}
