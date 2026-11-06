import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";

describe("i18n", () => {
  it("Hindi overrides translated keys and falls back to English", () => {
    const hi = getDictionary("hi");
    expect(hi.nav.login).toBe("लॉगिन");
    expect(hi.nav.pricing).toBe("Pricing");
    expect(hi.howItWorks.steps).toHaveLength(4);
  });
});
