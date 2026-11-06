"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/lib/config/app-nav";
import { cn } from "@/lib/utils";

export function AppNavLinks({ onNavigate, hidden = [] }: { onNavigate?: () => void; hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {APP_NAV.filter((n) => !n.feature || !hidden.includes(n.feature)).map(({ href, label, icon: Icon, available }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const base = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.92rem] transition-colors";
        return (
          <li key={href}>
            {available ? (
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active ? "bg-foreground text-background" : "text-foreground/75 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-[1.1rem]" />
                {label}
              </Link>
            ) : (
              <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-muted-foreground/60")}>
                <Icon aria-hidden className="size-[1.1rem]" />
                {label}
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Soon
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
