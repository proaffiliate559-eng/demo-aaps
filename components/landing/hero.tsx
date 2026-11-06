import Link from "next/link";
import { ArrowRight, Sparkles, CloudSun, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorialArt } from "@/components/landing/editorial-art";
import type { Dictionary } from "@/lib/i18n";

export function Hero({ t, isAuthed }: { t: Dictionary["hero"]; isAuthed: boolean }) {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(60%_60%_at_70%_20%,var(--beige)_0%,transparent_70%)] opacity-70" />
      <div className="container-page grid items-center gap-12 pb-20 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20">
        <div>
          <p style={{ "--delay": "0ms" } as React.CSSProperties} className="animate-rise eyebrow inline-flex items-center gap-2">
            <Sparkles aria-hidden className="size-3.5 text-sand" />
            {t.eyebrow}
          </p>
          <h1 style={{ "--delay": "80ms" } as React.CSSProperties}
            id="hero-title"
            className="animate-rise mt-6 font-display text-[3.1rem] leading-[0.95] tracking-tight text-balance sm:text-7xl lg:text-[5.4rem]"
          >
            {t.titleA} <em className="text-sand">{t.titleB}</em>{" "}
            <span className="block">{t.titleC}</span>
          </h1>
          <p style={{ "--delay": "160ms" } as React.CSSProperties} className="animate-rise mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            {t.subtitle}
          </p>
          <div style={{ "--delay": "240ms" } as React.CSSProperties} className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={isAuthed ? "/generate" : "/signup"}>
                {t.primaryCta} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#features">{t.secondaryCta}</Link>
            </Button>
          </div>
          <p style={{ "--delay": "300ms" } as React.CSSProperties} className="animate-rise mt-6 text-sm text-muted-foreground">
            {t.trust}
          </p>
        </div>

        {/* Decorative mood-board composition (illustrative, not user data). */}
        <div
          className="animate-settle relative mx-auto grid w-full max-w-xl grid-cols-5 grid-rows-6 gap-3 sm:gap-4"
          style={{ aspectRatio: "5 / 5.4", "--delay": "150ms" } as React.CSSProperties}
          aria-label="Illustrative example of a StyleMood outfit board"
          role="img"
        >
          <EditorialArt garment="dress" tone="sand" className="col-span-3 row-span-6">
            <div className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur">
              Mood · Romantic
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/85 p-4 text-foreground backdrop-blur">
              <p className="eyebrow !text-[0.62rem]">Look 02 · Trendy</p>
              <p className="mt-1 font-display text-2xl leading-tight">Golden Hour Date</p>
            </div>
          </EditorialArt>
          <div className="col-span-2 row-span-3 flex flex-col justify-between rounded-[1.5rem] border border-border bg-surface p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.25)]">
            <p className="eyebrow !text-[0.62rem]">The pieces</p>
            <ul className="space-y-1.5 text-[0.8rem] leading-snug sm:text-sm">
              <li>Satin slip midi dress</li>
              <li>Cropped cream cardigan</li>
              <li>Nude block heels</li>
            </ul>
            <div className="flex gap-1.5" aria-hidden>
              {["#c8b293", "#efe9dc", "#b4552d"].map((c) => (
                <span key={c} className="size-5 rounded-full border border-black/5" style={{ background: c }} />
              ))}
            </div>
          </div>
          <EditorialArt garment="sneaker" tone="ink" className="col-span-2 row-span-2" />
          <div className="col-span-2 row-span-1 flex items-center justify-between rounded-full bg-foreground px-4 text-xs text-background sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CloudSun aria-hidden className="size-4" /> Pleasant
            </span>
            <span className="inline-flex items-center">
              <IndianRupee aria-hidden className="size-3.5" />
              2,400
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
