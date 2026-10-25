import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { expandedParts } from "@/data/expandedParts";
import { createSeedBuild, replaceBuildPartLocally } from "@/lib/product-trust";
import { createPriceChartPresentation } from "@/lib/price-trend";
import type { PriceObservation } from "@/types/pricing";

it("keeps new entries unique, searchable, conservative about stock and benchmark claims", () => {
  expect(new Set(seedParts.map((part) => part.id)).size).toBe(seedParts.length);
  for (const part of expandedParts) {
    const entry = seedParts.find((candidate) => candidate.id === part.id)!;
    expect(entry.searchUrl).toContain(encodeURIComponent(`${part.brand} ${part.model}`));
    expect(entry.availability).toBe("unknown");
    expect(entry.affiliateLinks?.[0].inStock).toBe(false);
    expect(entry.specs.priceBasis).toContain("Planning estimate");
    expect(entry.performanceScore).toBeUndefined();
    expect(entry.specs.gaming1440pScore).toBeUndefined();
  }
});
it("requires BIOS review for Ryzen 9000 and detects wrong socket replacements", () => {
  const cpu = seedParts.find((part) => part.id === "cpu-r7-9800x3d")!;
  const board = seedParts.find((part) => part.id === "mobo-b650-tomahawk")!;
  const build = createSeedBuild([cpu, board]);
  expect(build.compatibilityChecks.find((check) => check.id === "cpu-bios-support")?.severity).toBe("warning");
  const next = replaceBuildPartLocally(build, board.id, seedParts.find((part) => part.id === "mobo-z790-hero")!);
  expect(next.compatibilityStatus).toBe("fail");
});

describe("price line identity", () => {
  const observation = (id: string, retailerId: string, retailerSku?: string, condition: PriceObservation["condition"] = "new"): PriceObservation => ({
    id, partId: "gpu", retailerId, retailerName: retailerId, retailerSku, currency: "USD", itemPriceMinor: 50000, shippingPriceMinor: 0, effectivePreTaxPriceMinor: 50000, availability: "in_stock", condition, sourceType: "mock", observedAt: `2026-10-2${id}T00:00:00Z`,
  });
  it("connects only identical retailer, seller, listing and condition", () => {
    const chart = createPriceChartPresentation([observation("1", "a", "sku"), observation("2", "b", "sku"), observation("3", "a", "sku"), observation("4", "a", "sku", "used")]);
    expect(chart.series.map((series) => series.points.length).sort()).toEqual([1, 1, 2]);
  });
  it("does not invent a shared identity when SKU and listing URL are missing", () => {
    const chart = createPriceChartPresentation([observation("1", "a"), observation("2", "a")]);
    expect(chart.series).toHaveLength(2);
  });
});
