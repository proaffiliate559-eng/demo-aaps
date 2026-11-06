"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { AppNavLinks } from "@/components/layout/app-nav";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

function AdminLink() {
  return (
    <Link href="/admin" className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-[0.92rem] text-foreground/75 hover:bg-muted">
      <ShieldCheck aria-hidden className="size-[1.1rem]" /> Admin
    </Link>
  );
}

function UserFooter({ name, email }: { name: string; email: string }) {
  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-beige font-display text-lg uppercase">
          {name.charAt(0) || "S"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <form action={signOut} className="mt-3">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <LogOut aria-hidden /> Sign out
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  name,
  email,
  hiddenFeatures = [],
  isAdmin = false,
  children,
}: {
  name: string;
  email: string;
  hiddenFeatures?: string[];
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Logo href="/dashboard" className="px-2" />
        <nav aria-label="App" className="mt-10 flex-1">
          <AppNavLinks hidden={hiddenFeatures} />
          {isAdmin && <AdminLink />}
        </nav>
        <UserFooter name={name} email={email} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:hidden">
        <Logo href="/dashboard" />
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="!size-5" />
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-surface px-4 py-4 shadow-2xl focus:outline-none">
              <div className="flex items-center justify-between">
                <Dialog.Title className="sr-only">Menu</Dialog.Title>
                <Dialog.Description className="sr-only">App navigation</Dialog.Description>
                <Logo href="/dashboard" />
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close menu">
                    <X className="!size-5" />
                  </Button>
                </Dialog.Close>
              </div>
              <nav aria-label="App" className="mt-8 flex-1">
                <AppNavLinks onNavigate={() => setOpen(false)} hidden={hiddenFeatures} />
                {isAdmin && <AdminLink />}
              </nav>
              <UserFooter name={name} email={email} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <main id="main" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
