"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useClientValidation } from "@/components/forms/use-client-validation";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initial: AuthFormState = { status: "idle" };

export function LoginForm({ next, disabled }: { next?: string; disabled?: boolean }) {
  const [state, action] = useActionState(signIn, initial);
  const { errors, onSubmit, clearError } = useClientValidation(loginSchema, (fd) => ({
    email: fd.get("email"),
    password: fd.get("password"),
  }));
  const fe = { ...state.fieldErrors, ...errors };

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.message && <Alert variant="error">{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
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
      <FormField
        id="password"
        label="Password"
        error={fe.password}
        labelAside={
          <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput name="password" autoComplete="current-password" onChange={() => clearError("password")} required />
      </FormField>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…" disabled={disabled}>
        Sign in
      </SubmitButton>
    </form>
  );
}
