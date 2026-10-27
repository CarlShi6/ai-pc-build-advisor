import { describe, expect, it } from "vitest";
import { showcaseParts } from "@/data/showcaseParts";
import {
  completeness,
  fromLegacyBuild,
  primarySlots,
  selectedPart,
  slotCategory,
  toSavedBuildPayload,
} from "@/lib/v3/build-document";
import { priceCoverage } from "@/lib/v3/catalog";
import { referenceModelSlots } from "@/lib/v3/reference-models";
import { WHITE_SHOWCASE_SAMPLE, createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";

describe("white showcase one-click sample", () => {
  it("fills all eight slots with the right categories and passes the rules", () => {
    const sample = createWhiteShowcaseSample();
    expect(sample.source).toBe("sample");
    expect(completeness(sample).selected).toBe(8);
    for (const slot of primarySlots)
      expect(selectedPart(sample, slot)?.category).toBe(slotCategory[slot]);
    expect(sample.build.compatibilityStatus).toBe("pass");
  });

  it("uses every white showcase part it can and keeps unknown prices unknown", () => {
    const sample = createWhiteShowcaseSample();
    const white = new Set(showcaseParts.map((part) => part.id));
    expect(Object.values(WHITE_SHOWCASE_SAMPLE).filter((id) => white.has(id))).toHaveLength(5);
    // The O11 has no manufacturer price: it is counted as unknown, never $0.
    expect(priceCoverage(sample.build.parts).unknown).toBe(1);
    expect(sample.build.totalPrice).toBe(priceCoverage(sample.build.parts).known);
  });

  it("renders every part with published millimetres as a reference reconstruction", () => {
    // CPU, SSD and PSU stay generic: the PSU page has no size, and CPU and SSD may stay simple.
    expect(referenceModelSlots(createWhiteShowcaseSample())).toEqual([
      "case",
      "motherboard",
      "cooler",
      "gpu",
      "memory",
    ]);
  });

  it("is a fresh draft each time and keeps its source through a save round trip", () => {
    const a = createWhiteShowcaseSample();
    const b = createWhiteShowcaseSample();
    expect(a.build.id).not.toBe(b.build.id);
    const restored = fromLegacyBuild(toSavedBuildPayload(a), "saved-1");
    expect(restored?.source).toBe("sample");
  });
});
