import { describe, expect, it } from "vitest";
import { createDraft, slotOccupancy } from "@/lib/v3/build-document";
import { caseAppearance } from "@/data/showcaseParts";
import {
  chooseCandidate,
  emptyCandidateReview,
  equallyLikelyCandidates,
  matchVisualCandidates,
} from "@/lib/v3/candidate-matcher";
import {
  createGlassFrontFixture,
  createOgImageFixture,
  createWhiteSketchFixture,
} from "@/lib/v3/dev-image-fixture";
import { confirmImageBuild, proposeImageBuild, suggestParts } from "@/lib/v3/image-build";
import { appearanceSummary, photoAppearance, photoFans } from "@/lib/v3/photo-appearance";

describe("photo appearance placeholders (PRD §9.3 level 2)", () => {
  it("draws unresolved visible slots from the photo and leaves hidden slots empty", () => {
    const analysis = createWhiteSketchFixture();
    const draft = proposeImageBuild(analysis, {}, 2500).candidate;
    const looks = photoAppearance(draft);
    expect(Object.keys(looks).sort()).toEqual(["case", "cooler", "gpu", "motherboard"]);
    expect(looks.case).toMatchObject({
      color: "white",
      glassPanel: true,
      fanCount: 5,
      lightColor: "blue",
    });
    expect(looks.cooler).toMatchObject({ color: "white", coolerType: "aio" });
    expect(looks.gpu?.color).toBe("white");
    expect(appearanceSummary(looks.case!)).toBe("White · Glass side panel · 5 fans · Blue light");
    // Hidden parts were never observed, so they keep the empty-slot style.
    expect(looks.cpu).toBeUndefined();
    expect(looks.psu).toBeUndefined();
  });

  it("reads only visible observations, and draws nothing without a photo", () => {
    const analysis = createOgImageFixture();
    const draft = proposeImageBuild(analysis, {}, 2500).candidate;
    const looks = photoAppearance(draft);
    expect(looks.case?.color).toBe("black");
    expect(looks.case?.glassPanel).toBe(false);
    // The og fixture's only other GPU detail is an unreadable marking (visibleInImage false).
    expect(looks.gpu?.color).toBe("black");
    expect(photoAppearance(createDraft("blank"))).toEqual({});
  });
});

describe("Use suggested parts", () => {
  it("previews the top candidate per category and changes nothing until confirmed", () => {
    const analysis = createGlassFrontFixture();
    const before = createDraft("blank");
    // The two white GPUs tie on the photo, so the user picks one first.
    const gpus = matchVisualCandidates(analysis).find((set) => set.category === "gpu")!;
    const msi = gpus.candidates.find((item) => /MSI/.test(item.displayName))!;
    const reviews = { gpu: chooseCandidate(gpus, emptyCandidateReview(), msi.partId) };
    const suggested = suggestParts(analysis, reviews, 2500, before);
    expect(before.build.parts).toHaveLength(0);
    const rows = Object.fromEntries(suggested.changes.map((row) => [row.category, row]));
    expect(rows.case.partName).toBe("Lian Li O11 Dynamic EVO (White)");
    expect(rows.gpu.partName).toMatch(/^MSI .*WHITE$/);
    // Four white AIOs now fit the photo equally well (Step C), so the cooler waits for the user.
    expect(rows.cooler.decision).toBe("tie");
    expect(rows.cooler.partName).toBeNull();
    expect(rows.case.appearance).toBe("White, matches the photo");
    expect(rows.fan.price).toBe("Not counted");
    expect(rows.fan.match).toBe("5 options equally likely");
    // Two white boards tie: it stays unresolved and is drawn from the photo.
    expect(rows.motherboard.decision).toBe("tie");
    expect(rows.motherboard.partName).toBeNull();
    expect(rows.motherboard.appearance).toMatch(/drawn from the photo until then \(White/);
    expect(suggested.total.unknown).toBeGreaterThan(0);
    expect(suggested.compatibility).toMatch(/^Incomplete · 2 of 8 slots selected/);

    const draft = confirmImageBuild(suggested.proposal, before);
    expect(slotOccupancy(draft, "case")).toBe("selected");
    expect(slotOccupancy(draft, "gpu")).toBe("selected");
    expect(slotOccupancy(draft, "motherboard")).toBe("unresolved");
    expect(Object.keys(photoAppearance(draft)).sort()).toEqual(["cooler", "motherboard"]);
    // The confirmed case keeps the photo's fans as an appearance note.
    expect(photoFans(draft)).toMatchObject({ count: 5, color: "white", lightColor: "blue" });
  });

  it("never picks a tied candidate by name", () => {
    const suggested = suggestParts(createWhiteSketchFixture(), {}, 2500);
    const rows = Object.fromEntries(suggested.changes.map((row) => [row.category, row]));
    expect(suggested.reviews.case).toBeUndefined();
    expect(rows.case.partName).toBeNull();
    expect(rows.case.match).toBe("5 options equally likely");
    expect(rows.case.equallyLikely).toHaveLength(5);
    expect(rows.case.appearance).toMatch(/^Choose one in the review; drawn from the photo/);
    expect(rows.gpu.match).toBe("5 options equally likely");
    // A tied category the user already decided keeps that choice.
    const sets = matchVisualCandidates(createWhiteSketchFixture());
    const cases = sets.find((set) => set.category === "case")!;
    const h5 = cases.candidates.find((item) => /H5 Flow/.test(item.displayName))!;
    const chosen = suggestParts(
      createWhiteSketchFixture(),
      { case: chooseCandidate(cases, emptyCandidateReview(), h5.partId) },
      2500,
    );
    expect(chosen.reviews.case?.chosenPartId).toBe(h5.partId);
  });

  it("skips a candidate the user excluded", () => {
    const analysis = createGlassFrontFixture();
    const first = suggestParts(analysis, {}, 2500);
    const top = first.reviews.case!.chosenPartId!;
    const second = suggestParts(
      analysis,
      { case: { status: "unknown", excludedPartIds: [top] } },
      2500,
    );
    // The excluded part is never filled in; the white cases left tie, so none is picked.
    expect(second.reviews.case?.chosenPartId).toBeUndefined();
    expect(second.changes.find((row) => row.category === "case")?.decision).toBe("tie");
    expect(second.changes.find((row) => row.category === "case")?.equallyLikely).not.toContain(
      first.changes.find((row) => row.category === "case")?.partName,
    );
  });
});

describe("case front panel (manufacturer pages, verified 2026-10-26)", () => {
  it("ranks the glass-front O11 first, drops the mesh-front H5 Flow and keeps the unknown 4000D", () => {
    const cases = matchVisualCandidates(createGlassFrontFixture()).find(
      (set) => set.category === "case",
    )!;
    const names = cases.candidates.map((item) => item.displayName);
    expect(names[0]).toBe("Lian Li O11 Dynamic EVO (White)");
    expect(names).toContain("Corsair 4000D Airflow (White)");
    expect(names).not.toContain("NZXT H5 Flow (White)");
    expect(cases.candidates[0].matchedSignals).toContain(
      "Front panel: glass (manufacturer page, verified 2026-10-26)",
    );
    expect(equallyLikelyCandidates(cases, emptyCandidateReview())).toEqual([]);
  });

  it("reports a tie when the photo does not show the front", () => {
    const cases = matchVisualCandidates(createWhiteSketchFixture()).find(
      (set) => set.category === "case",
    )!;
    expect(equallyLikelyCandidates(cases, emptyCandidateReview())).toHaveLength(5);
    // Excluding one leaves the other four tied.
    const review = { status: "unknown" as const, excludedPartIds: [cases.candidates[0].partId] };
    expect(equallyLikelyCandidates(cases, review)).toHaveLength(4);
  });

  it("records only what each manufacturer page states", () => {
    expect(caseAppearance["showcase-case-lianli-o11dew"]).toMatchObject({
      frontPanel: "glass",
      layout: "dual-chamber",
      verifiedAt: "2026-10-26",
    });
    expect(caseAppearance["showcase-case-nzxt-cc-h52fw-01"].frontPanel).toBe("mesh");
    expect(caseAppearance["showcase-case-corsair-cc-9011201-ww"].frontPanel).toBeNull();
    for (const entry of Object.values(caseAppearance))
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
  });
});
