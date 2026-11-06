import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { DeleteAccount } from "@/components/settings/delete-account";
import { requireUser } from "@/lib/auth/session";
import { getCreditStatus } from "@/lib/usage/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const credits = await getCreditStatus();
  const joined = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(user.created_at));
  const usesPassword = user.app_metadata?.provider === "email" || (user.app_metadata?.providers as string[] | undefined)?.includes("email");

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <PageHeader eyebrow="Settings" title="Account & privacy" />
      <div className="mt-10 space-y-5">
        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-3xl">Account</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="mt-1 font-medium">{joined}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="mt-1 font-medium">
                {credits.planName} · <Link href="/billing" className="font-normal underline underline-offset-4">Manage</Link>
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm text-muted-foreground">
            Language and styling preferences live in your{" "}
            <Link href="/profile" className="text-foreground underline underline-offset-4">fashion profile</Link>.
          </p>
        </Card>

        {usesPassword && (
          <Card className="p-6 sm:p-8">
            <h2 className="font-display text-3xl">Change password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use at least 8 characters with a letter and a number.</p>
            <div className="mt-6 max-w-md">
              <ResetPasswordForm />
            </div>
          </Card>
        )}

        <Card className="p-6 sm:p-8">
          <h2 className="font-display text-3xl">Privacy & data</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your photos are stored privately and are only sent to our AI provider with your consent. Read the{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-4">privacy notice</Link> for
            details on processing and retention.
          </p>
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="font-medium">Delete account</h3>
            <p className="mt-1 text-sm text-muted-foreground">Remove your account and all associated data permanently.</p>
            <div className="mt-4">
              <DeleteAccount />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
