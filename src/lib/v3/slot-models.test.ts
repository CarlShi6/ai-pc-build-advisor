import { describe, expect, it } from "vitest";
import { primarySlots } from "@/lib/v3/build-document";
import {
  chooseCandidate,
  emptyCandidateReview,
  matchVisualCandidates,
} from "@/lib/v3/candidate-matcher";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { proposeImageBuild } from "@/lib/v3/image-build";
import { appearanceHex } from "@/lib/v3/photo-appearance";
import { referenceModels } from "@/lib/v3/reference-models";
import { DISCLOSURE_NOTE, sceneDisclosure } from "@/lib/v3/scene-disclosure";
import { slotModel } from "@/lib/v3/slot-models";
import { createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";

/** The reported photo run: the O11 confirmed, GPU and AIO from the photo, no board observation. */
function photoDraft({ withBoard = false } = {}) {
  const fixture = createGlassFrontFixture();
  const analysis = {
    ...fixture,
    observations: fixture.observations.filter(
      (item) => withBoard || item.category !== "motherboard",
    ),
  };
  const caseSet = matchVisualCandidates(analysis).find((set) => set.category === "case")!;
  const reviews = {
    case: chooseCandidate(caseSet, emptyCandidateReview(), caseSet.candidates[0].partId),
  };
  return proposeImageBuild(analysis, reviews, 2500).candidate;
}

describe("what each slot draws", () => {
  it("draws photo look-alikes from the detailed builders, in the photo's colour, naming no model", () => {
    const draft = photoDraft();
    const gpu = slotModel(draft, "gpu")!;
    expect(gpu.kind).toBe("appearance");
    expect(gpu.model.frame).toBe("gpu");
    expect(gpu.model.parts.filter((part) => part.shape === "rotor")).toHaveLength(3);
    // No outputs or power connector: no model is known to count them from.
    expect(gpu.model.parts.some((part) => /^port-|power-16-pin/.test(part.id))).toBe(false);
    expect(gpu.model.materials["shroud-white"].color).toBe(appearanceHex.white);

    const cooler = slotModel(draft, "cooler")!;
    expect(cooler.kind).toBe("appearance");
    expect(cooler.model.parts.some((part) => part.id === "radiator-core")).toBe(true);
    expect(cooler.model.parts.filter((part) => /^hose-/.test(part.id))).toHaveLength(2);

    for (const item of [gpu, cooler]) {
      expect(item.model.assumptions?.[0]).toMatch(/no model is identified/);
      expect(referenceModels.map((model) => model.partId)).not.toContain(item.model.partId);
    }
  });

  it("ghosts an open motherboard slot, and tints it instead when the photo shows the board", () => {
    expect(slotModel(photoDraft(), "motherboard")?.kind).toBe("ghost");
    const shown = slotModel(photoDraft({ withBoard: true }), "motherboard")!;
    expect(shown.kind).toBe("appearance");
    // The ATX form factor: a 305 x 244 mm board.
    expect(shown.model.parts.find((part) => part.id === "pcb")?.sizeMm.slice(0, 2)).toEqual([
      244, 305,
    ]);
  });

  it("keeps reference models for selected parts and generic geometry for hidden slots", () => {
    const sample = createWhiteShowcaseSample();
    expect(slotModel(sample, "case")?.kind).toBe("reference");
    expect(slotModel(sample, "cpu")).toBeNull();
    const draft = photoDraft();
    expect(slotModel(draft, "case")?.kind).toBe("reference");
    for (const slot of ["cpu", "memory", "storage", "psu"] as const)
      expect(slotModel(draft, slot)).toBeNull();
  });
});

describe("scene disclosure", () => {
  it("puts every slot under exactly one kind, in short lines", () => {
    for (const document of [createWhiteShowcaseSample(), photoDraft()]) {
      const groups = sceneDisclosure(document);
      const slots = groups.flatMap((group) => group.items).filter((item) => !/fans?$/.test(item));
      expect(slots).toHaveLength(primarySlots.length);
      expect(new Set(slots).size).toBe(primarySlots.length);
      for (const group of groups) expect(group.label.length).toBeLessThan(30);
    }
    expect(DISCLOSURE_NOTE).not.toMatch(/generic illustrative geometry/);
  });

  it("matches the reported photo scene", () => {
    expect(sceneDisclosure(photoDraft())).toEqual([
      { kind: "reference", label: "Reference reconstruction", items: ["Case"] },
      { kind: "photo", label: "Appearance from photo", items: ["GPU", "Cooler", "5 fans"] },
      {
        kind: "illustrative",
        label: "Illustrative",
        items: ["Motherboard", "CPU", "Memory", "Storage", "Power supply"],
      },
    ]);
  });
});
