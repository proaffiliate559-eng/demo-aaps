"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WardrobeImageField } from "@/components/wardrobe/wardrobe-image-field";
import { SEASONS, WARDROBE_CATEGORIES } from "@/lib/config/options";
import type { WardrobeFormState } from "@/lib/wardrobe/actions";

type Item = {
  name: string;
  category: string;
  colour: string | null;
  brand: string | null;
  season: string | null;
  notes: string | null;
  image_path: string | null;
  imageUrl: string | null;
};

export function WardrobeForm({
  action,
  item,
  submitLabel,
  cancelHref,
}: {
  action: (prev: WardrobeFormState, fd: FormData) => Promise<WardrobeFormState>;
  item?: Item;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [uploading, setUploading] = useState(false);
  const fe = state.fieldErrors ?? {};
  return (
    <form
      // Submit manually so React doesn't reset the fields when the server returns errors.
      onSubmit={(e) => {
        e.preventDefault();
        if (uploading) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-6"
      noValidate
    >
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <WardrobeImageField initialPath={item?.image_path ?? null} initialUrl={item?.imageUrl ?? null} onBusyChange={setUploading} />
      <FormField id="name" label="Name" error={fe.name}>
        <Input name="name" defaultValue={item?.name} placeholder="e.g. White linen shirt" maxLength={80} required />
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="category" label="Category" error={fe.category}>
          <NativeSelect name="category" defaultValue={item?.category ?? ""} required>
            <option value="" disabled>Choose…</option>
            {WARDROBE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="colour" label="Colour" error={fe.colour}>
          <Input name="colour" defaultValue={item?.colour ?? ""} placeholder="e.g. Navy" maxLength={30} />
        </FormField>
        <FormField id="brand" label="Brand (optional)" error={fe.brand}>
          <Input name="brand" defaultValue={item?.brand ?? ""} placeholder="e.g. Fabindia" maxLength={60} />
        </FormField>
        <FormField id="season" label="Season" error={fe.season}>
          <NativeSelect name="season" defaultValue={item?.season ?? ""}>
            <option value="">Not specified</option>
            {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes (optional)</label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={item?.notes ?? ""}
          maxLength={500}
          rows={3}
          placeholder="Fit, fabric, what it pairs well with…"
          aria-invalid={fe.notes ? true : undefined}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[0.95rem] focus-visible:border-foreground focus-visible:outline-none"
        />
        {fe.notes && <p className="text-[0.8rem] text-danger">{fe.notes}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || uploading} aria-busy={pending}>
          {uploading ? "Waiting for photo…" : pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
