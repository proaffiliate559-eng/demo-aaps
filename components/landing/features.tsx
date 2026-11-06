import { Smile, WandSparkles, Shirt, CloudSun, UserRound, Heart } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { EditorialArt } from "@/components/landing/editorial-art";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

const ICONS = [Smile, WandSparkles, Shirt, CloudSun, UserRound, Heart];

export function Features({ t }: { t: Dictionary["features"] }) {
  return (
    <section id="features" aria-labelledby="features-title" className="py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading id="features-title" eyebrow={t.eyebrow} title={t.title} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((f, i) => {
            const Icon = ICONS[i];
            const featured = i === 0;
            const last = i === t.items.length - 1;
            return (
              <Reveal key={f.title} delay={(i % 3) * 0.08} className={cn(featured && "sm:col-span-2 lg:col-span-1 lg:row-span-2", last && "sm:col-span-2 lg:col-span-3")}>
                <article
                  className={cn(
                    "group flex h-full flex-col rounded-[1.5rem] border border-border p-7 transition-shadow duration-300 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]",
                    featured ? "bg-foreground text-background" : "bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-full",
                      featured ? "bg-white/10" : "bg-muted",
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className={cn("mt-6 font-display text-3xl leading-tight", featured && "lg:text-4xl")}>{f.title}</h3>
                  <p className={cn("mt-2 leading-relaxed", featured ? "text-background/70" : "text-muted-foreground")}>
                    {f.body}
                  </p>
                  {featured && (
                    <div className="mt-8 hidden flex-1 gap-3 lg:grid lg:grid-cols-2">
                      <EditorialArt garment="jacket" tone="sand" className="min-h-40" />
                      <div className="grid gap-3">
                        {["Confident", "Relaxed", "Elegant"].map((m) => (
                          <span
                            key={m}
                            className="flex items-center rounded-2xl border border-white/15 px-4 text-sm text-background/80"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
