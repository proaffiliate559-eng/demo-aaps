import Link from "next/link";
import { MOODS } from "@/lib/config/options";

/** Each mood starts the generator with that mood preselected. */
export function MoodSelector() {
  return (
    <section aria-labelledby="mood-title" className="mt-14">
      <h2 id="mood-title" className="font-display text-3xl">How are you feeling?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick a mood to start styling.</p>
      <ul className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {MOODS.map((m) => (
          <li key={m.value} className="shrink-0">
            <Link
              href={`/generate?mood=${m.value}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
            >
              <span aria-hidden>{m.emoji}</span>
              {m.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
