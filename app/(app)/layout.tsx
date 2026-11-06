import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getProfileRows } from "@/lib/profile/queries";
import { getFeatureFlags } from "@/lib/settings/features";
import { isCurrentUserAdmin } from "@/lib/auth/admin";

/** Signed-in area. Users must finish onboarding before using the app. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { profile } = await getProfileRows();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const name = profile.display_name ?? user.email?.split("@")[0] ?? "You";
  const [flags, isAdmin] = await Promise.all([getFeatureFlags(), isCurrentUserAdmin()]);
  const hidden = (["stylist_chat", "wardrobe"] as const).filter((f) => !flags[f]);
  return (
    <AppShell name={name} email={user.email ?? ""} hiddenFeatures={hidden} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
