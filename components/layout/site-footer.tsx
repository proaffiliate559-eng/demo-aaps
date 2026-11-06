import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import type { Dictionary } from "@/lib/i18n";

export function SiteFooter({ t, nav }: { t: Dictionary["footer"]; nav: Dictionary["nav"] }) {
  const cols = [
    {
      title: t.product,
      links: [
        { href: "/#how-it-works", label: nav.howItWorks },
        { href: "/#features", label: nav.features },
        { href: "/#pricing", label: nav.pricing },
        { href: "/#faq", label: "FAQ" },
      ],
    },
    {
      title: t.account,
      links: [
        { href: "/login", label: nav.login },
        { href: "/signup", label: t.signup },
      ],
    },
    {
      title: t.legal,
      links: [
        { href: "/privacy", label: t.privacy },
        { href: "/terms", label: t.terms },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.tagline}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="eyebrow">{c.title}</h3>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-foreground/80 transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} StyleMood AI. {t.rights}
          </p>
          <p>{t.madeIn}</p>
        </div>
      </div>
    </footer>
  );
}
