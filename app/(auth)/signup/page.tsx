import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { ConfigNotice } from "@/components/auth/config-notice";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Meet your stylist"
      subtitle="Create a free account — 3 personalised looks every day."
      art={{ garment: "kurta", tone: "blush", quote: "Three looks. Every mood. Every occasion." }}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {!configured && <ConfigNotice />}
      {configured && publicEnv.googleAuthEnabled && (
        <>
          <GoogleButton next="/onboarding" label="Sign up with Google" />
          <OrDivider />
        </>
      )}
      <SignupForm disabled={!configured} />
    </AuthShell>
  );
}
