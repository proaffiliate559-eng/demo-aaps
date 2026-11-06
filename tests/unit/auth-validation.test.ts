import { describe, expect, it } from "vitest";
import { loginSchema, resetPasswordSchema, signupSchema, toFieldErrors } from "@/lib/validations/auth";
import { scorePassword } from "@/lib/auth/password-strength";

const valid = {
  displayName: "Aanya Sharma",
  email: "  Aanya@Example.COM ",
  password: "linen2024",
  confirmPassword: "linen2024",
  acceptTerms: "on",
};

describe("signupSchema", () => {
  it("accepts valid input and normalises email", () => {
    const r = signupSchema.parse(valid);
    expect(r.email).toBe("aanya@example.com");
  });
  it("accepts Devanagari names", () => {
    expect(signupSchema.safeParse({ ...valid, displayName: "आन्या शर्मा" }).success).toBe(true);
  });
  it("rejects mismatched passwords on confirmPassword", () => {
    const r = signupSchema.safeParse({ ...valid, confirmPassword: "different1" });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).confirmPassword).toMatch(/do not match/);
  });
  it("requires terms acceptance", () => {
    const r = signupSchema.safeParse({ ...valid, acceptTerms: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).acceptTerms).toBeTruthy();
  });
  it.each(["short1", "allletters", "12345678"])("rejects weak password %s", (pw) => {
    expect(signupSchema.safeParse({ ...valid, password: pw, confirmPassword: pw }).success).toBe(false);
  });
  it("rejects markup in names", () => {
    expect(signupSchema.safeParse({ ...valid, displayName: "<script>" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).email).toMatch(/valid email/);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    expect(resetPasswordSchema.safeParse({ password: "newpass99", confirmPassword: "newpass99" }).success).toBe(true);
  });
});

describe("scorePassword", () => {
  it("scores stronger passwords higher", () => {
    expect(scorePassword("abcdefgh")).toBeLessThan(scorePassword("Abcdefgh12!long"));
  });
});
