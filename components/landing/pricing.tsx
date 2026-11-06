import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import type { PlanView } from "@/lib/plans/queries";
import { cn, formatINR } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

export function Pricing({ t, isAuthed, plans }: { t: Dictionary["pricing"]; isAuthed: boolean; plans: PlanView[] }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading id="pricing-title" eyebrow={t.eyebrow} title={t.title} align="center" />
        <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">{t.note}</p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <Reveal key={plan.slug} delay={i * 0.06}>
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-[1.5rem] border p-7",
                  plan.highlighted ? "border-foreground bg-foreground text-background" : "border-border bg-surface",
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute right-5 top-5 bg-beige text-foreground">{t.popular}</Badge>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">{plan.name}</h3>
                <p className={cn("mt-1 text-sm", plan.highlighted ? "text-background/60" : "text-muted-foreground")}>
                  {plan.tagline}
                </p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-5xl">{plan.priceInr === 0 ? t.free : formatINR(plan.priceInr)}</span>
                  {plan.priceInr > 0 && (
                    <span className={cn("text-sm", plan.highlighted ? "text-background/60" : "text-muted-foreground")}>
                      {t.perMonth}
                    </span>
                  )}
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", plan.highlighted ? "text-beige" : "text-sand")} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.highlighted ? "beige" : plan.priceInr === 0 ? "default" : "outline"}
                  >
                    <Link href={isAuthed ? (plan.priceInr === 0 ? "/dashboard" : "/billing") : "/signup"}>
                      {plan.priceInr === 0 ? t.ctaFree : t.ctaPaid}
                    </Link>
                  </Button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
