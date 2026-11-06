import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { EditorialArt, type GarmentKind, type Tone } from "@/components/landing/editorial-art";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  art = { garment: "dress", tone: "sand", quote: "Dress for the mood you're in." },
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  art?: { garment: GarmentKind; tone: Tone; quote: string };
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-5xl">{title}</h1>
          {subtitle && <div className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">{subtitle}</div>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </main>
        <p className="text-center text-xs text-muted-foreground lg:text-left">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </p>
      </div>
      <div className="hidden p-4 lg:block">
        <EditorialArt garment={art.garment} tone={art.tone} className="h-full min-h-[40rem] rounded-[2rem]">
          <figure className="absolute inset-x-10 bottom-10">
            <blockquote className="font-display text-5xl leading-[1.05] text-foreground">{art.quote}</blockquote>
            <figcaption className="eyebrow mt-4 !text-foreground/60">StyleMood AI</figcaption>
          </figure>
        </EditorialArt>
      </div>
    </div>
  );
}
