"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { sanitizeRedirect } from "@/lib/auth/routes";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validations/auth";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echo non-secret values back so the form keeps them after a server error. */
  values?: Record<string, string>;
};

const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message: "Authentication is not configured yet. Add your Supabase keys to .env.local.",
};

async function getOrigin() {
  if (publicEnv.siteUrl) return publicEnv.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** Map Supabase auth errors to friendly, non-enumerating copy. */
function friendlyAuthError(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email first — check your inbox for the link.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "weak_password":
      return "That password is too weak. Try a longer one with letters and numbers.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "user_already_exists":
    case "email_exists":
      // Treated as success upstream to avoid revealing registered emails.
      return "";
    default:
      return fallback;
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = { email: str(formData, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      status: "error",
      message: friendlyAuthError(error.code, "We couldn't sign you in. Please try again."),
      values,
    };
  }
  redirect(sanitizeRedirect(str(formData, "next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = { displayName: str(formData, "displayName"), email: str(formData, "email") };
  const parsed = signupSchema.safeParse({
    ...values,
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
    acceptTerms: str(formData, "acceptTerms"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: { display_name: parsed.data.displayName },
    },
  });

  // A per-address email cooldown only triggers for addresses that already
  // signed up, so reporting it would reveal registered emails. Respond neutrally.
  if (error && error.code !== "over_email_send_rate_limit") {
    const msg = friendlyAuthError(error.code, "We couldn't create your account. Please try again.");
    if (msg) return { status: "error", message: msg, values };
  }

  // Email confirmation disabled → session exists → go straight to onboarding.
  if (data?.session) redirect("/onboarding");

  return {
    status: "success",
    message: `If ${parsed.data.email} can be registered, we've sent a confirmation link to it. Open it to finish creating your account.`,
  };
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = { email: str(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { status: "error", message: friendlyAuthError(error.code, ""), values };
  }
  // Same response whether or not the account exists (no user enumeration).
  return {
    status: "success",
    message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour.",
  };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse({
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      message: "Your reset link has expired or was already used. Request a new one.",
    };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      status: "error",
      message: friendlyAuthError(error.code, "We couldn't update your password. Please try again."),
    };
  }
  redirect("/dashboard?password=updated");
}

export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured() || !publicEnv.googleAuthEnabled) redirect("/login?error=google_unavailable");
  const origin = await getOrigin();
  const next = sanitizeRedirect(str(formData, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google_failed");
  redirect(data.url);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login?signed_out=1");
}
