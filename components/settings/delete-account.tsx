"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteAccount } from "@/lib/profile/actions";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action] = useActionState(deleteAccount, null);

  if (!open) {
    return (
      <Button variant="outline" className="border-danger/30 text-danger hover:border-danger hover:bg-danger-soft" onClick={() => setOpen(true)}>
        Delete my account…
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-danger/25 bg-danger-soft/50 p-5">
      <p className="flex items-start gap-2 text-sm leading-relaxed text-danger">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
        This permanently deletes your account, fashion profile, photos, wardrobe, saved looks and chat history. It
        can&apos;t be undone.
      </p>
      {state && !state.ok && state.message && <Alert variant="error">{state.message}</Alert>}
      <FormField id="confirm" label='Type "DELETE" to confirm' error={!state?.ok ? state?.fieldErrors?.confirm : undefined}>
        <Input name="confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          pendingText="Deleting…"
          disabled={confirm !== "DELETE"}
          className="bg-danger text-white hover:bg-danger/90"
        >
          Permanently delete account
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setConfirm(""); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
