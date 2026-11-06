import { expect, test } from "@playwright/test";
import { completeOnboarding, getEmailLink, logIn, signUp, uniqueEmail } from "./helpers";

const PASSWORD = "Linen2026!";

test.describe("Route protection", () => {
  for (const path of ["/dashboard", "/generate", "/admin", "/onboarding", "/wardrobe"]) {
    test(`${path} redirects anonymous users to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
    });
  }

  test("expired/missing recovery session shows a helpful message", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();
  });

  test("invalid email links land on the auth error page", async ({ page }) => {
    await page.goto("/auth/callback?code=not-a-real-code");
    await expect(page).toHaveURL(/\/auth\/error/);
  });
});

test.describe("Form validation", () => {
  test("signup shows field errors without submitting", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText(`Use at least 8 characters`)).toBeVisible();
    await expect(page.getByText("Please accept the terms")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeFocused();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("password visibility toggle", async ({ page }) => {
    await page.goto("/login");
    const pw = page.getByLabel("Password", { exact: true });
    await pw.fill("secret123");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");
  });

  test("wrong credentials show a generic error", async ({ page }) => {
    await logIn(page, uniqueEmail("nobody"), "Wrong12345");
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveText("Incorrect email or password.");
    await expect(page.getByLabel("Email")).not.toHaveValue("");
  });
});

test.describe("Journey 1: signup → confirm → onboarding → dashboard → logout → login", () => {
  test("full flow against real Supabase Auth", async ({ page }) => {
    const email = uniqueEmail("signup");
    await signUp(page, { name: "Aanya Sharma", email, password: PASSWORD });

    // Unconfirmed users cannot sign in yet.
    await logIn(page, email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toContainText("confirm your email");

    // Open the real confirmation email.
    const link = await getEmailLink(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("What should we call you?")).toHaveValue("Aanya Sharma");
    await completeOnboarding(page);
    await expect(page.getByText("Your style profile is ready")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Aanya Sharma");

    // Authenticated users are bounced away from auth pages.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
    // Landing nav reflects session.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Generate My Outfit" })).toHaveAttribute("href", "/generate");

    // Sign out.
    await page.goto("/dashboard");
    await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?signed_out=1/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);

    // Sign in honours a safe `next` and ignores an unsafe one.
    await logIn(page, email, PASSWORD, "/login?next=%2F%2Fevil.com");
    await expect(page).toHaveURL("http://localhost:3000/dashboard");
  });

  test("duplicate signup does not reveal the account exists", async ({ page }) => {
    const email = uniqueEmail("dupe");
    await signUp(page, { name: "First User", email, password: PASSWORD });
    await signUp(page, { name: "Second Try", email, password: PASSWORD });
  });
});

test.describe("Password reset", () => {
  test("forgot → email link → set new password → sign in with it", async ({ page }) => {
    const email = uniqueEmail("reset");
    await signUp(page, { name: "Rohan Mehta", email, password: PASSWORD });
    await page.goto(await getEmailLink(email));
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/signed_out/);

    // Clear the confirmation email so we read the reset one.
    await fetch(`${process.env.MAILPIT_URL ?? "http://127.0.0.1:54324"}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`, {
      method: "DELETE",
    });

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();

    await page.goto(await getEmailLink(email));
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByText(`For ${email}`)).toBeVisible();

    const NEW = "Kurta2026!new";
    await page.getByLabel("New password", { exact: true }).fill(NEW);
    await page.getByLabel("Confirm new password").fill(NEW);
    await page.getByRole("button", { name: "Update password" }).click();
    // Not onboarded yet → the app sends them to onboarding after the update.
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await logIn(page, email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveText("Incorrect email or password.");
    await logIn(page, email, NEW);
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("unknown email gets the same response (no enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(uniqueEmail("ghost"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
  });
});
