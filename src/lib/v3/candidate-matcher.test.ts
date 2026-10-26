import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import { createDraft } from "@/lib/v3/build-document";
import { createImageAnalysisResult, type ObservationDraft } from "@/lib/v3/image-contract";
import {
  chooseCandidate,
  emptyCandidateReview,
  excludeCandidate,
  keepCandidateUnknown,
  matchVisualCandidates,
  noteManualModel,
} from "@/lib/v3/candidate-matcher";

function analysis(observations: ObservationDraft["observations"]) {
  return createImageAnalysisResult(
    {
      summary: "Reference PC",
      quality: "clear",
      qualityIssues: [],
      observations,
    },
    { mime: "image/png", width: 512, height: 512 },
  );
}

function observation(
  category: ObservationDraft["observations"][number]["category"],
  attribute: string,
  value: string,
) {
  return {
    category,
    attribute,
    value,
    evidence: `Visible ${attribute}: ${value}`,
    origin: "observed" as const,
    confidenceBand: "medium" as const,
    visibleInImage: true,
    region: null,
  };
}

describe("R4 visual catalog review", () => {
  it("renders candidate evidence, uncertainty, review actions, and fan sources", () => {
    const html = renderToStaticMarkup(
      createElement(ImageCandidateReview, {
        analysis: analysis([
          observation("case", "color", "black"),
          observation("fan", "lighting", "RGB rings"),
        ]),
      }),
    );
    expect(html).toContain("Photo evidence: Visible color: black");
    expect(html).toContain("Compatibility: not checked");
    expect(html).toContain("Confirm planned option");
    expect(html).toContain("Keep unknown");
    expect(html).toContain("Specs from manufacturer page");
    expect(html).toContain("Not a Build slot; no compatibility check");
  });

  it("ranks only canonical catalog IDs with separate evidence signals", () => {
    const sets = matchVisualCandidates(
      analysis([observation("case", "color", "black"), observation("case", "style", "showcase")]),
    );
    const cases = sets.find((set) => set.category === "case")!;
    expect(cases.candidates[0].partId).toBe("case-o11-evo");
    expect(cases.candidates[0].matchedSignals).toEqual(
      expect.arrayContaining(["Color: black", "Catalog style: Showcase"]),
    );
    expect(cases.candidates[0].identityEvidence).toBe("appearance_only");
    expect(cases.candidates[0].observationEvidence).toContain("Visible color: black");
    expect(cases.candidates[0].compatibilityStatus).toBe("not_checked");
    expect(cases.candidates.length).toBeGreaterThan(1);
    expect(cases.candidates.length).toBeLessThanOrEqual(5);
  });

  it("keeps unsupported colors unresolved", () => {
    const sets = matchVisualCandidates(
      analysis([observation("case", "color", "pink"), observation("fan", "lighting", "RGB rings")]),
    );
    // No pink case in the catalog (white showcase cases now exist, so white would match).
    expect(sets.find((set) => set.category === "case")?.status).toBe("unresolved");
  });

  it("treats a visible GPU marking as alternatives, not a verified SKU", () => {
    const gpu = matchVisualCandidates(
      analysis([observation("gpu", "model marking", "RTX 5070")]),
    )[0];
    expect(gpu.candidates.map((candidate) => candidate.partId)).toContain("gpu-rtx-5070-fe");
    expect(gpu.candidates.map((candidate) => candidate.partId)).toContain(
      "gpu-rtx-5070-ti-reference",
    );
    expect(
      gpu.candidates.every((candidate) => candidate.identityEvidence === "visible_marking"),
    ).toBe(true);
    expect(gpu.candidates[0].missingEvidence[0]).toMatch(/does not verify exact SKU/);
  });

  it("records choose, replace, exclude, unknown, and manual decisions without changing Build", () => {
    const document = createDraft("image");
    const set = matchVisualCandidates(analysis([observation("case", "color", "black")]))[0];
    const first = set.candidates[0].partId;
    const alternative = set.candidates[1].partId;
    const chosen = chooseCandidate(set, emptyCandidateReview(), first);
    expect(chosen.chosenEvidence?.observationIds).toEqual(set.candidates[0].matchedObservationIds);
    expect(chosen.chosenEvidence?.catalogSourceId).toBe(`seedParts:${first}`);
    expect(chooseCandidate(set, chosen, alternative).chosenPartId).toBe(alternative);
    const excluded = excludeCandidate(chosen, first);
    expect(excluded.status).toBe("unknown");
    expect(() => chooseCandidate(set, excluded, first)).toThrow();
    expect(keepCandidateUnknown(chosen).chosenPartId).toBeUndefined();
    expect(noteManualModel(chosen, "  user supplied case name  ")).toMatchObject({
      status: "manual",
      manualText: "user supplied case name",
    });
    expect(document.revision).toBe(0);
    expect(document.build.parts).toEqual([]);
  });
});
