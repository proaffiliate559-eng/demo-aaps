/**
 * Admin + payments E2E. The test server runs with fake Razorpay credentials:
 *   RAZORPAY_KEY_ID=rzp_test_e2e RAZORPAY_KEY_SECRET=e2e_key_secret RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret
 * so signatures can be produced here. No real payments are made.
 */
import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, createConfirmedUser, logIn } from "./helpers";

const KEY_SECRET = "e2e_key_secret";
const WEBHOOK_SECRET = "e2e_webhook_secret";
const uid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const hmac = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");

async function onboardedUser(page: Page, tag: string, name = "Phase Five") {
  const u = await createConfirmedUser(tag, name);
  await logIn(page, u.email, u.password);
  await completeOnboarding(page, { skipFit: true });
  return u;
}

async function makeOrder(u: Awaited<ReturnType<typeof createConfirmedUser>>, slug = "pro") {
  const { data: plan } = await u.admin.from("plans").select("id, price").eq("slug", slug).single();
  const orderId = `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await u.admin.from("payments").insert({ user_id: u.id, plan_id: plan!.id, razorpay_order_id: orderId, amount_paise: plan!.price * 100 });
  return orderId;
}

test.describe("Journey 7: admin", () => {
  test("non-admins get 404; admins see live statistics and can manage users", async ({ page, browser }) => {
    // A regular user with some activity.
    const userPage = await browser.newPage({ baseURL: "http://localhost:3000" });
    const member = await onboardedUser(userPage, "member", "Meera Member");
    await userPage.goto("/generate?mood=adventurous");
    await userPage.getByRole("button", { name: "Continue" }).click();
    await userPage.getByText("Travel", { exact: true }).click();
    for (let i = 0; i < 4; i++) {
      if (i === 1) await userPage.getByText("Casual", { exact: true }).click();
      if (i === 2) await userPage.getByText("Hot", { exact: true }).click();
      await userPage.getByRole("button", { name: "Continue" }).click();
    }
    await userPage.getByRole("button", { name: "Generate My Perfect Outfit" }).click();
    await expect(userPage).toHaveURL(/\/generate\/[0-9a-f-]{36}$/);
    // The user reports a look.
    await userPage.getByTestId("look-bold").getByRole("button", { name: "Report a problem" }).click();
    await userPage.getByLabel("What's wrong with this look?").fill("Too revealing for a family trip");
    await userPage.getByRole("button", { name: "Send report" }).click();
    await expect(userPage.getByText("our team will review")).toBeVisible();

    // Admin candidate is a normal user first → 404, no admin link.
    const adm = await onboardedUser(page, "admin", "Ada Admin");
    expect((await page.goto("/admin"))?.status()).toBe(404);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    // A user can't make themselves admin.
    expect((await page.request.post("/api/payments/verify", { data: {} })).status()).toBe(400);

    await adm.admin.from("user_roles").insert({ user_id: adm.id, role: "admin" });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Admin" }).first().click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // Stats match the database.
    const { data: ov } = await adm.admin.rpc("admin_overview");
    const o = ov as Record<string, number>;
    await expect(page.getByTestId("stat-total-users").locator("[data-value]")).toHaveText(String(o.total_users));
    await expect(page.getByTestId("stat-generations").locator("[data-value]")).toHaveText(String(o.generations_total));
    await expect(page.getByRole("region", { name: "Most popular moods" })).toContainText("Adventurous");
    await expect(page.getByRole("region", { name: "Most popular occasions" })).toContainText("Travel");
    await expect(page.getByTestId("ai-usage-table")).toContainText("outfit generation");

    // Users: search → detail → grant plan → suspend.
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Users" }).click();
    await page.getByLabel("Search users").fill(member.email);
    await page.getByLabel("Search users").press("Enter");
    await page.getByRole("link", { name: "Meera Member" }).click();
    await expect(page.getByRole("heading", { name: "Meera Member" })).toBeVisible();
    await page.getByLabel("Plan to grant").selectOption("basic");
    await page.getByLabel("Days").fill("14");
    await page.getByRole("button", { name: "Grant plan" }).click();
    await expect(page.getByText("Granted basic for 14 days.")).toBeVisible();
    await userPage.goto("/dashboard");
    await expect(userPage.getByTestId("credits-card")).toContainText("Basic plan");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Suspend account" }).click();
    await expect(page.getByText("User suspended.")).toBeVisible();
    const fresh = await browser.newPage({ baseURL: "http://localhost:3000" });
    await logIn(fresh, member.email, member.password);
    await expect(fresh.getByRole("alert").filter({ hasText: /.+/ })).toBeVisible();
    await expect(fresh).toHaveURL(/\/login/);
    await fresh.close();

    // Audit trail recorded.
    const { data: audit } = await adm.admin.from("admin_audit_log").select("action").eq("target_user_id", member.id);
    expect(audit!.map((a) => a.action).sort()).toEqual(["plan.grant", "user.suspend"]);

    // Admin can't suspend themselves (button disabled on own page).
    await page.goto(`/admin/users/${adm.id}`);
    await expect(page.getByRole("button", { name: "Suspend account" })).toBeDisabled();

    // Reports.
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Reports" }).click();
    const report = page.getByTestId("report").filter({ hasText: "Too revealing for a family trip" });
    await expect(report).toBeVisible();
    await report.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByTestId("report").filter({ hasText: "Too revealing" })).toHaveCount(0, { timeout: 10000 });
    await userPage.close();
  });

  test("feature switches and plan edits take effect immediately", async ({ page, browser }) => {
    const adm = await onboardedUser(page, "admin2", "Ada Two");
    await adm.admin.from("user_roles").insert({ user_id: adm.id, role: "admin" });
    const userPage = await browser.newPage({ baseURL: "http://localhost:3000" });
    await onboardedUser(userPage, "flags", "Flag User");

    try {
      await page.goto("/admin/plans");
      await page.getByRole("checkbox", { name: "AI stylist chat", exact: true }).uncheck();
      await page.getByLabel("Free daily generation limit").fill("5");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved.")).toBeVisible();

      await userPage.goto("/dashboard");
      await expect(userPage.getByRole("complementary").getByRole("link", { name: "AI Stylist" })).toHaveCount(0);
      expect((await userPage.goto("/stylist"))?.status()).toBe(404);
      expect((await userPage.request.post("/api/chat", { data: { message: "hi" } })).status()).toBe(503);
      await userPage.goto("/dashboard");
      await expect(userPage.getByTestId("credits-card")).toContainText("of 5 left today");

      const pro = page.getByTestId("plan-editor-pro");
      await pro.getByLabel("pro price").fill("249");
      await pro.getByRole("button", { name: "Save plan" }).click();
      await expect(pro.getByText("Plan saved.")).toBeVisible();
      await userPage.goto("/");
      await expect(userPage.locator("#pricing")).toContainText("₹249");

      // Validation: paid plans can't be free; free can't be priced.
      await pro.getByLabel("pro price").fill("0");
      await pro.getByRole("button", { name: "Save plan" }).click();
      await expect(pro.getByText("Paid plans need a price above ₹0.")).toBeVisible();
    } finally {
      // Restore global settings for other tests.
      await adm.admin.from("app_settings").upsert([
        { key: "free_daily_generation_limit", value: 3 },
        { key: "features", value: { image_generation: false, stylist_chat: true, wardrobe: true } },
      ]);
      await adm.admin.from("plans").update({ price: 199 }).eq("slug", "pro");
      await userPage.close();
    }
  });

  test("admin APIs/actions are not reachable by regular users", async ({ page }) => {
    await onboardedUser(page, "notadmin");
    for (const path of ["/admin", "/admin/users", "/admin/plans", "/admin/reports"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });
});

test.describe("Subscriptions & payments", () => {
  test("billing page; checkout success is only trusted after server-side signature verification", async ({ page }) => {
    const u = await onboardedUser(page, "buyer");
    await page.getByRole("complementary").getByRole("link", { name: "Plans & Billing" }).click();
    await expect(page.getByTestId("current-plan")).toContainText("Free");
    await expect(page.getByTestId("plan-pro").getByRole("button", { name: "Get Pro" })).toBeEnabled();

    // Fake keys → Razorpay rejects order creation → honest error, nothing granted.
    await page.getByTestId("plan-pro").getByRole("button", { name: "Get Pro" }).click();
    await expect(page.getByTestId("plan-pro").getByRole("alert")).toContainText(/payment provider|Razorpay/i);

    const orderId = await makeOrder(u, "pro");
    // Forged signature → rejected.
    const forged = await page.request.post("/api/payments/verify", {
      data: { razorpay_order_id: orderId, razorpay_payment_id: "pay_fake", razorpay_signature: "deadbeef" },
    });
    expect(forged.status()).toBe(400);
    const { count: none } = await u.admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(none).toBe(0);

    // Valid signature → plan activated (twice is harmless).
    const payId = uid("pay");
    const body = { razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: hmac(`${orderId}|${payId}`, KEY_SECRET) };
    expect((await page.request.post("/api/payments/verify", { data: body })).status()).toBe(200);
    expect((await page.request.post("/api/payments/verify", { data: body })).status()).toBe(200);
    const { data: subs } = await u.admin.from("subscriptions").select("status").eq("user_id", u.id);
    expect(subs).toEqual([{ status: "active" }]);

    await page.reload();
    await expect(page.getByTestId("current-plan")).toContainText("Pro");
    await expect(page.getByTestId("current-plan")).toContainText("Active until");
    await expect(page.getByTestId("plan-pro").getByRole("button", { name: "Current plan" })).toBeDisabled();
    await expect(page.getByRole("table")).toContainText("Paid");
    await page.goto("/dashboard");
    await expect(page.getByTestId("credits-card")).toContainText("of 100 left this month");
  });

  test("users can't verify someone else's order or cancel a paid one", async ({ page, browser }) => {
    const owner = await createConfirmedUser("owner");
    const orderId = await makeOrder(owner, "basic");
    await onboardedUser(page, "thief");
    const res = await page.request.post("/api/payments/verify", {
      data: { razorpay_order_id: orderId, razorpay_payment_id: "pay_x", razorpay_signature: hmac(`${orderId}|pay_x`, KEY_SECRET) },
    });
    expect(res.status()).toBe(404);
    await owner.admin.rpc("fulfil_payment", { p_order_id: orderId, p_payment_id: uid("pay") });
    const ownerPage = await browser.newPage({ baseURL: "http://localhost:3000" });
    await logIn(ownerPage, owner.email, owner.password);
    await ownerPage.request.post("/api/payments/cancel", { data: { orderId, reason: "dismissed" } });
    const { data } = await owner.admin.from("payments").select("status").eq("razorpay_order_id", orderId).single();
    expect(data?.status).toBe("paid");
    await ownerPage.close();
  });

  test("webhook: signature verified, idempotent, handles failures", async ({ request }) => {
    const u = await createConfirmedUser("hook");
    const orderId = await makeOrder(u, "premium");
    const send = (event: string, payment: Record<string, string>, eventId: string, secret = WEBHOOK_SECRET) => {
      const raw = JSON.stringify({ event, payload: { payment: { entity: payment } } });
      return request.post("/api/payments/webhook", {
        data: raw,
        headers: { "content-type": "application/json", "x-razorpay-signature": hmac(raw, secret), "x-razorpay-event-id": eventId },
      });
    };

    expect((await send("payment.captured", { id: "pay_w1", order_id: orderId }, `evt_${randomUUID()}`, "wrong-secret")).status()).toBe(400);
    const { count: before } = await u.admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(before).toBe(0);

    const eventId = `evt_${randomUUID()}`;
    const payId = uid("pay");
    const ok = await send("payment.captured", { id: payId, order_id: orderId }, eventId);
    expect(ok.status()).toBe(200);
    const dup = await send("payment.captured", { id: payId, order_id: orderId }, eventId);
    expect(await dup.json()).toMatchObject({ duplicate: true });
    const { data: subs } = await u.admin.from("subscriptions").select("status, plans(slug)").eq("user_id", u.id);
    expect(subs).toEqual([{ status: "active", plans: { slug: "premium" } }]);

    // A failed payment on a different order is recorded, and never grants anything.
    const failedOrder = await makeOrder(u, "basic");
    await send("payment.failed", { id: uid("pay"), order_id: failedOrder, error_description: "Card declined" }, `evt_${randomUUID()}`);
    const { data: pf } = await u.admin.from("payments").select("status, failure_reason").eq("razorpay_order_id", failedOrder).single();
    expect(pf).toEqual({ status: "failed", failure_reason: "Card declined" });
  });
});
