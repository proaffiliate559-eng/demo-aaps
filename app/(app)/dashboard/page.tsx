import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Lightbulb, PartyPopper, WandSparkles, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreditsCard } from "@/components/dashboard/credits-card";
import { OutfitMiniCard } from "@/components/dashboard/outfit-mini-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MoodSelector } from "@/components/dashboard/mood-selector";
import { EditorialArt } from "@/components/landing/editorial-art";
import { requireUser } from "@/lib/auth/session";
import { getFashionProfile } from "@/lib/profile/queries";
import { getCreditStatus } from "@/lib/usage/queries";
import { getRecentOutfits, getSavedOutfits } from "@/lib/outfits/queries";
import { pickTips } from "@/lib/config/tips";
import { isNavAvailable } from "@/lib/config/app-nav";
import { BUDGETS, COLOURS, OCCASIONS, STYLES, labelOf } from "@/lib/config/options";

export const metadata: Metadata = { title: "Dashboard" };

function istParts(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(date));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(date);
  return { greeting, day };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/dashboard");
  const sp = await searchParams;
  const [{ profile, fashion }, credits, recent, saved] = await Promise.all([
    getFashionProfile(),
    getCreditStatus(),
    getRecentOutfits(6),
    getSavedOutfits(4),
  ]);

  const name = profile?.display_name ?? "there";
  const { greeting, day } = istParts();
  const tips = pickTips([...fashion.styles.styles, ...fashion.occasions.occasions, ...fashion.colours.colours]);
  const latest = recent[0];
  const canGenerate = isNavAvailable("/generate");

  return (
    <div className="container-page max-w-6xl py-8 sm:py-12">
      {sp.welcome && (
        <Alert variant="success" className="mb-8">
          <span className="inline-flex items-center gap-2">
            <PartyPopper aria-hidden className="size-4" />
            Your style profile is ready. Welcome to StyleMood, {name}!
          </span>
        </Alert>
      )}
      {sp.password === "updated" && <Alert variant="success" className="mb-8">Your password has been updated.</Alert>}

      <p className="eyebrow">{greeting} · {day}</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.02] sm:text-6xl">
        Hello, <em className="text-sand">{name}</em>
      </h1>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Today's outfit */}
        <Card className="overflow-hidden" data-testid="today-card">
          <div className="grid sm:grid-cols-[1fr_14rem]">
            <div className="flex flex-col p-6 sm:p-8">
              <p className="eyebrow">Today&apos;s outfit</p>
              {latest ? (
                <>
                  <h2 className="mt-3 font-display text-4xl leading-tight">{latest.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{latest.description}</p>
                  <Link href={`/generate/${latest.request_id}`} className="mt-3 text-sm font-medium underline underline-offset-4">
                    View all three looks
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mt-3 font-display text-4xl leading-tight">Your first look is a few taps away</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Tell us your mood and occasion, and your stylist will put together three outfits — safe, trendy and bold.
                  </p>
                </>
              )}
              <div className="mt-auto pt-6">
                {canGenerate ? (
                  <Button asChild size="lg">
                    <Link href="/generate"><WandSparkles aria-hidden /> Generate outfit</Link>
                  </Button>
                ) : (
                  <div>
                    <Button size="lg" disabled aria-describedby="generate-soon">
                      <WandSparkles aria-hidden /> Generate outfit
                    </Button>
                    <p id="generate-soon" className="mt-2 text-xs text-muted-foreground">
                      The AI outfit generator arrives in the next update.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <EditorialArt garment="dress" tone="sand" className="hidden min-h-64 rounded-none sm:block" />
          </div>
        </Card>

        <CreditsCard credits={credits} />
      </div>

      <MoodSelector />

      {/* Recent */}
      <section aria-labelledby="recent-title" className="mt-14">
        <h2 id="recent-title" className="font-display text-3xl">Recent recommendations</h2>
        <div className="mt-5">
          {recent.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((o) => <OutfitMiniCard key={o.id} outfit={o} />)}
            </div>
          ) : (
            <EmptyState icon={WandSparkles} title="No recommendations yet" body="Outfits you generate will appear here.">
              {canGenerate && (
                <Button asChild variant="outline" size="sm"><Link href="/generate">Generate your first look</Link></Button>
              )}
            </EmptyState>
          )}
        </div>
      </section>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Favourites */}
        <section aria-labelledby="fav-title">
          <div className="flex items-baseline justify-between">
            <h2 id="fav-title" className="font-display text-3xl">Favourite looks</h2>
            {saved.length > 0 && <Link href="/saved" className="text-sm underline underline-offset-4">View all</Link>}
          </div>
          <div className="mt-5">
            {saved.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {saved.map((o) => <OutfitMiniCard key={o.id} outfit={o} />)}
              </div>
            ) : (
              <EmptyState icon={Heart} title="Nothing saved yet" body="Tap the heart on any recommendation to keep it in your lookbook." />
            )}
          </div>
        </section>

        <div className="space-y-5">
          {/* Profile summary */}
          <Card className="p-6" data-testid="style-summary">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow">Your style profile</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/profile"><Pencil aria-hidden /> Edit</Link>
              </Button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Styles</dt>
                <dd className="mt-1">{fashion.styles.styles.map((s) => labelOf(STYLES, s)).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Colours</dt>
                <dd className="mt-1">
                  {[...fashion.colours.colours.map((c) => labelOf(COLOURS, c)), ...fashion.colours.customColours].join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="mt-1">{labelOf(BUDGETS, fashion.budget.budget) || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Occasions</dt>
                <dd className="mt-1">{fashion.occasions.occasions.map((o) => labelOf(OCCASIONS, o)).join(", ") || "—"}</dd>
              </div>
            </dl>
          </Card>

          {/* Tips */}
          <Card className="bg-foreground p-6 text-background">
            <h2 className="eyebrow !text-background/60 inline-flex items-center gap-2">
              <Lightbulb aria-hidden className="size-3.5" /> Tips for your style
            </h2>
            <ul className="mt-4 space-y-4">
              {tips.map((t) => (
                <li key={t.id} className="border-l border-background/20 pl-4 text-sm leading-relaxed text-background/85">
                  {t.tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
