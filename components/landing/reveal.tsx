import { cn } from "@/lib/utils";

/** Scroll reveal powered by CSS (no JavaScript); see `.reveal` in globals.css. */
export function Reveal({ children, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return <div className={cn("reveal", className)}>{children}</div>;
}
