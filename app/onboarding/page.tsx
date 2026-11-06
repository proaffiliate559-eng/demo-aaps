import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireUser } from "@/lib/auth/session";
import { getFashionProfile } from "@/lib/profile/queries";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Set up your style profile" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const { profile, fashion } = await getFashionProfile();
  if (profile?.onboarding_completed_at) redirect("/dashboard");

  // Prefill the name from signup / Google if the profile has none yet.
  if (!fashion.basic.displayName) {
    fashion.basic.displayName =
      (user.user_metadata?.display_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? "";
  }

  return (
    <div className="min-h-dvh">
      <header className="container-page flex h-16 items-center justify-between sm:h-20">
        <Logo href="/onboarding" />
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">Sign out</Button>
        </form>
      </header>
      <main id="main" className="container-page max-w-2xl pb-16 pt-4 sm:pt-8">
        <OnboardingWizard initial={fashion} />
      </main>
    </div>
  );
}
