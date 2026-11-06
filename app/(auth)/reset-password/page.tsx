import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // A valid recovery link signs the user in (via /auth/callback) before landing here.
  const user = await getCurrentUser();

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={user ? <>For {user.email}</> : undefined}
      art={{ garment: "jacket", tone: "sage", quote: "A fresh start, beautifully put together." }}
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-6">
          <Alert variant="error">
            This reset link is invalid or has expired. Reset links work once and expire after an hour.
          </Alert>
          <Button asChild className="w-full" size="lg">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
