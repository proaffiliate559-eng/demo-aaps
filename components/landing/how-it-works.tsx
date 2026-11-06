import { Camera, Smile, CalendarHeart, Sparkles } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import type { Dictionary } from "@/lib/i18n";

const ICONS = [Camera, Smile, CalendarHeart, Sparkles];

export function HowItWorks({ t }: { t: Dictionary["howItWorks"] }) {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="border-y border-border bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading id="how-title" eyebrow={t.eyebrow} title={t.title} />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <li key={step.title} className="bg-surface">
                <Reveal delay={i * 0.08} className="flex h-full flex-col p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-5xl text-sand">{String(i + 1).padStart(2, "0")}</span>
                    <span className="grid size-11 place-items-center rounded-full bg-muted">
                      <Icon aria-hidden className="size-5" />
                    </span>
                  </div>
                  <h3 className="mt-10 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{step.body}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
