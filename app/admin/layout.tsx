import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · StyleMood AI" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin(); // 404 for everyone else
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <span className="inline-flex items-center gap-1 rounded-full bg-beige px-2.5 py-1 text-xs font-medium">
              <ShieldCheck aria-hidden className="size-3.5" /> Admin
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{admin.email}</span>
            <Link href="/dashboard" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft aria-hidden className="size-4" /> App
            </Link>
          </div>
        </div>
        <div className="container-page pb-3">
          <AdminNav />
        </div>
      </header>
      <main id="main" className="container-page py-8">{children}</main>
    </div>
  );
}
