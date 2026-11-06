"use client";

import { useState } from "react";
import type { z } from "@/lib/zod";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

/**
 * Validates the form with the same Zod schema the server uses, before submit.
 * The server re-validates everything — this is only for faster feedback.
 */
export function useClientValidation<S extends z.ZodType>(schema: S, pick: (fd: FormData) => unknown) {
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = schema.safeParse(pick(new FormData(e.currentTarget)));
    if (!result.success) {
      e.preventDefault();
      const fe = toFieldErrors(result.error);
      setErrors(fe);
      const first = Object.keys(fe)[0];
      if (first) e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    } else {
      setErrors({});
    }
  }

  function clearError(name: string) {
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  return { errors, onSubmit, clearError };
}
