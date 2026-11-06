import type { Metadata } from "next";
import { notFound as featureOff } from "next/navigation";
import { getFeatureFlags } from "@/lib/settings/features";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CategoryArt } from "@/components/wardrobe/category-art";
import { DeleteItemButton } from "@/components/wardrobe/delete-item-button";
import { getWardrobeItem } from "@/lib/wardrobe/queries";
import { SEASONS, WARDROBE_CATEGORIES, labelOf } from "@/lib/config/options";

export const metadata: Metadata = { title: "Wardrobe item" };

export default async function WardrobeItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getFeatureFlags()).wardrobe) featureOff();
  const { id } = await params;
  const sp = await searchParams;
  const item = await getWardrobeItem(id);
  if (!item) notFound();
  const added = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(item.created_at));

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <Link href="/wardrobe" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Wardrobe
      </Link>
      {sp.saved && <Alert variant="success" className="mt-6">Changes saved.</Alert>}
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.1fr]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={item.imageUrl} alt={item.name} className="aspect-square w-full rounded-[1.5rem] object-cover" />
        ) : (
          <CategoryArt category={item.category} className="aspect-square" />
        )}
        <div>
          <p className="eyebrow">{labelOf(WARDROBE_CATEGORIES, item.category)}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{item.name}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Colour", item.colour],
              ["Brand", item.brand],
              ["Season", item.season ? labelOf(SEASONS, item.season) : null],
              ["Added", added],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {item.notes && (
            <div className="mt-6 rounded-2xl bg-muted p-4 text-sm leading-relaxed">
              <p className="text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-line">{item.notes}</p>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-start gap-2">
            <Button asChild>
              <Link href={`/wardrobe/${item.id}/edit`}><Pencil aria-hidden /> Edit</Link>
            </Button>
            <DeleteItemButton id={item.id} name={item.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
