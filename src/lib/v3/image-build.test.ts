import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import {
  createDraft,
  selectedPart,
  selectPart,
  setVisualPriorityLock,
  slotOccupancy,
} from "@/lib/v3/build-document";
import { confirmPartSelection, proposePartSelection } from "@/lib/v3/build-proposal";
import {
  chooseCandidate,
  emptyCandidateReview,
  matchVisualCandidates,
} from "@/lib/v3/candidate-matcher";
import { createOgImageFixture } from "@/lib/v3/dev-image-fixture";
import {
  confirmImageBuild,
  proposeImageBuild,
  visualPrioritiesFromAnalysis,
} from "@/lib/v3/image-build";
import { scenePresentation } from "@/lib/v3/scene-presentation";
import { optimizationOptions } from "@/lib/v3/visual-optimization";

describe("R5 image-to-Build workflow", () => {
  it("keeps image review separate until final confirmation and preserves unknown slots", () => {
    const analysis = createOgImageFixture();
    const sets = matchVisualCandidates(analysis);
    const caseSet = sets.find((set) => set.category === "case")!;
    const gpuSet = sets.find((set) => set.category === "gpu")!;
    const caseChoice = caseSet.candidates.find((item) => item.partId === "case-o11-evo")!;
    const gpuChoice = gpuSet.candidates.find((item) => item.partId === "gpu-rtx-4080-super")!;
    expect(caseChoice).toBeDefined();
    expect(gpuChoice).toBeDefined();
    const existing = createDraft("blank");
    const reviews = {
      case: chooseCandidate(caseSet, emptyCandidateReview(), caseChoice.partId),
      gpu: chooseCandidate(gpuSet, emptyCandidateReview(), gpuChoice.partId),
    };
    const proposal = proposeImageBuild(analysis, reviews, 2400, existing);
    expect(existing.build.parts).toHaveLength(0);
    expect(proposal.selected).toHaveLength(2);
    expect(proposal.remaining).toHaveLength(6);
    expect(proposal.visualWarnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/Case.*differs from the observed tower/)]),
    );
    expect(proposal.candidate.imageContext?.imageStored).toBe(false);
    const draft = confirmImageBuild(proposal, existing);
    expect(draft.source).toBe("image");
    expect(draft.imageContext?.observations).toHaveLength(analysis.observations.length);
    expect(draft.imageContext?.plannedSelections.case).toMatchObject({
      partId: caseChoice.partId,
      origin: "image_review",
    });
    expect(slotOccupancy(draft, "case")).toBe("selected");
    expect(slotOccupancy(draft, "cpu")).toBe("unselected");
    expect(draft.build.totalPrice).toBe(
      caseSet.candidates.length
        ? seedParts.find((part) => part.id === caseChoice.partId)!.price +
            seedParts.find((part) => part.id === gpuChoice.partId)!.price
        : 0,
    );
    expect(scenePresentation(draft)).toMatchObject({
      layout: "showcase",
      accentColor: "#76d56f",
      geometryAccuracy: "illustrative",
    });
  });

  it("keeps unchosen visible identities unresolved and rejects stale drafts", () => {
    const analysis = createOgImageFixture();
    const active = createDraft("blank");
    const proposal = proposeImageBuild(analysis, {}, 2000, active);
    expect(proposal.candidate.unresolved.case).toMatch(/identity unresolved/);
    expect(proposal.candidate.unresolved.gpu).toMatch(/identity unresolved/);
    expect(slotOccupancy(proposal.candidate, "case")).toBe("unresolved");
    expect(proposal.candidate.build.parts).toHaveLength(0);
    const changed = selectPart(
      active,
      "case",
      seedParts.find((part) => part.id === "case-o11-evo")!,
    );
    expect(() => confirmImageBuild(proposal, changed)).toThrow(/changed after this preview/);
    expect(
      visualPrioritiesFromAnalysis(analysis).some(
        (item) => item.category === "lighting" && item.value === "green",
      ),
    ).toBe(true);
  });

  it("uses normal proposal confirmation for a style-aware replacement and synchronizes state", () => {
    const analysis = createOgImageFixture();
    const gpuSet = matchVisualCandidates(analysis).find((set) => set.category === "gpu")!;
    const gpu = gpuSet.candidates.find((item) => item.partId === "gpu-rtx-4070-super")!;
    const draft = confirmImageBuild(
      proposeImageBuild(
        analysis,
        {
          gpu: chooseCandidate(gpuSet, emptyCandidateReview(), gpu.partId),
        },
        2000,
      ),
      null,
    );
    const cheaper = optimizationOptions(draft, "gpu", "improve_performance");
    expect(cheaper.length).toBeGreaterThan(0);
    const option = cheaper.find((item) => item.part.id === "gpu-rtx-4080-super")!;
    expect(option).toBeDefined();
    expect(option.performanceEvidence).toContain("Catalog gaming score");
    expect(selectedPart(draft, "gpu")?.id).toBe("gpu-rtx-4070-super");
    const next = confirmPartSelection(draft, option.proposal);
    expect(selectedPart(next, "gpu")?.id).toBe("gpu-rtx-4080-super");
    expect(next.imageContext?.plannedSelections.gpu?.origin).toBe("manual_change");
    expect(next.build.totalPrice).toBe(option.proposal.candidate.build.totalPrice);
    expect(next.build.compatibilityStatus).toBe(option.proposal.compatibilityAfter);
    expect(slotOccupancy(next, "gpu")).toBe("selected");
  });

  it("does not silently violate a locked case look during budget optimization", () => {
    const analysis = createOgImageFixture();
    const casePart = seedParts.find((part) => part.id === "case-fractal-north-xl")!;
    let draft = selectPart(
      confirmImageBuild(proposeImageBuild(analysis, {}, 2000), null),
      "case",
      casePart,
    );
    expect(optimizationOptions(draft, "case", "reduce_cost")).toHaveLength(0);
    const style = draft.imageContext!.visualPriorities.find(
      (item) => item.category === "case_style",
    )!;
    draft = setVisualPriorityLock(draft, style.id, false);
    const options = optimizationOptions(draft, "case", "reduce_cost");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((item) => /black/i.test(item.part.color ?? ""))).toBe(true);
    expect(options.every((item) => item.proposal.priceDelta < 0)).toBe(true);
    const next = confirmPartSelection(draft, proposePartSelection(draft, "case", options[0].part));
    expect(next.build.totalPrice).toBeLessThan(draft.build.totalPrice);
    expect(next.imageContext?.visualPriorities.find((item) => item.id === style.id)?.locked).toBe(
      false,
    );
  });

  it("passes only appearance cues to illustrative scene layout", () => {
    const analysis = createOgImageFixture();
    analysis.observations.push(
      {
        ...analysis.observations[0],
        id: "fan-layout-fixture",
        category: "fan",
        attribute: "layout",
        value: "3 front fans",
        evidence: "Three illuminated fan rings appear in front.",
      },
      {
        ...analysis.observations[0],
        id: "gpu-placement-fixture",
        category: "gpu",
        attribute: "orientation",
        value: "vertical",
        evidence: "The graphics card face is upright.",
      },
    );
    const draft = confirmImageBuild(proposeImageBuild(analysis, {}, 2000), null);
    expect(scenePresentation(draft)).toMatchObject({
      layout: "tower",
      fanAccentCount: 3,
      gpuVertical: true,
      geometryAccuracy: "illustrative",
    });
    expect(draft.build.parts).toHaveLength(0);
  });
});
