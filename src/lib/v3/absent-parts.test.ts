import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import {
  emptyCandidateReview,
  matchVisualCandidates,
  noteManualModel,
} from "@/lib/v3/candidate-matcher";
import { createImageAnalysisResult, observationJsonSchema } from "@/lib/v3/image-contract";
import { proposeImageBuild } from "@/lib/v3/image-build";

const image = { mime: "image/png" as const, width: 512, height: 512 };

function emptyCase(
  quality: "clear" | "poor" = "clear",
  absentParts = ["gpu", "fan", "motherboard"],
) {
  return createImageAnalysisResult(
    {
      summary: "An empty white case with the side panel removed.",
      quality,
      qualityIssues: [],
      observations: [
        {
          category: "case",
          attribute: "color",
          value: "white",
          evidence: "Uniformly white panels.",
          origin: "observed",
          confidenceBand: "high",
          visibleInImage: true,
          region: null,
        },
        {
          category: "gpu",
          attribute: "presence",
          value: "no GPU installed",
          evidence: "The PCIe slot area is empty.",
          origin: "observed",
          confidenceBand: "high",
          visibleInImage: true,
          region: null,
        },
      ],
      absentParts,
    },
    image,
  );
}

describe("parts the photo shows are not installed", () => {
  it("is part of the provider's strict output schema", () => {
    expect(observationJsonSchema.required).toContain("absentParts");
  });

  it("keeps the list for clear photos, drops it for poor ones, and defaults to empty", () => {
    expect(emptyCase().absentParts).toEqual(["gpu", "fan", "motherboard"]);
    expect(emptyCase("poor").absentParts).toEqual([]);
    expect(
      createImageAnalysisResult(
        { summary: "x", quality: "clear", qualityIssues: [], observations: [] },
        image,
      ).absentParts,
    ).toEqual([]);
    expect(() => emptyCase("clear", ["psu"])).toThrow();
  });

  it("shows 'not in photo' instead of 'unresolved', even without an observation for the part", () => {
    const sets = matchVisualCandidates(emptyCase());
    const status = Object.fromEntries(sets.map((set) => [set.category, set.status]));
    expect(status).toMatchObject({
      gpu: "not_in_photo",
      fan: "not_in_photo",
      motherboard: "not_in_photo",
    });
    expect(status.case).not.toBe("not_in_photo");
    const gpu = sets.find((set) => set.category === "gpu")!;
    expect(gpu.candidates).toEqual([]);
    expect(gpu.explanation).toMatch(/no graphics card installed.*slot stays open/);
    expect(sets.find((set) => set.category === "fan")!.explanation).not.toMatch(/slot/);
    const html = renderToStaticMarkup(
      createElement(ImageCandidateReview, { analysis: emptyCase() }),
    );
    expect(html).toContain("Not in photo");
    expect(html).not.toContain(">Unresolved<");
    // Only the case set (which has candidates) still offers "Keep unknown".
    expect(html.match(/Keep unknown/g)).toHaveLength(1);
  });

  it("leaves absent slots open in the draft instead of flagging them for review", () => {
    const proposal = proposeImageBuild(emptyCase(), {}, 2000);
    const flagged = proposal.unresolved.map((item) => item.slot);
    expect(flagged).not.toContain("gpu");
    expect(flagged).not.toContain("motherboard");
    // A note the user writes still counts as an open question for that slot.
    const noted = proposeImageBuild(
      emptyCase(),
      { gpu: noteManualModel(emptyCandidateReview(), "Planning an RTX card later") },
      2000,
    );
    expect(noted.unresolved.map((item) => item.slot)).toContain("gpu");
  });
});
