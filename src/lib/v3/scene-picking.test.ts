import { describe, expect, it } from "vitest";
import { pickSlot } from "@/lib/v3/scene-picking";

const hit = (slot: Parameters<typeof pickSlot>[0][number]["slot"], passThrough = false) => ({
  slot,
  passThrough,
});

describe("what a pointer picks", () => {
  it("prefers any part on the ray over the case in front of it", () => {
    expect(pickSlot([hit("case"), hit("cpu")])).toBe("cpu");
    expect(pickSlot([hit("case"), hit("case"), hit("memory"), hit("motherboard")])).toBe("memory");
  });

  it("takes the nearest part when several are on the ray", () => {
    expect(pickSlot([hit("memory"), hit("motherboard")])).toBe("memory");
  });

  it("lets exploded panels pass clicks through, and picks the case only by its frame", () => {
    expect(pickSlot([hit("case", true), hit("cooler")])).toBe("cooler");
    expect(pickSlot([hit("case", true), hit("case")])).toBe("case");
    expect(pickSlot([hit("case", true)])).toBeNull();
    expect(pickSlot([hit(null), hit("gpu")])).toBe("gpu");
    expect(pickSlot([])).toBeNull();
  });
});

describe("exploded box areas", () => {
  it("lose to any real part surface on the ray, but beat the case", () => {
    const box = (slot: "cooler" | "gpu") => ({ slot, passThrough: false, kind: "box" as const });
    expect(pickSlot([box("cooler"), hit("storage")])).toBe("storage");
    expect(pickSlot([box("cooler"), hit("case")])).toBe("cooler");
    expect(pickSlot([box("cooler"), box("gpu")])).toBe("cooler");
  });
});
