import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading } from "@/components/landing/section-heading";
import { FAQS } from "@/lib/config/showcase";
import type { Dictionary } from "@/lib/i18n";

export function Faq({ t }: { t: Dictionary["faq"] }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-border bg-surface py-20 sm:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading id="faq-title" eyebrow={t.eyebrow} title={t.title} />
        <Accordion type="single" collapsible className="border-t border-border">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
