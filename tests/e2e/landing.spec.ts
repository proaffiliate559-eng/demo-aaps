import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders all sections with working CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your Personal AI Stylist");
    for (const id of ["how-it-works", "features", "examples", "pricing", "faq"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.getByText("₹99")).toBeVisible();
    await expect(page.getByText(/Illustrative example/)).toBeVisible();

    await page.getByRole("link", { name: "Generate My Outfit" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("FAQ items expand", async ({ page }) => {
    await page.goto("/#faq");
    const trigger = page.getByRole("button", { name: "Do I have to upload a photo?" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Photos are optional/)).toBeVisible();
  });

  test("has no horizontal overflow", async ({ page }) => {
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/privacy"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("navigation works (mobile menu on small screens)", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("link", { name: "Pricing" }).click();
      await expect(dialog).toBeHidden();
    } else {
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Pricing" }).click();
    }
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.locator("#pricing")).toBeInViewport();
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("unknown routes show the branded 404", async ({ page }) => {
    const res = await page.goto("/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This look isn't in our collection")).toBeVisible();
  });
});
