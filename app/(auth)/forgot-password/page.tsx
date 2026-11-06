import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ConfigNotice } from "@/components/auth/config-notice";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a secure link to choose a new one."
      art={{ garment: "jacket", tone: "sage", quote: "A fresh start, beautifully put together." }}
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
          <ArrowLeft aria-hidden className="size-4" /> Back to sign in
        </Link>
      }
    >
      {!configured && <ConfigNotice />}
      <ForgotPasswordForm disabled={!configured} />
    </AuthShell>
  );
}
