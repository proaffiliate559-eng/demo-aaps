/** Ranked horizontal bars (magnitude, single hue), value labelled at the end. */
export function RankBars({ title, rows, empty = "No data yet." }: { title: string; rows: { label: string; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-[1.25rem] border border-border bg-surface p-5" aria-label={title}>
      <h3 className="font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm" title={`${r.label}: ${r.value}`}>
              <span className="truncate text-foreground/80">{r.label}</span>
              <span className="h-2.5 rounded-r-[4px] bg-muted">
                <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, background: "var(--accent-ink)" }} />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
