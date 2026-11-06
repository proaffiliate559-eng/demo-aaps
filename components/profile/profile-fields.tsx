"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ChoiceGroup } from "@/components/profile/choice-group";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AGE_GROUPS, BUDGETS, COLOURS, FITS, GENDER_PREFERENCES, HEIGHT_RANGES, LANGUAGES, MODESTY, OCCASIONS,
  SHOE_SIZES_UK, STYLES, TOP_SIZES, WAIST_SIZES,
} from "@/lib/config/options";
import type { FieldErrors } from "@/lib/validations/auth";
import type { FashionProfile } from "@/lib/validations/profile";

type Section<K extends keyof FashionProfile> = {
  value: FashionProfile[K];
  onChange: (v: FashionProfile[K]) => void;
  errors: FieldErrors;
};

export function BasicFields({ value, onChange, errors }: Section<"basic">) {
  const set = (patch: Partial<FashionProfile["basic"]>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <FormField id="displayName" label="What should we call you?" error={errors.displayName}>
        <Input
          name="displayName"
          autoComplete="given-name"
          value={value.displayName ?? ""}
          onChange={(e) => set({ displayName: e.target.value })}
        />
      </FormField>
      <ChoiceGroup
        name="genderPreference"
        legend="Styling preference"
        description="Which clothing should we recommend? You can change this any time."
        options={GENDER_PREFERENCES}
        value={value.genderPreference ?? null}
        onChange={(v) => set({ genderPreference: v as FashionProfile["basic"]["genderPreference"] })}
        error={errors.genderPreference}
        variant="card"
        columns="grid-cols-2"
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="ageGroup" label="Age group (optional)" error={errors.ageGroup}>
          <NativeSelect
            name="ageGroup"
            value={value.ageGroup ?? ""}
            onChange={(e) => set({ ageGroup: (e.target.value || null) as FashionProfile["basic"]["ageGroup"] })}
          >
            <option value="">Prefer not to say</option>
            {AGE_GROUPS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="country" label="Country" error={errors.country}>
          <Input
            name="country"
            autoComplete="country-name"
            value={value.country ?? ""}
            onChange={(e) => set({ country: e.target.value })}
          />
        </FormField>
      </div>
      <ChoiceGroup
        name="language"
        legend="Preferred language"
        options={LANGUAGES}
        value={value.language ?? "en"}
        onChange={(v) => set({ language: v as FashionProfile["basic"]["language"] })}
        error={errors.language}
        variant="card"
        columns="grid-cols-1 sm:grid-cols-2"
      />
    </div>
  );
}

export function StylesField({ value, onChange, errors }: Section<"styles">) {
  return (
    <ChoiceGroup
      name="styles"
      legend="Which styles feel like you?"
      description="Pick as many as you like."
      options={STYLES}
      multiple
      value={value.styles ?? []}
      onChange={(v) => onChange({ styles: v as FashionProfile["styles"]["styles"] })}
      error={errors.styles}
      variant="card"
      columns="grid-cols-2 sm:grid-cols-4"
    />
  );
}

export function ColoursField({ value, onChange, errors }: Section<"colours">) {
  const [draft, setDraft] = useState("");
  const custom = value.customColours ?? [];
  const addCustom = () => {
    const c = draft.trim();
    if (!c || custom.length >= 3 || custom.some((x) => x.toLowerCase() === c.toLowerCase())) return;
    onChange({ ...value, customColours: [...custom, c] });
    setDraft("");
  };
  return (
    <div className="space-y-6">
      <ChoiceGroup
        name="colours"
        legend="Favourite colours to wear"
        description="Pick as many as you like."
        options={COLOURS}
        multiple
        swatches
        value={value.colours ?? []}
        onChange={(v) => onChange({ ...value, colours: v as FashionProfile["colours"]["colours"] })}
        error={errors.colours}
        variant="card"
        columns="grid-cols-2 sm:grid-cols-4"
      />
      <div>
        <p className="text-sm font-medium">Other colours (optional, up to 3)</p>
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="Other colour"
            placeholder="e.g. Maroon, Mustard"
            value={draft}
            maxLength={24}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            disabled={custom.length >= 3}
          />
          <Button type="button" variant="outline" onClick={addCustom} disabled={!draft.trim() || custom.length >= 3} className="h-12">
            <Plus aria-hidden /> Add
          </Button>
        </div>
        {Object.entries(errors).find(([k]) => k.startsWith("customColours"))?.[1] && (
          <p className="mt-2 text-[0.8rem] text-danger">
            {Object.entries(errors).find(([k]) => k.startsWith("customColours"))?.[1]}
          </p>
        )}
        {custom.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {custom.map((c) => (
              <li key={c} className="inline-flex items-center gap-1 rounded-full bg-beige py-1.5 pl-4 pr-1.5 text-sm">
                {c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() => onChange({ ...value, customColours: custom.filter((x) => x !== c) })}
                  className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-beige-strong/60"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BudgetField({ value, onChange, errors }: Section<"budget">) {
  return (
    <ChoiceGroup
      name="budget"
      legend="Usual budget for a complete outfit"
      description="We'll keep recommendations around this range."
      options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))}
      value={value.budget ?? null}
      onChange={(v) => onChange({ budget: v as string })}
      error={errors.budget}
      variant="card"
      columns="grid-cols-1 sm:grid-cols-2"
    />
  );
}

export function OccasionsField({ value, onChange, errors }: Section<"occasions">) {
  return (
    <ChoiceGroup
      name="occasions"
      legend="What do you usually dress for?"
      description="Pick as many as you like."
      options={OCCASIONS}
      multiple
      value={value.occasions ?? []}
      onChange={(v) => onChange({ occasions: v as FashionProfile["occasions"]["occasions"] })}
      error={errors.occasions}
      variant="card"
      columns="grid-cols-2 sm:grid-cols-4"
    />
  );
}

export function FitFields({ value, onChange, errors }: Section<"fit">) {
  const sizes = value.sizes ?? { top: null, waist: null, shoeUk: null };
  const set = (patch: Partial<FashionProfile["fit"]>) => onChange({ ...value, ...patch });
  const setSize = (k: keyof typeof sizes, v: string) => set({ sizes: { ...sizes, [k]: v || null } as typeof sizes });
  return (
    <div className="space-y-7">
      <ChoiceGroup
        name="preferredFit"
        legend="Preferred fit"
        options={FITS}
        value={value.preferredFit ?? null}
        onChange={(v) => set({ preferredFit: v as FashionProfile["fit"]["preferredFit"] })}
        error={errors.preferredFit}
      />
      <fieldset>
        <legend className="text-sm font-medium">Clothing sizes</legend>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <FormField id="size-top" label="Top" className="[&_label]:text-xs [&_label]:text-muted-foreground">
            <NativeSelect value={sizes.top ?? ""} onChange={(e) => setSize("top", e.target.value)}>
              <option value="">—</option>
              {TOP_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="size-waist" label="Waist (in)" className="[&_label]:text-xs [&_label]:text-muted-foreground">
            <NativeSelect value={sizes.waist ?? ""} onChange={(e) => setSize("waist", e.target.value)}>
              <option value="">—</option>
              {WAIST_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="size-shoe" label="Shoe (UK)" className="[&_label]:text-xs [&_label]:text-muted-foreground">
            <NativeSelect value={sizes.shoeUk ?? ""} onChange={(e) => setSize("shoeUk", e.target.value)}>
              <option value="">—</option>
              {SHOE_SIZES_UK.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </FormField>
        </div>
      </fieldset>
      <FormField id="heightRange" label="Height range" error={errors.heightRange}>
        <NativeSelect
          value={value.heightRange ?? ""}
          onChange={(e) => set({ heightRange: (e.target.value || null) as FashionProfile["fit"]["heightRange"] })}
        >
          <option value="">Prefer not to say</option>
          {HEIGHT_RANGES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
        </NativeSelect>
      </FormField>
      <ChoiceGroup
        name="modesty"
        legend="Coverage preference"
        description="Helps us respect your comfort with necklines, hemlines and sleeves."
        options={MODESTY}
        value={value.modesty ?? null}
        onChange={(v) => set({ modesty: v as FashionProfile["fit"]["modesty"] })}
        error={errors.modesty}
        variant="card"
        columns="grid-cols-1 sm:grid-cols-2"
      />
    </div>
  );
}
