import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getFashionProfile } from "@/lib/profile/queries";

export const metadata: Metadata = { title: "Fashion profile" };

export default async function ProfilePage() {
  const { fashion } = await getFashionProfile();
  return (
    <div className="container-page max-w-5xl py-8 sm:py-12">
      <PageHeader
        eyebrow="Fashion profile"
        title="Your style, your rules"
        description="Everything here shapes your recommendations. Update any section whenever your taste changes."
      />
      <div className="mt-10">
        <ProfileEditor initial={fashion} />
      </div>
    </div>
  );
}
