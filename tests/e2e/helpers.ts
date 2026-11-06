import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Poll Mailpit for the newest email to `to` and return the first auth link in it. */
export async function getEmailLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const data = (await res.json()) as { messages: { ID: string }[] };
    if (data.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${data.messages[0].ID}`)).json();
      const body: string = msg.HTML || msg.Text;
      const match = body.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]*/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No auth email for ${to}`);
}

export async function signUp(page: Page, opts: { name: string; email: string; password: string }) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password", { exact: true }).fill(opts.password);
  await page.getByLabel("Confirm password").fill(opts.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
}

export async function logIn(page: Page, email: string, password: string, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Create a confirmed user directly via the Admin API (skips email). */
export async function createConfirmedUser(tag: string, name = "Test User") {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const email = uniqueEmail(tag);
  const password = "Linen2026!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  return { id: data.user.id, email, password, admin };
}

/** Walk through all six onboarding steps with typical answers. */
export async function completeOnboarding(page: Page, opts: { skipFit?: boolean } = {}) {
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Let's get to know you" })).toBeVisible();
  await page.getByText("Womenswear").click();
  await page.getByLabel("Age group (optional)").selectOption("25_34");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Your style, in a few words" })).toBeVisible();
  await page.getByText("Minimalist", { exact: true }).click();
  await page.getByText("Smart casual", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Colours you love wearing" })).toBeVisible();
  await page.getByText("Beige", { exact: true }).click();
  await page.getByLabel("Other colour").fill("Maroon");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What's your usual budget?" })).toBeVisible();
  await page.getByText("₹1,000–₹2,000").click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Where are you dressing for?" })).toBeVisible();
  await page.getByText("Office", { exact: true }).click();
  await page.getByText("Festival", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Fit & comfort" })).toBeVisible();
  if (opts.skipFit) {
    await page.getByRole("button", { name: "Skip for now" }).click();
  } else {
    await page.getByText("Relaxed", { exact: true }).click();
    await page.getByLabel("Top").selectOption("M");
    await page.getByText("More coverage").click();
    await page.getByRole("button", { name: "Finish" }).click();
  }
  await expect(page).toHaveURL(/\/dashboard\?welcome=1/);
}
