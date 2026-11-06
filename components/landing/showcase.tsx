import { Info } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { EditorialArt } from "@/components/landing/editorial-art";
import { SHOWCASE_LOOKS } from "@/lib/config/showcase";
import { formatINR } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

export function Showcase({ t }: { t: Dictionary["showcase"] }) {
  return (
    <section id="examples" aria-labelledby="showcase-title" className="border-y border-border bg-muted/60 py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading id="showcase-title" eyebrow={t.eyebrow} title={t.title} />
          <p className="max-w-sm rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground lg:text-right">
            {t.request}
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {SHOWCASE_LOOKS.map((look, i) => (
            <Reveal key={look.name} delay={i * 0.1}>
              <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface">
                <EditorialArt garment={look.garment} tone={look.tone} className="aspect-[4/3] rounded-none" />
                <div className="flex flex-1 flex-col p-6">
                  <p className="eyebrow !text-[0.65rem]">{look.tier}</p>
                  <h3 className="mt-2 font-display text-3xl">{look.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{look.description}</p>
                  <dl className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
                    {look.items.map((item) => (
                      <div key={item.label} className="grid grid-cols-[6rem_1fr] gap-2">
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto flex items-center justify-between pt-6">
                    <div className="flex -space-x-1.5">
                      {look.palette.map((c) => (
                        <span
                          key={c.name}
                          title={c.name}
                          className="size-6 rounded-full border-2 border-surface"
                          style={{ background: c.hex }}
                        />
                      ))}
                      <span className="sr-only">Colours: {look.palette.map((c) => c.name).join(", ")}</span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Est. </span>
                      <span className="font-medium">{formatINR(look.budgetInr)}</span>
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {t.disclaimer}
        </p>
      </div>
    </section>
  );
}
