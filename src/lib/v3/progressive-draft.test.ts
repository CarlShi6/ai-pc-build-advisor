import { describe, expect, it } from "vitest";
import { selectPart, selectedPart, slotOccupancy } from "@/lib/v3/build-document";
import { catalogForSlot } from "@/lib/v3/build-document";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { slotModel } from "@/lib/v3/slot-models";
import type { StreamedPart } from "@/lib/v3/analysis-stream";
import {
  analysisOfDraft,
  applyFullResult,
  applyStreamedPart,
  endReadingDraft,
  resumeReadingDraft,
  setDraftAppearance,
  startReadingDraft,
  wasInterrupted,
} from "@/lib/v3/progressive-draft";
import { pendingSlots, type ReadingState } from "@/lib/v3/live-reading";
import { fromLegacyBuild, toSavedBuildPayload } from "@/lib/v3/build-document";

const fixture = createGlassFrontFixture();
const look = fixture.appearance!;
const part = <C extends StreamedPart["category"]>(category: C) =>
  ({ type: "part", category, value: structuredClone(look[category]) }) as StreamedPart;

describe("the Studio draft while a photo is read", () => {
  it("starts empty: no parts, nothing drawn from the photo, nothing waiting for review", () => {
    const draft = startReadingDraft("reading-1");
    expect(draft.build.parts).toEqual([]);
    expect(draft.unresolved).toEqual({});
    expect(slotModel(draft, "gpu")).toBeNull();
    expect(draft.budgetUnset).toBe(true);
  });

  it("draws each category as it arrives; hidden parts stay open", () => {
    let draft = startReadingDraft("reading-1");
    draft = applyStreamedPart(draft, part("case"));
    expect(slotModel(draft, "case")?.kind).toBe("appearance");
    expect(slotModel(draft, "gpu")).toBeNull();
    draft = applyStreamedPart(draft, part("gpu"));
    expect(slotModel(draft, "gpu")?.kind).toBe("appearance");
    expect(slotOccupancy(draft, "gpu")).toBe("unresolved");
    for (const slot of ["cpu", "storage", "psu"] as const)
      expect(slotOccupancy(draft, slot)).toBe("unselected");
  });

  it("lists the visible slots still waiting, and none once reading has ended", () => {
    const state: ReadingState = {
      id: "reading-1",
      status: "reading",
      found: ["case", "fans", "gpu"],
      notices: [],
      fixture: false,
    };
    expect(pendingSlots(state)).toEqual(["cooler", "memory", "motherboard"]);
    expect(pendingSlots({ ...state, status: "failed" })).toEqual([]);
    expect(pendingSlots(null)).toEqual([]);
  });

  it("never overrides what the user chose while reading", () => {
    let draft = startReadingDraft("reading-1");
    const gpu = catalogForSlot("gpu")[0];
    draft = selectPart(draft, "gpu", gpu);
    // A look field the user set before the case arrived.
    draft = setDraftAppearance(
      draft,
      {
        ...draft.imageContext!.appearance!,
        case: { ...draft.imageContext!.appearance!.case, color: "black" },
      },
      ["case.color"],
    );
    draft = applyStreamedPart(draft, part("gpu"));
    draft = applyStreamedPart(draft, part("case"));
    expect(selectedPart(draft, "gpu")?.id).toBe(gpu.id);
    expect(draft.unresolved.gpu).toBeUndefined();
    expect(draft.imageContext!.appearance!.case.color).toBe("black");
    expect(draft.imageContext!.appearance!.case.type).toBe(look.case.type);
    // The full result keeps both, and the user's part is still the only part.
    const { document } = applyFullResult(draft, fixture);
    expect(document.build.parts.map((item) => item.id)).toEqual([gpu.id]);
    expect(document.build.id).toBe(draft.build.id);
    expect(document.imageContext!.appearance!.case.color).toBe("black");
    expect(document.imageContext!.observations).toHaveLength(fixture.observations.length);
    expect(document.imageContext!.modelGuesses).toEqual(fixture.modelGuesses);
  });

  it("names only the drawn categories the full read changed", () => {
    let draft = startReadingDraft("reading-1");
    // The stream said the GPU was black; the full, checked result says otherwise.
    draft = applyStreamedPart(draft, {
      type: "part",
      category: "gpu",
      value: { ...look.gpu, color: look.gpu.color === "black" ? "white" : "black" },
    });
    draft = applyStreamedPart(draft, part("case"));
    const { document, adjusted } = applyFullResult(draft, fixture);
    expect(adjusted).toEqual(["gpu"]);
    expect(document.imageContext!.appearance!.gpu).toEqual(look.gpu);
  });

  it("keeps the full read with the draft, so the match drawer works after a save", () => {
    const { document } = applyFullResult(startReadingDraft("reading-1"), fixture);
    const restored = fromLegacyBuild(toSavedBuildPayload(document))!;
    const analysis = analysisOfDraft(restored)!;
    expect(analysis.summary).toBe(fixture.summary);
    expect(analysis.quality).toBe(fixture.quality);
    expect(analysis.appearance).toEqual(fixture.appearance);
    expect(restored.imageContext!.appearanceRead).toEqual(fixture.appearance);
  });

  it("marks a draft while it is read, so a reload can tell the read was interrupted", () => {
    const draft = applyStreamedPart(startReadingDraft("reading-1"), part("case"));
    expect(draft.imageContext!.reading).toBe(true);
    expect(wasInterrupted(draft, null)).toBe(true);
    expect(wasInterrupted(draft, { id: "reading-1" })).toBe(false);
    // Reading again keeps the draft and what was drawn, under the new read.
    const again = resumeReadingDraft(draft, "reading-2");
    expect(again.build.id).toBe(draft.build.id);
    expect(again.imageContext!.analysisId).toBe("reading-2");
    expect(again.imageContext!.appearance!.case).toEqual(look.case);
    // A finished or stopped read clears the mark.
    expect(applyFullResult(again, fixture).document.imageContext!.reading).toBeUndefined();
    expect(endReadingDraft(again).imageContext!.reading).toBeUndefined();
    expect(wasInterrupted(endReadingDraft(again), null)).toBe(false);
  });
});
