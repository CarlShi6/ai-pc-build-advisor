import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import {
  chooseCandidate,
  emptyCandidateReview,
  keepCandidateUnknown,
  matchVisualCandidates,
  noteManualModel,
} from "@/lib/v3/candidate-matcher";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { suggestParts } from "@/lib/v3/image-build";
import { observationTagLine } from "@/lib/v3/observation-tags";

// Visual redesign slice B: the review page (PRD §4.3).
describe("observation tag lines", () => {
  it("joins what the photo shows per part, once each", () => {
    const { observations } = createGlassFrontFixture();
    expect(observationTagLine(observations, "case")).toBe("Tempered glass · White");
    expect(observationTagLine(observations, "fan")).toBe("5 fans · White · Blue LED rings");
    expect(observationTagLine(observations, "look")).toBe("Blue · All-white build");
    // The unreadable GPU marking (not visible) is left out.
    expect(observationTagLine(observations, "gpu")).toBe("White");
  });
});

describe("Build it in 3D decisions", () => {
  const analysis = createGlassFrontFixture();
  const sets = matchVisualCandidates(analysis);
  const set = (category: string) => sets.find((item) => item.category === category)!;

  it("keeps the user's choice, fills open parts with the top match and leaves ties open", () => {
    const cooler = set("cooler").candidates[1];
    const result = suggestParts(
      analysis,
      { cooler: chooseCandidate(set("cooler"), emptyCandidateReview(), cooler.partId) },
      2500,
    );
    const rows = Object.fromEntries(result.changes.map((row) => [row.category, row]));
    expect(rows.cooler).toMatchObject({ decision: "yours", partName: cooler.displayName });
    expect(rows.case).toMatchObject({
      decision: "suggested",
      partName: "Lian Li O11 Dynamic EVO (White)",
    });
    expect(rows.gpu.decision).toBe("tie");
    expect(rows.motherboard.decision).toBe("none");
  });

  it("never fills a part the user kept unknown or noted by hand", () => {
    const result = suggestParts(
      analysis,
      {
        case: keepCandidateUnknown(emptyCandidateReview()),
        cooler: noteManualModel(emptyCandidateReview(), "My old AIO"),
      },
      2500,
    );
    const rows = Object.fromEntries(result.changes.map((row) => [row.category, row]));
    expect(rows.case).toMatchObject({ decision: "kept", partName: null });
    expect(rows.case.appearance).toMatch(/^Kept unknown; drawn from the photo/);
    expect(rows.cooler).toMatchObject({ decision: "note", partName: null });
    expect(rows.cooler.appearance).toMatch(/^Your note: My old AIO/);
    expect(result.reviews.case?.chosenPartId).toBeUndefined();
  });
});

describe("review cards", () => {
  it("shows one top option with Use this, folds the rest and keeps actions in a menu", () => {
    const html = renderToStaticMarkup(
      createElement(ImageCandidateReview, { analysis: createGlassFrontFixture() }),
    );
    const caseCard = html.slice(
      html.indexOf('data-category="case"'),
      html.indexOf('data-category="gpu"'),
    );
    expect(caseCard).toContain('data-state="suggested"');
    expect(caseCard.match(/>Use this</g)).toHaveLength(2); // top match + one under Other options
    expect(caseCard).toContain("Other options (1)");
    expect(caseCard).toContain('aria-label="More options for Case"');
    expect(caseCard).toMatch(/Exclude Lian Li O11 Dynamic EVO \(White\)/);
    // Five tied fans fold away instead of reading like a ranking.
    const fanCard = html.slice(
      html.indexOf('data-category="fan"'),
      html.indexOf('data-category="motherboard"'),
    );
    expect(fanCard).toContain("5 options equally likely");
    expect(fanCard).toContain("Options (5)");
    expect(html.match(/Visual similarity only/g)).toHaveLength(1);
  });
});
