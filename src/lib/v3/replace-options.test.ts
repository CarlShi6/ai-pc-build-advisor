import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { createDraft, type ImageBuildContext } from "@/lib/v3/build-document";
import { compatibilitySummary, replaceOptions } from "@/lib/v3/replace-options";
import { getRecommendedBuildData } from "@/lib/build-advisor";

const part = (id: string) => seedParts.find((item) => item.id === id)!;

function fullDraft() {
  return createDraft("describe", { parts: getRecommendedBuildData({ budget: 2500 }).parts });
}

describe("replace card options", () => {
  it("previews swaps without changing the build and reports the seed price difference", () => {
    const draft = fullDraft();
    const current = draft.build.parts.find((item) => item.category === "gpu")!;
    const { options, total } = replaceOptions(draft, "gpu");
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(4);
    expect(total).toBeGreaterThanOrEqual(options.length);
    for (const option of options) {
      expect(option.part.id).not.toBe(current.id);
      expect(option.priceDelta).toBe(option.part.price - current.price);
      expect(option.proposal.baseRevision).toBe(draft.revision);
      // A worse status always comes with the finding that explains it.
      if (option.after.findings > option.before.findings)
        expect(option.newFindings.length).toBeGreaterThan(0);
    }
    // Closest seed price first.
    const gaps = options.map((option) => Math.abs(option.priceDelta ?? Number.POSITIVE_INFINITY));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(draft.build.parts.find((item) => item.category === "gpu")?.id).toBe(current.id);
  });

  it("never reports pass for an incomplete build", () => {
    const partial = createDraft("blank", { parts: [part("cpu-i7-14700k")] });
    expect(compatibilitySummary(partial).label).toBe("Incomplete");
    const { options } = replaceOptions(partial, "gpu");
    expect(options.every((option) => option.after.label === "Incomplete")).toBe(true);
    expect(compatibilitySummary(fullDraft()).label).not.toBe("Incomplete");
  });

  it("lists lock-safe parts before ones that would change a locked look", () => {
    const imageContext: ImageBuildContext = {
      referenceImageId: "ref",
      analysisId: "analysis",
      imageStored: false,
      observations: [],
      reviews: {},
      visualPriorities: [
        {
          id: "walnut",
          category: "colorway",
          value: "walnut",
          observationId: "obs",
          sourceCategory: "case",
          locked: true,
        },
      ],
      plannedSelections: {},
    };
    const draft = createDraft("image", {
      parts: [part("case-fractal-north-xl")],
      imageContext,
    });
    const { options } = replaceOptions(draft, "case");
    expect(options.length).toBeGreaterThan(0);
    // Every other seed case is plain black, so each one breaks the walnut lock.
    expect(options.every((option) => option.lockConflicts.length === 1)).toBe(true);
    expect(options[0].lockConflicts[0]).toMatchObject({ priorityId: "walnut", outcome: "changed" });
  });
});
