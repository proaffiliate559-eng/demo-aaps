import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { ConfigNotice } from "@/components/auth/config-notice";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { sanitizeRedirect } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't complete. Please try again.",
  google_unavailable: "Google sign-in isn't available right now.",
  not_configured: "Sign-in isn't configured on this deployment yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const next = rawNext ? sanitizeRedirect(rawNext) : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const configured = isSupabaseConfigured();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see today's looks and your saved style."
      footer={
        <>
          New to StyleMood?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create a free account
          </Link>
        </>
      }
    >
      {!configured && <ConfigNotice />}
      {configured && error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {sp.signed_out && <Alert variant="success" className="mb-6">You&apos;ve been signed out.</Alert>}
      {sp.password === "updated" && <Alert variant="success" className="mb-6">Password updated. Please sign in.</Alert>}
      {configured && publicEnv.googleAuthEnabled && (
        <>
          <GoogleButton next={next} />
          <OrDivider />
        </>
      )}
      <LoginForm next={next} disabled={!configured} />
    </AuthShell>
  );
}
