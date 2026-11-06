"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updatePassword, type AuthFormState } from "@/lib/auth/actions";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useClientValidation } from "@/components/forms/use-client-validation";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Alert } from "@/components/ui/alert";

const initial: AuthFormState = { status: "idle" };

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  const [password, setPassword] = useState("");
  const { errors, onSubmit, clearError } = useClientValidation(resetPasswordSchema, (fd) => ({
    password: fd.get("password"),
    confirmPassword: fd.get("confirmPassword"),
  }));
  const fe = { ...state.fieldErrors, ...errors };

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.message && (
        <Alert variant="error">
          {state.message}{" "}
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            Request a new link
          </Link>
        </Alert>
      )}
      <FormField id="password" label="New password" error={fe.password}>
        <PasswordInput
          name="password"
          autoComplete="new-password"
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
          required
        />
      </FormField>
      <PasswordStrength password={password} />
      <FormField id="confirmPassword" label="Confirm new password" error={fe.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" onChange={() => clearError("confirmPassword")} required />
      </FormField>
      <SubmitButton className="w-full" size="lg" pendingText="Updating password…">
        Update password
      </SubmitButton>
    </form>
  );
}
