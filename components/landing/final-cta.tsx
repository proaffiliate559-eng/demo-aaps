import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorialArt } from "@/components/landing/editorial-art";
import type { Dictionary } from "@/lib/i18n";

export function FinalCta({ t, isAuthed }: { t: Dictionary["cta"]; isAuthed: boolean }) {
  return (
    <section aria-labelledby="cta-title" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="relative grid overflow-hidden rounded-[2rem] bg-foreground text-background md:grid-cols-[1.4fr_1fr]">
          <div className="p-8 sm:p-14">
            <h2 id="cta-title" className="font-display text-4xl leading-[1.02] text-balance sm:text-6xl">
              {t.title}
            </h2>
            <p className="mt-4 max-w-md text-background/70">{t.body}</p>
            <Button asChild size="lg" variant="beige" className="mt-8">
              <Link href={isAuthed ? "/generate" : "/signup"}>
                {t.button} <ArrowRight />
              </Link>
            </Button>
          </div>
          <EditorialArt garment="trousers" tone="sand" className="hidden min-h-72 rounded-none md:block" />
        </div>
      </div>
    </section>
  );
}
