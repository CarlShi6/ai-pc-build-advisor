import { describe, expect, it } from "vitest";
import { curatedFans } from "@/data/curatedFans";
import { createImageAnalysisResult, type ObservationDraft } from "@/lib/v3/image-contract";
import { matchVisualCandidates } from "@/lib/v3/candidate-matcher";

const manufacturerDomains: Record<string, string> = {
  "Lian Li": "lian-li.com",
  Corsair: "corsair.com",
  NZXT: "nzxt.com",
  ARCTIC: "arctic.de",
  "be quiet!": "bequiet.com",
  Phanteks: "phanteks.com",
};

function fanAnalysis(observations: Array<[string, string]>) {
  return createImageAnalysisResult(
    {
      summary: "White showcase PC",
      quality: "clear",
      qualityIssues: [],
      observations: observations.map(([attribute, value]) => ({
        category: "fan" as ObservationDraft["observations"][number]["category"],
        attribute,
        value,
        evidence: `Front fans: ${value}`,
        origin: "observed" as const,
        confidenceBand: "medium" as const,
        visibleInImage: true,
        region: null,
      })),
    },
    { mime: "image/png", width: 512, height: 512 },
  );
}

describe("hand-curated case fans", () => {
  it("cite the manufacturer's own page and a verification date for every entry", () => {
    expect(curatedFans.length).toBeGreaterThanOrEqual(10);
    for (const fan of curatedFans) {
      const url = new URL(fan.sourceUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname.endsWith(manufacturerDomains[fan.brand])).toBe(true);
      expect(fan.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("have unique identities, real sizes and no invented prices", () => {
    expect(new Set(curatedFans.map((fan) => fan.id)).size).toBe(curatedFans.length);
    expect(new Set(curatedFans.map((fan) => fan.partNumber)).size).toBe(curatedFans.length);
    for (const fan of curatedFans) {
      expect([120, 140]).toContain(fan.sizeMm);
      expect(fan.dimensionsAsPublished).toContain(String(fan.sizeMm));
      expect(fan).not.toHaveProperty("price");
    }
    // Unclear or conflicting manufacturer values stay unknown.
    expect(curatedFans.find((fan) => fan.partNumber === "CO-9051021-WW")?.maxAirflowCfm).toBeNull();
    expect(curatedFans.find((fan) => fan.partNumber === "ACFAN00254A")?.maxNoiseDba).toBeNull();
  });

  it("cover both white and black 120 and 140 mm lit fans for style matching", () => {
    for (const color of ["white", "black"] as const)
      for (const size of [120, 140] as const)
        expect(curatedFans.some((fan) => fan.color === color && fan.sizeMm === size)).toBe(true);
  });

  it("match a white lit fan photo to white fans only, as appearance-only alternatives", () => {
    const fans = matchVisualCandidates(
      fanAnalysis([
        ["color", "white"],
        ["lighting", "RGB rings"],
      ]),
    ).find((set) => set.category === "fan")!;
    expect(fans.status).toBe("candidates");
    expect(fans.candidates.length).toBeGreaterThan(1);
    expect(fans.candidates.length).toBeLessThanOrEqual(5);
    for (const candidate of fans.candidates) {
      const fan = curatedFans.find((item) => item.id === candidate.partId)!;
      expect(fan.color).toBe("white");
      expect(candidate.identityEvidence).toBe("appearance_only");
      expect(candidate.catalogSourceId).toBe(`curatedFans:${fan.id}`);
      expect(candidate.catalogSourceUrl).toBe(fan.sourceUrl);
      expect(candidate.catalogVerifiedAt).toBe(fan.verifiedAt);
    }
    expect(fans.explanation).toContain("not one of the eight Build slots");
  });

  it("does not treat unlit fans as a lighting match", () => {
    const fans = matchVisualCandidates(fanAnalysis([["lighting", "no lighting, unlit fans"]])).find(
      (set) => set.category === "fan",
    )!;
    expect(fans.status).toBe("unresolved");
  });
});
