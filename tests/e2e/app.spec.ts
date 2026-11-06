import { expect, test } from "@playwright/test";
import { completeOnboarding, createConfirmedUser, logIn } from "./helpers";

test.describe("Onboarding", () => {
  test("validates required steps, supports Back, persists progress and can skip the optional step", async ({ page }) => {
    const u = await createConfirmedUser("onb", "Priya Nair");
    await logIn(page, u.email, u.password);
    // Not onboarded → the app bounces dashboard to onboarding.
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/onboarding$/);

    // Required styling preference.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose a styling preference")).toBeVisible();
    await page.getByText("Menswear", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Required styles.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Pick at least one style")).toBeVisible();
    await page.getByText("Streetwear", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Colours you love wearing" })).toBeVisible();

    // Back keeps selections.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("checkbox", { name: "Streetwear" })).toBeChecked();

    // Saved progress survives a reload (page restarts at step 1 with data prefilled).
    await page.reload();
    await expect(page.getByRole("radio", { name: "Menswear", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("checkbox", { name: "Streetwear" })).toBeChecked();

    // Finish the flow from the start helper, skipping the optional step.
    await page.reload();
    await completeOnboarding(page, { skipFit: true });

    // Onboarding page now redirects away.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("Dashboard", () => {
  test("shows real profile data, credits and empty states", async ({ page }) => {
    const u = await createConfirmedUser("dash", "Kabir Singh");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kabir Singh");
    const summary = page.getByTestId("style-summary");
    await expect(summary).toContainText("Minimalist, Smart casual");
    await expect(summary).toContainText("Beige, Maroon");
    await expect(summary).toContainText("₹1,000–₹2,000");
    await expect(summary).toContainText("Office, Festival");

    await expect(page.getByTestId("credits-remaining")).toHaveText("3");
    await expect(page.getByTestId("credits-card")).toContainText("of 3 left today");
    await expect(page.getByText("No recommendations yet")).toBeVisible();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();

    // Every navigation item is a working link.
    const sidebar = page.getByRole("complementary");
    for (const name of ["Home", "Generate Outfit", "My Wardrobe", "Saved Looks", "AI Stylist", "Fashion Profile", "Settings"]) {
      await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(sidebar.getByText("Soon")).toHaveCount(0);
    // The mood selector opens the generator with that mood preselected.
    await page.getByRole("link", { name: /Confident/ }).click();
    await expect(page).toHaveURL(/\/generate\?mood=confident/);
    await expect(page.getByRole("heading", { name: "How are you feeling today?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Confident/ })).toBeChecked();
  });

  test("credits reflect recorded usage", async ({ page }) => {
    const u = await createConfirmedUser("usage", "Meera Iyer");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page, { skipFit: true });
    await u.admin.from("ai_usage").insert([
      { user_id: u.id, provider: "test", feature: "outfit_generation", status: "success" },
      { user_id: u.id, provider: "test", feature: "outfit_generation", status: "error" },
    ]);
    await page.goto("/dashboard");
    await expect(page.getByTestId("credits-remaining")).toHaveText("2");
  });
});

test.describe("Fashion profile", () => {
  test("edits persist and update the dashboard", async ({ page }) => {
    const u = await createConfirmedUser("prof", "Arjun Rao");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page);

    await page.getByRole("complementary").getByRole("link", { name: "Fashion Profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    const budget = page.locator("#budget");
    await expect(budget.getByRole("button", { name: "Save budget" })).toBeDisabled();
    await budget.getByText("Above ₹5,000").click();
    await budget.getByRole("button", { name: "Save budget" }).click();
    await expect(budget.getByRole("status")).toHaveText("Saved");

    const styles = page.locator("#styles");
    await styles.getByText("Minimalist", { exact: true }).click();
    await styles.getByText("Smart casual", { exact: true }).click();
    await styles.getByRole("button", { name: "Save style" }).click();
    await expect(styles.getByText("Pick at least one style")).toBeVisible();
    await styles.getByText("Luxury", { exact: true }).click();
    await styles.getByRole("button", { name: "Save style" }).click();
    await expect(styles.getByRole("status")).toHaveText("Saved");

    await page.reload();
    await expect(page.locator("#budget").getByRole("radio", { name: "Above ₹5,000" })).toBeChecked();
    await page.goto("/dashboard");
    await expect(page.getByTestId("style-summary")).toContainText("Above ₹5,000");
    await expect(page.getByTestId("style-summary")).toContainText("Luxury");
  });
});

test.describe("Settings", () => {
  test("change password from settings", async ({ page }) => {
    const u = await createConfirmedUser("pw", "Neha Gupta");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page, { skipFit: true });
    await page.goto("/settings");
    await page.getByLabel("New password", { exact: true }).fill("Saree2026!new");
    await page.getByLabel("Confirm new password").fill("Saree2026!new");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/dashboard\?password=updated/);
    await expect(page.getByText("Your password has been updated.")).toBeVisible();
  });

  test("delete account removes everything and signs out", async ({ page }) => {
    const u = await createConfirmedUser("del", "Delete Me");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page, { skipFit: true });
    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    const confirmBtn = page.getByRole("button", { name: "Permanently delete account" });
    await expect(confirmBtn).toBeDisabled();
    await page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
    await confirmBtn.click();
    await expect(page).toHaveURL(/\/\?account=deleted/);
    await expect(page.getByText("permanently deleted")).toBeVisible();

    const { data } = await u.admin.from("profiles").select("id").eq("id", u.id);
    expect(data).toEqual([]);
    await logIn(page, u.email, u.password);
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveText("Incorrect email or password.");
  });
});
