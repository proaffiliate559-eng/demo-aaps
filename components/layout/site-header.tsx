"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

export function SiteHeader({ t, isAuthed }: { t: Dictionary["nav"]; isAuthed: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/#top", label: t.home },
    { href: "/#how-it-works", label: t.howItWorks },
    { href: "/#features", label: t.features },
    { href: "/#pricing", label: t.pricing },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background,border-color,backdrop-filter] duration-300",
        scrolled ? "border-b border-border/80 bg-background/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                {t.dashboard} <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t.getStarted}</Link>
              </Button>
            </>
          )}
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.openMenu}>
              <Menu className="!size-5" />
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-x-0 top-0 z-50 rounded-b-[1.75rem] bg-background px-4 pb-8 pt-3 shadow-2xl focus:outline-none">
              <div className="flex h-12 items-center justify-between">
                <Dialog.Title asChild>
                  <span className="font-display text-xl">Menu</span>
                </Dialog.Title>
                <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label={t.closeMenu}>
                    <X className="!size-5" />
                  </Button>
                </Dialog.Close>
              </div>
              <nav aria-label="Mobile" className="mt-4 flex flex-col">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="border-b border-border py-4 font-display text-3xl"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {isAuthed ? (
                  <Button asChild className="col-span-2">
                    <Link href="/dashboard">{t.dashboard}</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href="/login">{t.login}</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/signup">{t.getStarted}</Link>
                    </Button>
                  </>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
