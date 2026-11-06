import { expect, test } from "@playwright/test";
import { completeOnboarding, createConfirmedUser, logIn } from "./helpers";

test("mobile: onboarding and app menu work without horizontal scroll", async ({ page }) => {
  const u = await createConfirmedUser("mob", "Isha Das");
  await logIn(page, u.email, u.password);
  await completeOnboarding(page, { skipFit: true });
  for (const path of ["/dashboard", "/profile", "/settings", "/onboarding", "/generate", "/wardrobe", "/wardrobe/new", "/saved", "/stylist"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("dialog")).toBeHidden();
});
