import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth/session";

export async function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const t = getDictionary("en");
  const isAuthed = Boolean(await getCurrentUser());
  return (
    <>
      <SiteHeader t={t.nav} isAuthed={isAuthed} />
      <main id="main" className="container-page max-w-3xl py-16 sm:py-24">
        <p className="eyebrow">Last updated {updated}</p>
        <h1 className="mt-4 font-display text-5xl sm:text-6xl">{title}</h1>
        <div className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Draft for the StyleMood AI MVP. Have this reviewed by a qualified lawyer (including for India&apos;s Digital
          Personal Data Protection Act, 2023) before public launch.
        </div>
        <div className="mt-10 space-y-8 text-[0.98rem] leading-relaxed text-foreground/85 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:mt-1.5">
          {children}
        </div>
      </main>
      <SiteFooter t={t.footer} nav={t.nav} />
    </>
  );
}
