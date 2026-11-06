import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/security/csp";

describe("buildCsp", () => {
  const csp = buildCsp("abc123", { supabaseUrl: "https://proj.supabase.co/rest", dev: false, https: true });
  it("uses a nonce + strict-dynamic and no unsafe script sources in production", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it("blocks framing, plugins and base-tag hijacking", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("allows Supabase (origin only) and Razorpay checkout", () => {
    expect(csp).toContain("img-src 'self' data: blob: https://proj.supabase.co");
    expect(csp).toContain("frame-src https://api.razorpay.com");
  });
  it("adds unsafe-eval only in development", () => {
    expect(buildCsp("n", { supabaseUrl: "", dev: true, https: false })).toContain("'unsafe-eval'");
  });
});
