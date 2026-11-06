import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Showcase } from "@/components/landing/showcase";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { getActivePlans } from "@/lib/plans/queries";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = getDictionary("en");
  const [user, plans] = await Promise.all([getCurrentUser(), getActivePlans()]);
  const isAuthed = Boolean(user);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <SiteHeader t={t.nav} isAuthed={isAuthed} />
      <main id="main">
        {sp.account === "deleted" && (
          <div role="status" className="container-page pt-4">
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              Your account and all associated data have been permanently deleted.
            </p>
          </div>
        )}
        <Hero t={t.hero} isAuthed={isAuthed} />
        <HowItWorks t={t.howItWorks} />
        <Features t={t.features} />
        <Showcase t={t.showcase} />
        <Pricing t={t.pricing} isAuthed={isAuthed} plans={plans} />
        <Faq t={t.faq} />
        <FinalCta t={t.cta} isAuthed={isAuthed} />
      </main>
      <SiteFooter t={t.footer} nav={t.nav} />
    </>
  );
}
