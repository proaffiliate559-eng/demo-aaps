import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { completeOnboarding, createConfirmedUser, logIn } from "./helpers";

async function onboardedUser(page: Page, tag: string) {
  const u = await createConfirmedUser(tag, "Phase Four");
  await logIn(page, u.email, u.password);
  await completeOnboarding(page, { skipFit: true });
  return u;
}

async function generateOnce(page: Page, mood: string, occasion: string, style: string) {
  await page.goto("/generate");
  await page.getByRole("button", { name: "Skip photo" }).click();
  await page.getByText(mood, { exact: false }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(occasion, { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(style, { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Pleasant", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Generate My Perfect Outfit" }).click();
  await expect(page).toHaveURL(/\/generate\/[0-9a-f-]{36}$/);
}

test.describe("Journey 3: saved looks", () => {
  test("save → saved page → filter → remove", async ({ page }) => {
    await onboardedUser(page, "saved");
    await page.goto("/saved");
    await expect(page.getByText("No saved looks yet")).toBeVisible();

    await generateOnce(page, "Happy", "College", "Casual");
    await page.getByTestId("look-safe").getByRole("button", { name: /^Save / }).click();
    await page.getByTestId("look-bold").getByRole("button", { name: /^Save / }).click();
    await expect(page.getByTestId("look-bold").getByRole("button", { name: /Remove/ })).toBeVisible();
    await generateOnce(page, "Elegant", "Wedding", "Traditional");
    await page.getByTestId("look-trendy").getByRole("button", { name: /^Save / }).click();
    await expect(page.getByTestId("look-trendy").getByRole("button", { name: /Remove/ })).toBeVisible();

    await page.getByRole("complementary").getByRole("link", { name: "Saved Looks" }).click();
    const list = page.getByRole("list", { name: "Saved looks" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("3 of 10 saved on the Free plan.")).toBeVisible();
    await expect(list).toContainText("Generated");

    await page.getByLabel("Occasion", { exact: true }).selectOption("wedding");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/occasion=wedding/);
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await page.getByLabel("Style", { exact: true }).selectOption("formal");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("No looks match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).first().click();
    await expect(list.getByRole("listitem")).toHaveCount(3);

    // View opens the original results.
    await list.getByRole("listitem").first().getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/generate\/[0-9a-f-]{36}$/);
    await page.goBack();

    await list.getByRole("listitem").first().getByRole("button", { name: /Remove .* from saved looks/ }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await page.reload();
    await expect(list.getByRole("listitem")).toHaveCount(2);
  });
});

test.describe("Journey 4: wardrobe", () => {
  test("add with photo → search/filter → edit (replace photo) → delete, with storage cleanup", async ({ page }) => {
    const u = await onboardedUser(page, "wardrobe");
    await page.getByRole("complementary").getByRole("link", { name: "My Wardrobe" }).click();
    await expect(page.getByText("Your wardrobe is empty")).toBeVisible();

    // Validation.
    await page.getByRole("link", { name: "Add your first item" }).click();
    await page.getByRole("button", { name: "Add to wardrobe" }).click();
    await expect(page.getByText("Give this item a name")).toBeVisible();
    await expect(page.getByText("Choose a category")).toBeVisible();

    const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#1f2f52" } }).jpeg().toBuffer();
    await page.getByTestId("wardrobe-photo-input").setInputFiles({ name: "jeans.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
    await page.getByLabel("Name").fill("Black slim jeans");
    await page.getByLabel("Category").selectOption("jeans");
    await page.getByLabel("Colour").fill("Black");
    await page.getByLabel("Brand (optional)").fill("Levi's");
    await page.getByLabel("Season").selectOption("all");
    await page.getByRole("button", { name: "Add to wardrobe" }).click();
    await expect(page.getByText("Item added to your wardrobe.")).toBeVisible();

    // Second item without photo.
    await page.getByRole("link", { name: "Add item" }).click();
    await page.getByLabel("Name").fill("White linen shirt");
    await page.getByLabel("Category").selectOption("shirts");
    await page.getByLabel("Colour").fill("White");
    await page.getByRole("button", { name: "Add to wardrobe" }).click();

    const grid = page.getByRole("list", { name: "Wardrobe items" });
    await expect(grid.getByRole("listitem")).toHaveCount(2);
    await page.getByRole("link", { name: /Jeans 1/ }).click();
    await expect(grid.getByRole("listitem")).toHaveCount(1);
    await page.goto("/wardrobe");
    await page.getByLabel("Search wardrobe").fill("linen");
    await page.getByLabel("Search wardrobe").press("Enter");
    await expect(grid.getByRole("listitem")).toHaveCount(1);
    await expect(grid).toContainText("White linen shirt");
    await page.getByLabel("Search wardrobe").fill("%_");
    await page.getByLabel("Search wardrobe").press("Enter");
    await expect(page.getByText("No matching items")).toBeVisible();

    // Details → edit with a replacement photo.
    await page.goto("/wardrobe");
    await grid.getByRole("link", { name: /Black slim jeans/ }).click();
    await expect(page.getByRole("heading", { name: "Black slim jeans" })).toBeVisible();
    await expect(page.getByText("Levi's")).toBeVisible();
    const before = (await u.admin.storage.from("user-uploads").list(`${u.id}/wardrobe`)).data!.map((f) => f.name);
    expect(before).toHaveLength(1);

    await page.getByRole("link", { name: "Edit" }).click();
    const photo2 = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#333333" } }).png().toBuffer();
    await page.getByTestId("wardrobe-photo-input").setInputFiles({ name: "new.png", mimeType: "image/png", buffer: photo2 });
    await expect(page.getByRole("status", { name: "Uploading" })).toBeHidden();
    await page.getByLabel("Name").fill("Black skinny jeans");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Black skinny jeans" })).toBeVisible();
    const after = (await u.admin.storage.from("user-uploads").list(`${u.id}/wardrobe`)).data!.map((f) => f.name);
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before[0]);

    // Delete with confirmation removes the row and the photo.
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByText("Item deleted.")).toBeVisible();
    await expect(grid.getByRole("listitem")).toHaveCount(1);
    await expect.poll(async () => (await u.admin.storage.from("user-uploads").list(`${u.id}/wardrobe`)).data?.length).toBe(0);
  });

  test("other users' items are not accessible", async ({ page, browser }) => {
    await onboardedUser(page, "wown");
    await page.goto("/wardrobe/new");
    await page.getByLabel("Name").fill("Private kurta");
    await page.getByLabel("Category").selectOption("traditional");
    await page.getByRole("button", { name: "Add to wardrobe" }).click();
    await page.getByRole("link", { name: /Private kurta/ }).click();
    await page.waitForURL(/\/wardrobe\/[0-9a-f-]{36}$/);
    const url = page.url();
    const other = await browser.newPage({ baseURL: "http://localhost:3000" });
    await onboardedUser(other, "wintruder");
    expect((await other.goto(url))?.status()).toBe(404);
    expect((await other.goto(`${url}/edit`))?.status()).toBe(404);
    await other.close();
  });
});

test.describe("Journey 5: AI stylist chat", () => {
  test("ask → reply with suggestions → follow-up → history → delete", async ({ page }) => {
    await onboardedUser(page, "chat");
    await page.getByRole("complementary").getByRole("link", { name: "AI Stylist" }).click();
    await expect(page.getByRole("heading", { name: /what are we dressing for/ })).toBeVisible();

    await page.getByRole("button", { name: "What should I wear for a college party?" }).click();
    const log = page.getByRole("log", { name: "Conversation" });
    await expect(log.locator("[data-role=user]")).toHaveText("What should I wear for a college party?");
    await expect(log.locator("[data-role=assistant]")).toContainText("Development mock — not AI");
    await expect(page).toHaveURL(/\/stylist\?c=[0-9a-f-]{36}$/);

    // One-tap generation link carries the suggested parameters.
    await expect(page.getByRole("link", { name: "Create 3 full looks for this" })).toHaveAttribute("href", /\/generate\?mood=relaxed&occasion=party&style=streetwear/);

    // Follow-up via suggestion chip.
    await page.getByRole("button", { name: "What shoes would go with that?" }).click();
    await expect(log.locator("[data-role=assistant]")).toHaveCount(2);

    // Typed message with Enter.
    await page.getByLabel("Message your stylist").fill("I only have black jeans");
    await page.getByLabel("Message your stylist").press("Enter");
    await expect(log.locator("[data-role=user]")).toHaveCount(3);
    await expect(log.locator("[data-role=assistant]")).toHaveCount(3);
    await expect(page.getByLabel("Message your stylist")).toHaveValue("");

    // History persists across reloads and shows in the list.
    await page.reload();
    await expect(log.locator("[data-role=assistant]")).toHaveCount(3);
    await expect(page.getByRole("complementary").last().getByRole("link", { name: "What should I wear for a college party?" })).toBeVisible();

    // New conversation, then delete the first one.
    await page.getByRole("link", { name: "New conversation" }).first().click();
    await expect(page).toHaveURL(/\/stylist$/);
    await page.getByRole("link", { name: "What should I wear for a college party?" }).first().click();
    await page.getByRole("button", { name: /Delete conversation/ }).first().click();
    await expect(page).toHaveURL(/\/stylist$/);
    await expect(page.getByText("No conversations yet.").first()).toBeAttached();
  });

  test("failed replies can be retried; empty and over-long messages are rejected", async ({ page }) => {
    await onboardedUser(page, "chatfail");
    await page.goto("/stylist");
    await page.route("**/api/chat", (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Our AI stylist is temporarily unavailable." } }) }),
    );
    await page.getByLabel("Message your stylist").fill("Help with a wedding outfit");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "temporarily unavailable" })).toBeVisible();
    await expect(page.locator("[data-role=user]")).toHaveCount(0); // not shown as sent
    await page.unroute("**/api/chat");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("[data-role=assistant]")).toHaveCount(1);

    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
    const res = await page.request.post("/api/chat", { data: { message: "x".repeat(1001) } });
    expect(res.status()).toBe(400);
    const res2 = await page.request.post("/api/chat", { data: { message: "hi", conversationId: "00000000-0000-0000-0000-000000000000" } });
    expect(res2.status()).toBe(400);
  });

  test("chat requires sign-in and is limited per day", async ({ page, request }) => {
    expect((await request.post("/api/chat", { data: { message: "hi" } })).status()).toBe(401);
    const u = await onboardedUser(page, "chatlimit");
    await u.admin.from("ai_usage").insert(Array.from({ length: 40 }, () => ({ user_id: u.id, provider: "t", feature: "chat" as const, status: "success" as const })));
    const res = await page.request.post("/api/chat", { data: { message: "hi" } });
    expect(res.status()).toBe(402);
    expect((await res.json()).error.message).toContain("today's chat limit");
  });
});

test.describe("Account deletion cleans nested storage", () => {
  test("style and wardrobe photos are removed", async ({ page }) => {
    const u = await onboardedUser(page, "delfiles");
    const jpg = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#aaaaaa" } }).jpeg().toBuffer();
    await page.goto("/generate");
    await page.getByTestId("photo-input").setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: jpg });
    await expect(page.getByText("Uploaded privately")).toBeVisible();
    await page.goto("/wardrobe/new");
    await page.getByTestId("wardrobe-photo-input").setInputFiles({ name: "x.jpg", mimeType: "image/jpeg", buffer: jpg });
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
    await page.getByLabel("Name").fill("Tee");
    await page.getByLabel("Category").selectOption("t_shirts");
    await page.getByRole("button", { name: "Add to wardrobe" }).click();
    await expect(page.getByText("Item added")).toBeVisible();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete my account…" }).click();
    await page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(page).toHaveURL(/account=deleted/);
    for (const folder of ["style", "wardrobe"]) {
      const { data } = await u.admin.storage.from("user-uploads").list(`${u.id}/${folder}`);
      expect(data ?? []).toHaveLength(0);
    }
  });
});
