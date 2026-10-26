import { describe, expect, it } from "vitest";
import { primarySlots } from "@/lib/v3/build-document";
import { focusOffset, isDimmed, slotLayout, slotPosition } from "@/lib/v3/scene-focus";

describe("Focus/Isolate scene math (PRD §4.5)", () => {
  it("pulls only the focused part out, towards the viewer, and leaves the rest in place", () => {
    const focused = slotPosition("gpu", "standard", 0, "gpu");
    expect(focused[2]).toBeGreaterThan(slotLayout.gpu.anchor[2] + 0.5);
    for (const slot of primarySlots.filter((item) => item !== "gpu"))
      expect(slotPosition(slot, "standard", 0, "gpu")).toEqual(slotLayout[slot].anchor);
  });

  it("isolates the case by dimming only, never moving it", () => {
    expect(focusOffset("case")).toEqual([0, 0, 0]);
    expect(slotPosition("case", "exploded", 100, "case")).toEqual(slotLayout.case.anchor);
  });

  it("dims every other slot only while something is focused", () => {
    expect(primarySlots.some((slot) => isDimmed(slot, null))).toBe(false);
    expect(primarySlots.filter((slot) => isDimmed(slot, "cooler"))).toHaveLength(7);
    expect(isDimmed("cooler", "cooler")).toBe(false);
  });

  it("adds the focus pull on top of the global explode amount, clamped to 0–100%", () => {
    const exploded = slotPosition("memory", "exploded", 100, null);
    const both = slotPosition("memory", "exploded", 250, "memory");
    const pull = focusOffset("memory");
    both.forEach((value, index) => expect(value).toBeCloseTo(exploded[index] + pull[index]));
    expect(slotPosition("memory", "standard", 100, null)).toEqual(slotLayout.memory.anchor);
  });
});
