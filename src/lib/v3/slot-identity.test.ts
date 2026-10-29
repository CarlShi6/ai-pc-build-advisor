import { describe, expect, it } from "vitest";
import {
  chooseCandidate,
  emptyCandidateReview,
  matchVisualCandidates,
  type CandidateReview,
} from "@/lib/v3/candidate-matcher";
import {
  createBlackTowerFixture,
  createGlassFrontFixture,
  createOgImageFixture,
} from "@/lib/v3/dev-image-fixture";
import { proposeImageBuild, type ImageReviews } from "@/lib/v3/image-build";
import { matchGapProperties } from "@/lib/v3/funnel-analytics";
import {
  KEEP_UNKNOWN_NOTE,
  keepSlotUnknown,
  matchGap,
  matchGaps,
  searchCatalog,
  slotIdentityHelp,
} from "@/lib/v3/slot-identity";

const fixture = createGlassFrontFixture();
const caseSet = matchVisualCandidates(fixture).find((set) => set.category === "case")!;
const caseOnly: ImageReviews = {
  case: chooseCandidate(caseSet, emptyCandidateReview(), caseSet.candidates[0].partId),
};
/** The same sample with a red board, which no catalog board comes in. */
const redBoard = {
  ...fixture,
  observations: fixture.observations.map((item) =>
    item.category === "motherboard" && /colou?r/.test(item.attribute)
      ? { ...item, value: "red" }
      : item,
  ),
};
const draft = (reviews: ImageReviews = caseOnly) =>
  proposeImageBuild(fixture, reviews, null).candidate;

describe("why a visible part finds no catalog match", () => {
  it("names the reason for each category as a code", () => {
    // The white sample: white GPUs tie, and so do the two white catalog boards.
    expect(matchGaps(fixture)).toMatchObject({ gpu: "tied", motherboard: "tied" });
    expect(matchGap(redBoard, "motherboard")).toBe("no_close_match");
    // Its round pump cap rules out the three AIOs whose maker pages name a pump screen.
    expect(matchGap(fixture, "cooler")).toBeNull();
    // Black sticks without a light bar: every black kit fits equally well.
    expect(matchGap(createBlackTowerFixture(), "memory")).toBe("tied");
    expect(matchGap({ ...fixture, absentParts: ["gpu"] }, "gpu")).toBe("judged_absent");
    expect(matchGap(createOgImageFixture(), "cooler")).toBe("not_seen");
    const gpus = matchVisualCandidates(fixture).find((set) => set.category === "gpu")!;
    const allOut: CandidateReview = {
      status: "unknown",
      excludedPartIds: gpus.candidates.map((item) => item.partId),
    };
    expect(matchGap(fixture, "gpu", allOut)).toBe("all_excluded");
  });

  it("records codes only, never what the photo said", () => {
    const properties = matchGapProperties(fixture, {});
    expect(properties).toMatchObject({
      gap_gpu: "tied",
      gap_motherboard: "tied",
      fixture: true,
    });
    for (const item of fixture.observations)
      expect(JSON.stringify(properties)).not.toContain(item.value);
  });
});

describe("an unconfirmed photo slot in the Studio", () => {
  it("shows the photo evidence and the closest looks, never as this exact part", () => {
    const help = slotIdentityHelp(draft(), "gpu")!;
    expect(help.evidence).toMatch(/^Photo: .*white/i);
    expect(help.candidates.map((item) => item.displayName)).toEqual(
      expect.arrayContaining([expect.stringMatching(/White/)]),
    );
    expect(help.gap).toBe("tied");
    // A slot with nothing alike still has evidence, an empty list and the reason.
    const board = slotIdentityHelp(
      proposeImageBuild(redBoard, caseOnly, null).candidate,
      "motherboard",
    )!;
    expect(board.candidates).toEqual([]);
    expect(board.gap).toBe("no_close_match");
    // Selected and hidden slots get no help.
    expect(slotIdentityHelp(draft(), "case")).toBeNull();
    expect(slotIdentityHelp(draft(), "psu")).toBeNull();
  });

  it("keeps the review's decisions: excluded parts stay out, a kept-unknown stays kept", () => {
    const gpus = matchVisualCandidates(fixture).find((set) => set.category === "gpu")!;
    const excluded = gpus.candidates[0].partId;
    const reviews: ImageReviews = {
      ...caseOnly,
      gpu: { status: "unknown", excludedPartIds: [excluded] },
    };
    const help = slotIdentityHelp(draft(reviews), "gpu")!;
    expect(help.candidates.map((item) => item.partId)).not.toContain(excluded);
    expect(help.excludedCount).toBe(1);

    const kept = keepSlotUnknown(draft(), "gpu");
    expect(kept.unresolved.gpu).toBe(KEEP_UNKNOWN_NOTE);
    expect(kept.imageContext?.reviews.gpu?.kept).toBe(true);
    expect(slotIdentityHelp(kept, "gpu")?.kept).toBe(true);
    expect(() => keepSlotUnknown(draft(), "case")).toThrow();
  });

  it("searches the catalog by model name, every word must match", () => {
    expect(searchCatalog("gpu", "5070 white").map((part) => part.displayName)).toEqual(
      expect.arrayContaining([expect.stringMatching(/5070.*White|White.*5070/)]),
    );
    expect(searchCatalog("gpu", "no such card")).toEqual([]);
    expect(searchCatalog("gpu", "  ")).toEqual([]);
  });
});
