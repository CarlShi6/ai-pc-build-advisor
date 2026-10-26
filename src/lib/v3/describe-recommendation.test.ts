import { describe, expect, it } from "vitest";
import { getRecommendedBuildData } from "@/lib/build-advisor";
import { completeness, slotOccupancy, primarySlots } from "@/lib/v3/build-document";
import {
  proposeDescribeDraft,
  recommendationInput,
  type DescribeRequirements,
} from "@/lib/v3/describe-recommendation";

function propose(requirements: DescribeRequirements, description = "") {
  const recommended = getRecommendedBuildData(recommendationInput(requirements));
  return proposeDescribeDraft(recommended, requirements, description);
}

describe("EP-06 Describe recommendation", () => {
  it("fills all eight slots from the existing recommender as a describe draft preview", () => {
    const proposal = propose({ budget: 2500, useCases: ["1440p gaming"] }, "Quiet PC for my desk");
    expect(proposal.candidate.source).toBe("describe");
    expect(proposal.candidate.sourceInput).toBe("Quiet PC for my desk");
    expect(proposal.candidate.build.targetUseCase).toEqual(["1440p gaming"]);
    expect(completeness(proposal.candidate)).toMatchObject({ selected: 8, unresolved: 0 });
    for (const slot of primarySlots)
      expect(slotOccupancy(proposal.candidate, slot)).toBe("selected");
    expect(proposal.lines).toHaveLength(8);
    expect(proposal.lines.every((line) => line.price !== null)).toBe(true);
  });

  it("follows use cases the recommender understands", () => {
    const ai = propose({ budget: 4000, useCases: ["Local AI"] });
    const gaming = propose({ budget: 2000, useCases: ["1440p gaming"] });
    const gpuOf = (proposal: ReturnType<typeof propose>) =>
      proposal.candidate.build.parts.find((part) => part.category === "gpu")?.id;
    expect(gpuOf(ai)).toBe("gpu-rtx-4090");
    expect(gpuOf(gaming)).not.toBe("gpu-rtx-4090");
  });

  it("says which requirements it could not honor instead of implying it did", () => {
    const proposal = propose({
      budget: 1200,
      useCases: ["4K gaming"],
      appearance: "white",
      gpuBrand: "amd",
    });
    const notes = proposal.notes.join("\n");
    expect(notes).toMatch(/over your \$1,200 budget/);
    expect(notes).toMatch(/White look not applied: the local catalog has no white case/);
    expect(notes).toMatch(/AMD GPU preference not applied/);
    expect(notes).toMatch(/seed prices, not live offers/);
  });

  it("doesn't add notes for preferences that were met", () => {
    const proposal = propose({ budget: 6000, useCases: ["Video editing"], cpuBrand: "intel" });
    const notes = proposal.notes.join("\n");
    expect(notes).not.toMatch(/over your/);
    expect(notes).not.toMatch(/CPU preference not applied/);
  });
});
