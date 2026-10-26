import { describe, expect, it } from "vitest";
import { createDraft, slotOccupancy } from "@/lib/v3/build-document";
import { createOgImageFixture, createWhiteSketchFixture } from "@/lib/v3/dev-image-fixture";
import { confirmImageBuild, proposeImageBuild, suggestParts } from "@/lib/v3/image-build";
import { appearanceSummary, photoAppearance } from "@/lib/v3/photo-appearance";

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
    const analysis = createWhiteSketchFixture();
    const before = createDraft("blank");
    const suggested = suggestParts(analysis, {}, 2500, before);
    expect(before.build.parts).toHaveLength(0);
    const rows = Object.fromEntries(suggested.changes.map((row) => [row.category, row]));
    expect(rows.case.partName).toMatch(/\(White\)$/);
    expect(rows.gpu.partName).toMatch(/White/);
    expect(rows.cooler.partName).toMatch(/White/);
    expect(rows.case.match).toBe("Weak visual match · appearance only");
    expect(rows.case.appearance).toBe("White, matches the photo");
    expect(rows.fan.price).toBe("Not counted");
    // No white motherboard in the catalog: it stays unresolved and is drawn from the photo.
    expect(rows.motherboard.partName).toBeNull();
    expect(rows.motherboard.appearance).toMatch(/drawn from the photo \(White/);
    expect(suggested.total.unknown).toBeGreaterThan(0);
    expect(suggested.compatibility).toMatch(/^Incomplete · 3 of 8 slots selected/);

    const draft = confirmImageBuild(suggested.proposal, before);
    expect(slotOccupancy(draft, "case")).toBe("selected");
    expect(slotOccupancy(draft, "gpu")).toBe("selected");
    expect(slotOccupancy(draft, "motherboard")).toBe("unresolved");
    expect(Object.keys(photoAppearance(draft))).toEqual(["motherboard"]);
  });

  it("skips a candidate the user excluded", () => {
    const analysis = createWhiteSketchFixture();
    const first = suggestParts(analysis, {}, 2500);
    const top = first.reviews.case!.chosenPartId!;
    const second = suggestParts(
      analysis,
      { case: { status: "unknown", excludedPartIds: [top] } },
      2500,
    );
    expect(second.reviews.case?.chosenPartId).toBeDefined();
    expect(second.reviews.case?.chosenPartId).not.toBe(top);
  });
});
