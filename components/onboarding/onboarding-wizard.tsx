"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  BasicFields, BudgetField, ColoursField, FitFields, OccasionsField, StylesField,
} from "@/components/profile/profile-fields";
import { completeOnboarding, saveOnboardingStep } from "@/lib/profile/actions";
import { ONBOARDING_STEPS, stepSchemas, type FashionProfile, type OnboardingStep } from "@/lib/validations/profile";
import type { FieldErrors } from "@/lib/validations/auth";

const META: Record<OnboardingStep, { title: string; subtitle: string; optional?: boolean }> = {
  basic: { title: "Let's get to know you", subtitle: "A few basics so your stylist speaks your language." },
  styles: { title: "Your style, in a few words", subtitle: "Your recommendations will lean towards these." },
  colours: { title: "Colours you love wearing", subtitle: "We'll build palettes around your favourites." },
  budget: { title: "What's your usual budget?", subtitle: "Estimates are shown in ₹ for a complete outfit." },
  occasions: { title: "Where are you dressing for?", subtitle: "We'll prioritise looks for these moments." },
  fit: {
    title: "Fit & comfort",
    subtitle: "Optional — skip anything you'd rather not share. We never guess these from photos.",
    optional: true,
  },
};

function flat(error: import("zod").ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) {
    const k = i.path.join(".") || "form";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export function OnboardingWizard({ initial }: { initial: FashionProfile }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [data, setData] = useState<FashionProfile>(initial);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = ONBOARDING_STEPS[index];
  const meta = META[step];
  const isLast = index === ONBOARDING_STEPS.length - 1;

  const goTo = (i: number) => {
    setErrors({});
    setMessage(undefined);
    setIndex(i);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const finish = async () => {
    const res = await completeOnboarding();
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    router.replace("/dashboard?welcome=1");
    router.refresh();
  };

  const next = (skip = false) => {
    setMessage(undefined);
    if (!skip) {
      const parsed = stepSchemas[step].safeParse(data[step]);
      if (!parsed.success) {
        setErrors(flat(parsed.error));
        return;
      }
    }
    startTransition(async () => {
      if (!skip) {
        const res = await saveOnboardingStep(step, data[step]);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          setMessage(res.message);
          return;
        }
      }
      if (isLast) await finish();
      else goTo(index + 1);
    });
  };

  const sectionProps = <K extends OnboardingStep>(k: K) => ({
    value: data[k],
    onChange: (v: FashionProfile[K]) => {
      setData((d) => ({ ...d, [k]: v }));
      setErrors({});
    },
    errors,
  });

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {index + 1} of {ONBOARDING_STEPS.length}
          {meta.optional && " · Optional"}
        </span>
        <span>{Math.round(((index + 1) / ONBOARDING_STEPS.length) * 100)}%</span>
      </div>
      <div
        className="mt-3 grid h-1 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, 1fr)` }}
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_STEPS.length}
        aria-valuenow={index + 1}
      >
        {ONBOARDING_STEPS.map((s, i) => (
          <span key={s} className={i <= index ? "rounded-full bg-foreground" : "rounded-full bg-border"} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.form
          key={step}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          noValidate
          className="mt-10"
        >
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl leading-tight outline-none sm:text-5xl">
            {meta.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{meta.subtitle}</p>

          {message && <Alert variant="error" className="mt-6">{message}</Alert>}

          <div className="mt-8">
            {step === "basic" && <BasicFields {...sectionProps("basic")} />}
            {step === "styles" && <StylesField {...sectionProps("styles")} />}
            {step === "colours" && <ColoursField {...sectionProps("colours")} />}
            {step === "budget" && <BudgetField {...sectionProps("budget")} />}
            {step === "occasions" && <OccasionsField {...sectionProps("occasions")} />}
            {step === "fit" && <FitFields {...sectionProps("fit")} />}
          </div>

          <div className="sticky bottom-0 -mx-4 mt-10 flex items-center gap-3 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
            {index > 0 && (
              <Button type="button" variant="ghost" onClick={() => goTo(index - 1)} disabled={pending}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {meta.optional && (
                <Button type="button" variant="outline" onClick={() => next(true)} disabled={pending}>
                  Skip for now
                </Button>
              )}
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Saving…
                  </>
                ) : isLast ? (
                  <>Finish <ArrowRight aria-hidden /></>
                ) : (
                  <>Continue <ArrowRight aria-hidden /></>
                )}
              </Button>
            </div>
          </div>
        </motion.form>
      </AnimatePresence>
    </div>
  );
}
