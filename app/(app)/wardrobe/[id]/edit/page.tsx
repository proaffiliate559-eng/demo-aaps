import type { Metadata } from "next";
import { notFound as featureOff } from "next/navigation";
import { getFeatureFlags } from "@/lib/settings/features";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { WardrobeForm } from "@/components/wardrobe/wardrobe-form";
import { updateWardrobeItem } from "@/lib/wardrobe/actions";
import { getWardrobeItem } from "@/lib/wardrobe/queries";

export const metadata: Metadata = { title: "Edit wardrobe item" };

export default async function EditWardrobeItemPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getFeatureFlags()).wardrobe) featureOff();
  const { id } = await params;
  const item = await getWardrobeItem(id);
  if (!item) notFound();
  return (
    <div className="container-page max-w-2xl py-8 sm:py-12">
      <PageHeader eyebrow="My wardrobe" title="Edit item" />
      <Card className="mt-8 p-6 sm:p-8">
        <WardrobeForm action={updateWardrobeItem.bind(null, item.id)} item={item} submitLabel="Save changes" cancelHref={`/wardrobe/${item.id}`} />
      </Card>
    </div>
  );
}
