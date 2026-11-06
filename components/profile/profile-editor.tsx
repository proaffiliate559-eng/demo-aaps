"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  BasicFields, BudgetField, ColoursField, FitFields, OccasionsField, StylesField,
} from "@/components/profile/profile-fields";
import { updateProfileSection } from "@/lib/profile/actions";
import { stepSchemas, type FashionProfile, type OnboardingStep } from "@/lib/validations/profile";
import type { FieldErrors } from "@/lib/validations/auth";

const SECTIONS: { key: OnboardingStep; title: string; description: string }[] = [
  { key: "basic", title: "About you", description: "Name, styling preference and language." },
  { key: "styles", title: "Style", description: "The styles your looks lean towards." },
  { key: "colours", title: "Colours", description: "Palettes we build around." },
  { key: "budget", title: "Budget", description: "Typical spend for a complete outfit." },
  { key: "occasions", title: "Occasions", description: "Moments you dress for most." },
  { key: "fit", title: "Fit & comfort", description: "Optional. Never inferred from photos." },
];

function SectionCard<K extends OnboardingStep>({
  section,
  initial,
}: {
  section: (typeof SECTIONS)[number] & { key: K };
  initial: FashionProfile[K];
}) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: "saved" | "error"; msg?: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const parsed = stepSchemas[section.key].safeParse(value);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
      setErrors(fe);
      return;
    }
    start(async () => {
      const res = await updateProfileSection(section.key, value);
      if (res.ok) {
        setStatus({ kind: "saved" });
        setDirty(false);
      } else {
        setErrors(res.fieldErrors ?? {});
        setStatus({ kind: "error", msg: res.message ?? "Please fix the highlighted fields." });
      }
    });
  };

  const props = {
    value,
    onChange: (v: FashionProfile[K]) => {
      setValue(v);
      setErrors({});
      setDirty(true);
      setStatus(null);
    },
    errors,
  };

  return (
    <Card className="p-6 sm:p-8" id={section.key}>
      <form onSubmit={save} noValidate aria-labelledby={`${section.key}-title`}>
        <div className="mb-6">
          <h2 id={`${section.key}-title`} className="font-display text-3xl">{section.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
        </div>
        {section.key === "basic" && <BasicFields {...(props as unknown as React.ComponentProps<typeof BasicFields>)} />}
        {section.key === "styles" && <StylesField {...(props as unknown as React.ComponentProps<typeof StylesField>)} />}
        {section.key === "colours" && <ColoursField {...(props as unknown as React.ComponentProps<typeof ColoursField>)} />}
        {section.key === "budget" && <BudgetField {...(props as unknown as React.ComponentProps<typeof BudgetField>)} />}
        {section.key === "occasions" && <OccasionsField {...(props as unknown as React.ComponentProps<typeof OccasionsField>)} />}
        {section.key === "fit" && <FitFields {...(props as unknown as React.ComponentProps<typeof FitFields>)} />}
        {status?.kind === "error" && <Alert variant="error" className="mt-6">{status.msg}</Alert>}
        <div className="mt-8 flex items-center justify-end gap-3">
          {status?.kind === "saved" && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
              <Check aria-hidden className="size-4" /> Saved
            </span>
          )}
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <><Loader2 aria-hidden className="animate-spin" /> Saving…</> : `Save ${section.title.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfileEditor({ initial }: { initial: FashionProfile }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[12rem_1fr]">
      <nav aria-label="Profile sections" className="hidden lg:block">
        <ul className="sticky top-8 space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <a href={`#${s.key}`} className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <SectionCard key={s.key} section={s} initial={initial[s.key]} />
        ))}
      </div>
    </div>
  );
}
