import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, createConfirmedUser, logIn } from "./helpers";

/** Collect CSP violations and uncaught errors while visiting pages. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("Content Security Policy", () => {
  test("every response carries a nonce-based CSP that differs per request", async ({ request }) => {
    const a = (await request.get("/")).headers()["content-security-policy"];
    const b = (await request.get("/")).headers()["content-security-policy"];
    expect(a).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(a).toContain("frame-ancestors 'none'");
    expect(a).not.toBe(b);
    const login = await request.get("/signup");
    expect(login.headers()["content-security-policy"]).toContain("'nonce-");
  });

  test("public and app pages work under the CSP with no violations", async ({ page }) => {
    const problems = watch(page);
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/privacy", "/does-not-exist"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // Interactivity proves scripts executed (hydration).
    await page.goto("/login");
    await page.getByLabel("Password", { exact: true }).fill("x");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");

    const u = await createConfirmedUser("csp", "Csp User");
    await u.admin.from("user_roles").insert({ user_id: u.id, role: "admin" });
    await logIn(page, u.email, u.password);
    await completeOnboarding(page, { skipFit: true });
    for (const path of ["/dashboard", "/generate", "/wardrobe", "/wardrobe/new", "/saved", "/stylist", "/profile", "/billing", "/settings", "/admin", "/admin/users", "/admin/plans"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // Scripts injected by our own code (Razorpay pattern) are allowed via strict-dynamic.
    const injected = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const s = document.createElement("script");
          s.src = "data:text/javascript,window.__dyn=1";
          s.onload = () => resolve(true);
          s.onerror = () => resolve(false);
          document.body.appendChild(s);
        }),
    );
    expect(typeof injected).toBe("boolean");
    expect(problems.filter((p) => !p.includes("data:text/javascript"))).toEqual([]);
  });

  test("inline scripts without the nonce are blocked", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/");
    const ran = await page.evaluate(() => {
      const s = document.createElement("div");
      s.innerHTML = `<img src="x" onerror="window.__xss=1">`;
      document.body.appendChild(s);
      return new Promise((r) => setTimeout(() => r((window as unknown as { __xss?: number }).__xss ?? 0), 300));
    });
    expect(ran).toBe(0);
    expect(problems.some((p) => /Content Security Policy|Refused/i.test(p))).toBe(true);
  });
});

test.describe("Accessibility (axe-core, WCAG 2.1 AA)", () => {
  async function audit(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // Scroll through so scroll-revealed content is visible and gets checked too.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.emulateMedia({ reducedMotion: "reduce" }); // final, fully-visible state
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${path}: ${v.id} (${v.impact}) — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
  }

  test("public pages have no serious or critical violations", async ({ page }) => {
    const found: string[] = [];
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/privacy"]) found.push(...(await audit(page, path)));
    expect(found).toEqual([]);
  });

  test("app pages have no serious or critical violations", async ({ page }) => {
    const u = await createConfirmedUser("a11y", "Ally User");
    await logIn(page, u.email, u.password);
    await completeOnboarding(page, { skipFit: true });
    const found: string[] = [];
    for (const path of ["/dashboard", "/generate", "/wardrobe", "/wardrobe/new", "/saved", "/stylist", "/profile", "/billing", "/settings"]) {
      found.push(...(await audit(page, path)));
    }
    expect(found).toEqual([]);
  });
});

test.describe("Operational endpoints", () => {
  test("health check reports configuration without leaking secrets", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", database: "ok", serviceRole: true });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/eyJ|secret|AQ\.|rzp_test_e2e/);
  });

  test("robots.txt keeps private areas out of search engines; sitemap lists public pages", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const p of ["/admin", "/dashboard", "/api/"]) expect(robots).toContain(`Disallow: ${p}`);
    expect(robots).toContain("Sitemap:");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/privacy");
    expect(sitemap).not.toContain("/dashboard");
  });
});
