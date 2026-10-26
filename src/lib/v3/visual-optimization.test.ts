import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import {
  createDraft,
  selectedPart,
  type ImageBuildContext,
  type VisualPriority,
} from "@/lib/v3/build-document";
import { proposePartSelection } from "@/lib/v3/build-proposal";
import {
  confirmWithLockOverride,
  lockConflicts,
  optimizationResult,
  type OptimizationIntent,
} from "@/lib/v3/visual-optimization";

const part = (id: string) => seedParts.find((item) => item.id === id)!;
const o11 = part("case-o11-evo");
const h5 = part("case-nzxt-h5-flow");
const gpu = part("gpu-rtx-4070-super");
const intents: OptimizationIntent[] = [
  "preserve_look",
  "reduce_cost",
  "improve_performance",
  "balanced",
];

function priority(overrides: Partial<VisualPriority>): VisualPriority {
  return {
    id: "p-color",
    category: "colorway",
    value: "white",
    observationId: "obs-1",
    sourceCategory: "case",
    locked: true,
    ...overrides,
  };
}

function imageDraft(parts = [o11], visualPriorities: VisualPriority[] = [priority({})]) {
  const imageContext: ImageBuildContext = {
    referenceImageId: "ref",
    analysisId: "analysis",
    imageStored: false,
    observations: [],
    reviews: {},
    visualPriorities,
    plannedSelections: {},
  };
  return createDraft("image", { parts, imageContext });
}

describe("EP-05 look lock (PRD §10)", () => {
  it("never suggests a black case while a white exterior is locked", () => {
    const draft = imageDraft();
    for (const intent of intents) {
      const { options } = optimizationResult(draft, "case", intent);
      expect(options.every((option) => option.part.color === "White")).toBe(true);
    }
    // Of the white showcase cases, only the one with a known lower price is a cheaper option.
    const cheaper = optimizationResult(draft, "case", "reduce_cost").options;
    expect(cheaper.map((option) => option.part.partNumber)).toEqual(["CC-H52FW-01"]);
  });

  it("explains an impossible lock instead of breaking it", () => {
    const draft = imageDraft([o11], [priority({ value: "pink" })]);
    for (const intent of intents) {
      const result = optimizationResult(draft, "case", intent);
      expect(result.options).toEqual([]);
      expect(result.emptyReason).toMatch(/locked look \(Color: pink\)/);
    }
  });

  it("requires an explicit override to pick a lock-breaking part, then unlocks that trait", () => {
    const draft = imageDraft();
    expect(lockConflicts(draft, "case", h5)).toEqual([
      expect.objectContaining({ priorityId: "p-color", outcome: "changed", locked: true }),
    ]);
    const proposal = proposePartSelection(draft, "case", h5);
    const next = confirmWithLockOverride(draft, proposal, ["p-color"]);
    expect(selectedPart(next, "case")?.id).toBe(h5.id);
    expect(next.imageContext?.visualPriorities[0].locked).toBe(false);
    // A stale preview is still rejected on the override path.
    expect(() => confirmWithLockOverride(next, proposal, ["p-color"])).toThrow(/changed/);
  });

  it("treats unknown catalog data as neither a match nor a conflict", () => {
    const draft = imageDraft([o11], [priority({ category: "lighting", value: "RGB rings" })]);
    expect(lockConflicts(draft, "case", h5)).toEqual([]);
    // But a locked trait the catalog can't confirm is not offered as a suggestion either.
    expect(optimizationResult(draft, "case", "preserve_look").options).toEqual([]);
  });
});

describe("EP-05 intents", () => {
  it("Preserve the look ranks closest catalog appearance first, then closest price", () => {
    const draft = imageDraft([o11], [priority({ value: "black" })]);
    const { options } = optimizationResult(draft, "case", "preserve_look");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.traitImpacts).toEqual([
        expect.objectContaining({ label: "Color: black", outcome: "retained", locked: true }),
      ]);
      expect(option.visualImpact).toContain("not a visual comparison");
    }
    // Exact current color ("Black") outranks a partial match ("Black / walnut") even if cheaper.
    const exact = options.filter((option) => option.part.color === o11.color);
    expect(options.slice(0, exact.length)).toEqual(exact);
    const gaps = exact.map((option) => Math.abs(option.part.price - o11.price));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  it("Balanced trades catalog score against seed price under user control", () => {
    const draft = createDraft("blank", { parts: [gpu] });
    const savings = optimizationResult(draft, "gpu", "balanced", 0.25).options;
    const performance = optimizationResult(draft, "gpu", "balanced", 0.75).options;
    expect(savings.length + performance.length).toBeGreaterThan(0);
    for (const option of [...savings, ...performance]) {
      expect(option.performanceEvidence).toContain("not an FPS estimate");
      // Never offer something both slower and more expensive.
      const slower = option.performanceEvidence.match(/(\d+) → (\d+)/);
      if (slower && Number(slower[2]) < Number(slower[1]))
        expect(option.proposal.priceDelta).toBeLessThan(0);
    }
    if (performance.length && savings.length)
      expect(performance[0].proposal.priceDelta).toBeGreaterThanOrEqual(
        savings[0].proposal.priceDelta,
      );
  });

  it("explains when performance can't be compared instead of inventing gains", () => {
    const psu = seedParts.find((item) => item.category === "psu")!;
    const draft = createDraft("blank", { parts: [psu] });
    const result = optimizationResult(draft, "psu", "balanced");
    if (!result.options.length) expect(result.emptyReason).toMatch(/performance score/);
  });
});
