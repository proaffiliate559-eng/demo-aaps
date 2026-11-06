"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/profile/choice-group";
import { PhotoStep, type PhotoState } from "@/components/generate/photo-step";
import { GeneratingScreen } from "@/components/generate/generating-screen";
import { BUDGETS, GEN_OCCASIONS, GEN_STYLES, MOODS, WEATHER, labelOf } from "@/lib/config/options";
import { generateRequestSchema } from "@/lib/validations/generate";

const STEPS = ["photo", "mood", "occasion", "style", "weather", "budget", "review"] as const;
type Step = (typeof STEPS)[number];

const META: Record<Step, { title: string; subtitle: string }> = {
  photo: { title: "Add a photo (optional)", subtitle: "A photo of you or an outfit you like helps personalise your looks." },
  mood: { title: "How are you feeling today?", subtitle: "Your mood sets the tone of the outfit." },
  occasion: { title: "Where are you headed?", subtitle: "Pick the occasion you're dressing for." },
  style: { title: "Pick a style direction", subtitle: "We'll interpret it three ways — safe, trendy and bold." },
  weather: { title: "What's the weather like?", subtitle: "So you stay comfortable all day." },
  budget: { title: "Your budget for this look", subtitle: "Estimated for the complete outfit, in ₹." },
  review: { title: "Ready when you are", subtitle: "Check your choices, then let your stylist work." },
};

type Values = { mood: string | null; occasion: string | null; style: string | null; weather: string | null; budget: string | null };

export interface WizardCredits {
  remaining: number;
  limit: number;
  period: "day" | "month";
  resetsAt: string | null;
}

export function GenerateWizard({ initial, credits }: { initial: Values; credits: WizardCredits }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(initial.mood ? 1 : 0);
  const [v, setV] = useState<Values>(initial);
  const [photo, setPhoto] = useState<PhotoState>({ status: "empty" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "generating" | "limit">(credits.remaining > 0 ? "form" : "limit");

  const step = STEPS[index];
  const go = (i: number) => {
    setError(undefined);
    setFieldError(undefined);
    setIndex(i);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  function validateStep(): boolean {
    if (step === "photo") {
      if (photo.status === "uploading") return setFieldError("Please wait for the upload to finish."), false;
      if (photo.status === "ready" && !consent) return setFieldError("Tick the consent box to use your photo, or remove it."), false;
      return true;
    }
    if (step === "review") return true;
    if (!v[step]) {
      setFieldError(`Please choose ${step === "mood" ? "a mood" : step === "occasion" ? "an occasion" : step === "style" ? "a style" : step === "weather" ? "the weather" : "a budget"}.`);
      return false;
    }
    return true;
  }

  async function generate() {
    const payload = {
      ...v,
      imagePath: photo.status === "ready" ? photo.path : null,
      imageConsent: photo.status === "ready" && consent,
    };
    const parsed = generateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete every step.");
      return;
    }
    setPhase("generating");
    setError(undefined);
    try {
      const res = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.requestId) {
        router.push(`/generate/${json.requestId}`);
        router.refresh();
        return;
      }
      if (json?.error?.code === "limit_reached") {
        setPhase("limit");
        return;
      }
      setError(json?.error?.message ?? "Something went wrong. Please try again — no credit was used.");
      setPhase("form");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again — no credit was used.");
      setPhase("form");
    }
  }

  const next = () => {
    if (!validateStep()) return;
    if (step === "review") void generate();
    else go(index + 1);
  };

  if (phase === "limit") return <LimitReached credits={credits} />;
  if (phase === "generating") return <GeneratingScreen hasPhoto={photo.status === "ready"} />;

  const set = (k: keyof Values) => (val: string | string[] | null) => {
    setV((prev) => ({ ...prev, [k]: val as string }));
    setFieldError(undefined);
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {index + 1} of {STEPS.length}</span>
        <span data-testid="credits-left">
          {credits.remaining} of {credits.limit} generations left {credits.period === "day" ? "today" : "this month"}
        </span>
      </div>
      <div className="mt-3 grid h-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }} aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= index ? "rounded-full bg-foreground" : "rounded-full bg-border"} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.form
          key={step}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          noValidate
          className="mt-10"
        >
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl leading-tight outline-none sm:text-5xl">
            {META[step].title}
          </h1>
          <p className="mt-2 text-muted-foreground">{META[step].subtitle}</p>
          {error && <Alert variant="error" className="mt-6">{error}</Alert>}

          <div className="mt-8">
            {step === "photo" && (
              <PhotoStep
                photo={photo}
                setPhoto={setPhoto}
                consent={consent}
                setConsent={(c) => {
                  setConsent(c);
                  setFieldError(undefined);
                }}
                consentError={fieldError}
              />
            )}
            {step === "mood" && (
              <ChoiceGroup
                name="mood" legend="Mood" variant="card" columns="grid-cols-2 sm:grid-cols-5"
                options={MOODS.map((m) => ({ value: m.value, label: `${m.emoji}  ${m.label}`, hint: m.hint }))}
                value={v.mood} onChange={set("mood")} error={fieldError}
              />
            )}
            {step === "occasion" && (
              <ChoiceGroup name="occasion" legend="Occasion" variant="card" columns="grid-cols-2 sm:grid-cols-5"
                options={GEN_OCCASIONS} value={v.occasion} onChange={set("occasion")} error={fieldError} />
            )}
            {step === "style" && (
              <ChoiceGroup name="style" legend="Style" variant="card" columns="grid-cols-2 sm:grid-cols-3"
                options={GEN_STYLES} value={v.style} onChange={set("style")} error={fieldError} />
            )}
            {step === "weather" && (
              <ChoiceGroup name="weather" legend="Weather" variant="card" columns="grid-cols-2 sm:grid-cols-4"
                options={WEATHER} value={v.weather} onChange={set("weather")} error={fieldError} />
            )}
            {step === "budget" && (
              <ChoiceGroup name="budget" legend="Budget" variant="card" columns="grid-cols-1 sm:grid-cols-2"
                options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))} value={v.budget} onChange={set("budget")} error={fieldError} />
            )}
            {step === "review" && (
              <Card className="divide-y divide-border">
                {([
                  ["Photo", photo.status === "ready" ? "Included (with your consent)" : "No photo", 0],
                  ["Mood", labelOf(MOODS, v.mood), 1],
                  ["Occasion", labelOf(GEN_OCCASIONS, v.occasion), 2],
                  ["Style", labelOf(GEN_STYLES, v.style), 3],
                  ["Weather", labelOf(WEATHER, v.weather), 4],
                  ["Budget", labelOf(BUDGETS, v.budget), 5],
                ] as const).map(([label, value, i]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-medium">{value}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => go(i)} aria-label={`Change ${label.toLowerCase()}`}>
                      Change
                    </Button>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {step !== "photo" && step !== "mood" && fieldError && step === "review" && (
            <p className="mt-3 text-[0.8rem] text-danger">{fieldError}</p>
          )}

          <div className="sticky bottom-0 -mx-4 mt-10 flex items-center gap-3 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
            {index > 0 && (
              <Button type="button" variant="ghost" onClick={() => go(index - 1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            )}
            <div className="ml-auto">
              {step === "review" ? (
                <Button type="submit" size="lg">
                  <WandSparkles aria-hidden /> Generate My Perfect Outfit
                </Button>
              ) : (
                <Button type="submit">
                  {step === "photo" && photo.status !== "ready" ? "Skip photo" : "Continue"} <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </motion.form>
      </AnimatePresence>
    </div>
  );
}

export function LimitReached({ credits }: { credits: WizardCredits }) {
  const reset = credits.resetsAt
    ? new Intl.DateTimeFormat("en-IN", {
        ...(credits.period === "day" ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short" }),
        timeZone: "Asia/Kolkata",
      }).format(new Date(credits.resetsAt))
    : null;
  return (
    <div className="py-10 text-center" data-testid="limit-reached">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-beige">
        <Sparkles aria-hidden className="size-6" />
      </span>
      <h1 className="mt-6 font-display text-4xl sm:text-5xl">You&apos;ve used today&apos;s looks</h1>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        You&apos;ve used all {credits.limit} outfit generations {credits.period === "day" ? "for today" : "this month"}.
        {reset && <> They refresh {credits.period === "day" ? `at ${reset} IST` : `on ${reset}`}.</>}
      </p>
      <Card className="mx-auto mt-8 max-w-md p-6 text-left">
        <p className="font-medium">Upgrade for more looks</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Basic (₹99/month) gives 30 generations, Pro (₹199) gives 100.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/billing">See plans</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
