import type { Metadata } from "next";
import { notFound as featureOff } from "next/navigation";
import { getFeatureFlags } from "@/lib/settings/features";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { WardrobeForm } from "@/components/wardrobe/wardrobe-form";
import { createWardrobeItem } from "@/lib/wardrobe/actions";

export const metadata: Metadata = { title: "Add wardrobe item" };

export default async function NewWardrobeItemPage() {
  if (!(await getFeatureFlags()).wardrobe) featureOff();
  return (
    <div className="container-page max-w-2xl py-8 sm:py-12">
      <PageHeader eyebrow="My wardrobe" title="Add an item" />
      <Card className="mt-8 p-6 sm:p-8">
        <WardrobeForm action={createWardrobeItem} submitLabel="Add to wardrobe" cancelHref="/wardrobe" />
      </Card>
    </div>
  );
}
