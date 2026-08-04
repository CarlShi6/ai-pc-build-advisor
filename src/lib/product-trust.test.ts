import { describe, expect, it } from "vitest";
import { seedParts, recommendedBuildPartIds } from "@/data/seedParts";
import { createSeedBuild, estimateBuildPower, getValidatedOfficialUrl, getValidatedPurchaseUrl, replaceBuildPartLocally, trustedAvailability, trustedPartPrice } from "@/lib/product-trust";

const buildParts = Object.values(recommendedBuildPartIds).filter(Boolean).map((id) => seedParts.find((part) => part.id === id)!).filter(Boolean);

describe("product trust workspace helpers", () => {
  it("replaces a canonical same-category part and recalculates the build", () => {
    const build = createSeedBuild(buildParts);
    const current = build.parts.find((part) => part.category === "gpu")!;
    const replacement = seedParts.find((part) => part.id === "gpu-rtx-4070-super")!;
    const next = replaceBuildPartLocally(build, current.id, replacement);
    expect(next.parts.find((part) => part.category === "gpu")?.id).toBe(replacement.id);
    expect(next.totalPrice).toBe(build.totalPrice - current.price + replacement.price);
    expect(next.compatibilityChecks.length).toBeGreaterThan(0);
  });

  it("keeps the build stable when a cross-category replacement is attempted", () => {
    const build = createSeedBuild(buildParts);
    const current = build.parts.find((part) => part.category === "gpu")!;
    const cpu = seedParts.find((part) => part.category === "cpu")!;
    expect(() => replaceBuildPartLocally(build, current.id, cpu)).toThrow(/category/i);
    expect(build.parts.find((part) => part.category === "gpu")?.id).toBe(current.id);
  });

  it("reports truthful fallbacks for invalid price, stock, and links", () => {
    const incomplete = { ...seedParts[0], price: Number.NaN, availability: "unknown" as const, purchaseUrl: "javascript:alert(1)", affiliateLinks: [], productUrl: "https://example.com/fake" };
    expect(trustedPartPrice(incomplete).value).toBeNull();
    expect(trustedAvailability(incomplete).value).toBe("unknown");
    expect(getValidatedPurchaseUrl(incomplete)).toBeNull();
    expect(getValidatedOfficialUrl(incomplete)).toBeNull();
  });

  it("derives power only when supported inputs exist", () => {
    expect(estimateBuildPower(createSeedBuild(buildParts)).value).toBeTypeOf("number");
    expect(estimateBuildPower(createSeedBuild(buildParts.filter((part) => part.category !== "gpu"))).value).toBeNull();
  });
});
