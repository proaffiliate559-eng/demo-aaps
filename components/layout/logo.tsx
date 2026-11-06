import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M20.5 10.6c-1-1.1-2.6-1.8-4.4-1.8-2.9 0-4.9 1.6-4.9 3.9 0 5 9.9 3.2 9.9 7.6 0 1.9-1.9 3.1-4.6 3.1-2 0-3.8-.8-5-2.2"
        fill="none"
        stroke="var(--background)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="23.2" cy="8.8" r="1.6" fill="var(--beige-strong)" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark className="text-foreground transition-transform duration-300 group-hover:rotate-[-6deg]" />
      <span className="font-display text-[1.45rem] leading-none">
        StyleMood{" "}
        <span className="align-super font-sans text-[0.6rem] font-semibold tracking-[0.18em] text-sand">AI</span>
        <span className="sr-only"> — home</span>
      </span>
    </Link>
  );
}
