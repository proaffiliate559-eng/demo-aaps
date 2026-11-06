"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { signupSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useClientValidation } from "@/components/forms/use-client-validation";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initial: AuthFormState = { status: "idle" };

export function SignupForm({ disabled }: { disabled?: boolean }) {
  const [state, action] = useActionState(signUp, initial);
  const [password, setPassword] = useState("");
  const { errors, onSubmit, clearError } = useClientValidation(signupSchema, (fd) => ({
    displayName: fd.get("displayName"),
    email: fd.get("email"),
    password: fd.get("password"),
    confirmPassword: fd.get("confirmPassword"),
    acceptTerms: fd.get("acceptTerms") ?? undefined,
  }));
  const fe = { ...state.fieldErrors, ...errors };

  if (state.status === "success") {
    return (
      <div className="rounded-[1.25rem] border border-border bg-surface p-6 text-center" role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <MailCheck aria-hidden className="size-5" />
        </span>
        <h2 className="mt-4 font-display text-3xl">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.message && <Alert variant="error">{state.message}</Alert>}
      <FormField id="displayName" label="Your name" error={fe.displayName}>
        <Input
          name="displayName"
          autoComplete="name"
          placeholder="Aanya Sharma"
          defaultValue={state.values?.displayName}
          onChange={() => clearError("displayName")}
          required
        />
      </FormField>
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
      <FormField id="password" label="Password" error={fe.password}>
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
      <FormField id="confirmPassword" label="Confirm password" error={fe.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" onChange={() => clearError("confirmPassword")} required />
      </FormField>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            name="acceptTerms"
            aria-invalid={fe.acceptTerms ? true : undefined}
            aria-describedby={fe.acceptTerms ? "acceptTerms-error" : undefined}
            onChange={() => clearError("acceptTerms")}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-4">
              Terms
            </Link>{" "}
            and have read the{" "}
            <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4">
              Privacy notice
            </Link>
            , including how optional photos are processed.
          </span>
        </label>
        {fe.acceptTerms && (
          <p id="acceptTerms-error" className="text-[0.8rem] text-danger">
            {fe.acceptTerms}
          </p>
        )}
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Creating your account…" disabled={disabled}>
        Create account
      </SubmitButton>
    </form>
  );
}
