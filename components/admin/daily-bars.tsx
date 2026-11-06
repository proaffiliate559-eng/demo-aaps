"use client";

import { useState } from "react";

type Point = { label: string; value: number };

/** Single-series daily bar chart: one hue, thin rounded bars, hover tooltip, table view. */
export function DailyBars({ title, points, unit }: { title: string; points: Point[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const ticks = [max, Math.round(max / 2), 0];

  return (
    <figure className="rounded-[1.25rem] border border-border bg-surface p-5">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{total} {unit} total</span>
      </figcaption>
      <div className="mt-5 grid grid-cols-[2rem_1fr] gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[0.65rem] tabular-nums text-muted-foreground" aria-hidden>
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
        <div className="relative h-40">
          {/* recessive gridlines */}
          {[0, 50, 100].map((p) => (
            <div key={p} className="absolute inset-x-0 border-t border-border/70" style={{ top: `${p}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
            {points.map((p, i) => (
              <div
                key={p.label}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${(p.value / max) * 100}%`,
                    minHeight: p.value > 0 ? 3 : 0,
                    background: "var(--accent-ink)",
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg">
                    {p.label}: <span className="font-semibold tabular-nums">{p.value}</span> {unit}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-10 mt-2 flex justify-between text-[0.65rem] text-muted-foreground" aria-hidden>
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th className="py-1 font-normal text-muted-foreground">Day</th><th className="py-1 font-normal text-muted-foreground">{unit}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.label}><td className="py-0.5">{p.label}</td><td className="tabular-nums">{p.value}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
