"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/lib/auth/actions";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useClientValidation } from "@/components/forms/use-client-validation";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initial: AuthFormState = { status: "idle" };

export function ForgotPasswordForm({ disabled }: { disabled?: boolean }) {
  const [state, action] = useActionState(requestPasswordReset, initial);
  const { errors, onSubmit, clearError } = useClientValidation(forgotPasswordSchema, (fd) => ({
    email: fd.get("email"),
  }));
  const fe = { ...state.fieldErrors, ...errors };

  if (state.status === "success") return <Alert variant="success">{state.message}</Alert>;

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <FormField id="email" label="Email" error={fe.email}>
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.values?.email}
          onChange={() => clearError("email")}
          required
        />
      </FormField>
      <SubmitButton className="w-full" size="lg" pendingText="Sending link…" disabled={disabled}>
        Send reset link
      </SubmitButton>
    </form>
  );
}
