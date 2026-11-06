import { describe, expect, it } from "vitest";
import { isAuthOnlyPath, isProtectedPath, sanitizeRedirect } from "@/lib/auth/routes";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/dashboard/x", "/admin", "/generate", "/onboarding", "/settings/account"])("protects %s", (p) =>
    expect(isProtectedPath(p)).toBe(true),
  );
  it.each(["/", "/login", "/privacy", "/dashboards", "/administrator", "/auth/callback"])("does not protect %s", (p) =>
    expect(isProtectedPath(p)).toBe(false),
  );
});

describe("isAuthOnlyPath", () => {
  it("matches auth pages but not reset-password", () => {
    expect(isAuthOnlyPath("/login")).toBe(true);
    expect(isAuthOnlyPath("/signup")).toBe(true);
    expect(isAuthOnlyPath("/reset-password")).toBe(false);
  });
});

describe("sanitizeRedirect", () => {
  it("keeps safe relative paths with query and hash", () => {
    expect(sanitizeRedirect("/generate?mood=happy#top")).toBe("/generate?mood=happy#top");
  });
  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/\u0000x",
    "",
    null,
    undefined,
  ])("rejects %s", (t) => expect(sanitizeRedirect(t as string)).toBe("/dashboard"));
  it("uses the provided fallback", () => expect(sanitizeRedirect("//x", "/onboarding")).toBe("/onboarding"));
});
