import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link problem" };

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="That link didn't work"
      subtitle="Email links can only be used once and expire after a while. If you've already confirmed your email, just sign in."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/forgot-password">Reset password</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
