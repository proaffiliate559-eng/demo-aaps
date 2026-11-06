import type { Metadata } from "next";
import { notFound as featureOff } from "next/navigation";
import { getFeatureFlags } from "@/lib/settings/features";
import Link from "next/link";
import { Plus, Search, Shirt, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CategoryArt } from "@/components/wardrobe/category-art";
import { countWardrobeByCategory, listWardrobe } from "@/lib/wardrobe/queries";
import { SEASONS, WARDROBE_CATEGORIES, labelOf } from "@/lib/config/options";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My wardrobe" };

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getFeatureFlags()).wardrobe) featureOff();
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [items, { total, counts }] = await Promise.all([listWardrobe({ category, q }), countWardrobeByCategory()]);

  const href = (params: { category?: string; q?: string }) => {
    const u = new URLSearchParams();
    if (params.category) u.set("category", params.category);
    if (params.q) u.set("q", params.q);
    const s = u.toString();
    return s ? `/wardrobe?${s}` : "/wardrobe";
  };

  return (
    <div className="container-page max-w-6xl py-8 sm:py-12">
      {sp.added && <Alert variant="success" className="mb-6">Item added to your wardrobe.</Alert>}
      {sp.deleted && <Alert variant="success" className="mb-6">Item deleted.</Alert>}
      <PageHeader
        eyebrow="My wardrobe"
        title="Everything you own, in one place"
        description={`${total} item${total === 1 ? "" : "s"}. Your AI stylist uses these when suggesting outfits.`}
        actions={
          <Button asChild>
            <Link href="/wardrobe/new"><Plus aria-hidden /> Add item</Link>
          </Button>
        }
      />

      {total > 0 && (
        <div className="mt-8 space-y-4">
          <form role="search" action="/wardrobe" className="relative max-w-md">
            {category && <input type="hidden" name="category" value={category} />}
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search name, colour, brand…" aria-label="Search wardrobe" className="pl-11" maxLength={60} />
          </form>
          <nav aria-label="Filter by category" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
            <ul className="flex gap-2">
              <li>
                <Link href={href({ q })} aria-current={!category ? "page" : undefined}
                  className={cn("inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm", !category ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:border-foreground/40")}>
                  All <span className="ml-1.5 opacity-60">{total}</span>
                </Link>
              </li>
              {WARDROBE_CATEGORIES.filter((c) => counts[c.value]).map((c) => (
                <li key={c.value}>
                  <Link href={href({ category: c.value, q })} aria-current={category === c.value ? "page" : undefined}
                    className={cn("inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm", category === c.value ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:border-foreground/40")}>
                    {c.label} <span className="ml-1.5 opacity-60">{counts[c.value]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <div className="mt-8">
        {total === 0 ? (
          <EmptyState icon={Shirt} title="Your wardrobe is empty" body="Add the clothes you own — your stylist will use them to suggest outfits you can wear today.">
            <Button asChild><Link href="/wardrobe/new"><Plus aria-hidden /> Add your first item</Link></Button>
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState icon={Search} title="No matching items" body="Try a different search or category.">
            <Button asChild variant="outline"><Link href="/wardrobe"><X aria-hidden /> Clear filters</Link></Button>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Wardrobe items">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/wardrobe/${item.id}`} className="group block overflow-hidden rounded-[1.25rem] border border-border bg-surface transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)]">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={item.imageUrl} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <CategoryArt category={item.category} className="aspect-square rounded-none" />
                  )}
                  <div className="p-3.5">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[labelOf(WARDROBE_CATEGORIES, item.category), item.colour, item.season ? labelOf(SEASONS, item.season) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
