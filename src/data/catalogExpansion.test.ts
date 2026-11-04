import { describe, expect, it } from "vitest";
import { expansionParts } from "@/data/catalogExpansion";
import { seedParts } from "@/data/seedParts";
import { caseAppearance } from "@/data/showcaseParts";
import { unknownAppearance, type AppearanceParams } from "@/lib/v3/appearance-params";
import {
  chooseCandidate,
  emptyCandidateReview,
  matchVisualCandidates,
} from "@/lib/v3/candidate-matcher";
import { COLOR_FROM_MAKER_PHOTO, colorSourceNote, v3Catalog } from "@/lib/v3/catalog";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { createImageAnalysisResult } from "@/lib/v3/image-contract";
import { suggestParts } from "@/lib/v3/image-build";
import { buildShoppingPlan } from "@/lib/v3/shopping-plan";
import { createDraft } from "@/lib/v3/build-document";

// Step C: manufacturer-sourced catalog expansion, colour sources and memory matching.
describe("Step C catalog expansion", () => {
  it("cites the manufacturer page, a colour source and never a $0 price", () => {
    expect(expansionParts).toHaveLength(18);
    for (const part of expansionParts) {
      expect(new URL(part.productUrl!).protocol).toBe("https:");
      expect(part.colorSource).toMatch(/^maker_(text|image)$/);
      if (part.colorSource === "maker_image") expect(part.colorSourceUrl).toMatch(/^https:/);
      if (part.priceStatus === "unknown") expect(part.priceSource).toBeUndefined();
      else expect(part.priceSource?.label).toBe("Manufacturer store price, verified 2026-10-28");
    }
    expect(new Set(v3Catalog.map((part) => part.id)).size).toBe(v3Catalog.length);
  });

  it("labels a colour known only from maker photos, and nothing else", () => {
    const boards = seedParts.filter((part) => part.category === "motherboard");
    expect(boards).toHaveLength(5);
    for (const board of boards) {
      expect(board.color).toBe("Black");
      expect(colorSourceNote(board)).toBe(COLOR_FROM_MAKER_PHOTO);
    }
    const aero = v3Catalog.find((part) => part.id === "maker-gpu-gigabyte-gv-n507taero-oc-16gd")!;
    expect(colorSourceNote(aero)).toBe("Color from maker photo");
    const tufWhite = v3Catalog.find(
      (part) => part.id === "maker-gpu-asus-tuf-rtx5070ti-o16g-white-gaming",
    )!;
    expect(colorSourceNote(tufWhite)).toBeNull();
    const plan = buildShoppingPlan(createDraft("describe", { parts: [aero, tufWhite] }));
    expect(plan.lines.find((line) => line.slot === "gpu")?.colorNote).toBe(
      "Color from maker photo",
    );
  });
});

function withMemory(memory: AppearanceParams["memory"]) {
  return createImageAnalysisResult(
    {
      summary: "Reference PC",
      quality: "clear",
      qualityIssues: [],
      observations: [],
      appearance: { ...unknownAppearance, memory },
    },
    { mime: "image/png", width: 512, height: 512 },
  );
}

const memorySet = (memory: AppearanceParams["memory"]) =>
  matchVisualCandidates(withMemory(memory)).find((set) => set.category === "memory");

describe("memory matching (colour and light bar from the photo look)", () => {
  it("ranks white RGB kits first for white sticks with a light bar", () => {
    const set = memorySet({ sticks: "2", lightBar: "yes", color: "white" })!;
    expect(set.status).toBe("candidates");
    expect(set.candidates.every((item) => /White/.test(item.displayName))).toBe(true);
    expect(set.candidates[0].matchedSignals).toEqual([
      "Color: white (photo look)",
      "Light bar: yes (catalog: RGB)",
    ]);
  });

  it("rules out other colours but not on a missing light bar", () => {
    const black = memorySet({ sticks: "2", lightBar: "no", color: "black" })!;
    expect(black.candidates.some((item) => /White/.test(item.displayName))).toBe(false);
    expect(black.candidates.map((item) => item.partId)).toContain(
      "maker-ram-corsair-cmh32gx5m2e6000c36",
    );
  });

  it("is left out when the photo says nothing about memory", () => {
    expect(memorySet({ sticks: "2", lightBar: "unknown", color: "unknown" })).toBeUndefined();
  });

  it("stays a candidate: two white kits tie, and only the user's pick fills the slot", () => {
    const analysis = withMemory({ sticks: "2", lightBar: "yes", color: "white" });
    const before = createDraft("blank");
    const suggested = suggestParts(analysis, {}, null, before);
    expect(suggested.changes.find((item) => item.category === "memory")?.decision).toBe("tie");
    expect(suggested.reviews.memory).toBeUndefined();
    expect(before.build.parts).toHaveLength(0);
    const set = memorySet({ sticks: "2", lightBar: "yes", color: "white" })!;
    const pick = set.candidates[1];
    const chosen = suggestParts(
      analysis,
      { memory: chooseCandidate(set, emptyCandidateReview(), pick.partId) },
      null,
      before,
    );
    expect(chosen.proposal.selected).toEqual([
      { slot: "memory", partId: pick.partId, name: pick.displayName },
    ]);
  });
});

function withLook(look: Partial<AppearanceParams>) {
  return createImageAnalysisResult(
    {
      summary: "Reference PC",
      quality: "clear",
      qualityIssues: [],
      observations: [],
      appearance: { ...unknownAppearance, ...look },
    },
    { mime: "image/png", width: 512, height: 512 },
  );
}

const lookSet = (look: Partial<AppearanceParams>, category: string) =>
  matchVisualCandidates(withLook(look)).find((set) => set.category === category);

describe("appearance parameters against recorded manufacturer data", () => {
  const aio = { ...unknownAppearance.cooler, type: "aio" as const, color: "white" as const };

  it("ranks the AIOs whose maker page names a pump screen first, without ruling out the unknown", () => {
    const set = lookSet(
      { cooler: { ...aio, radiatorSize: "360", pumpStyle: "screen" } },
      "cooler",
    )!;
    const top = set.candidates.filter(
      (item) => item.evidenceScore === set.candidates[0].evidenceScore,
    );
    expect(top.map((item) => item.displayName).sort()).toEqual([
      "Lian Li Galahad II LCD 360 (White)",
      "Lian Li HydroShift LCD 360S (White)",
      "NZXT Kraken Elite 360 RGB (White)",
    ]);
    expect(top[0].matchedSignals).toContain("Pump screen (photo look; manufacturer page)");
    // TITAN's page names no screen: unknown, so it stays in, one point behind.
    expect(set.candidates.map((item) => item.displayName)).toContain(
      "Corsair iCUE LINK TITAN 360 RX RGB AIO (White)",
    );
  });

  it("rules out only what the manufacturer data contradicts", () => {
    const plainCap = lookSet({ cooler: { ...aio, pumpStyle: "round" } }, "cooler")!;
    expect(plainCap.candidates.some((item) => /LCD|Elite/.test(item.displayName))).toBe(false);
    const air = lookSet({ cooler: { ...aio, type: "air-tower", color: "black" } }, "cooler")!;
    expect(air.candidates[0].displayName).toBe("DeepCool AK620 ZERO DARK");
    expect(air.candidates.some((item) => /AIO|LCD/.test(item.displayName))).toBe(false);
    const short = lookSet({ gpu: { ...unknownAppearance.gpu, length: "short" } }, "gpu")!;
    // Every recorded white card is 300 mm or longer; seed cards have no maker length, so stay.
    expect(short.candidates.some((item) => /AERO|TUF|PRIME|TRIO/.test(item.displayName))).toBe(
      false,
    );
    const mesh = lookSet(
      { case: { ...unknownAppearance.case, type: "mesh-front-mid-tower" } },
      "case",
    )!;
    expect(mesh.candidates.map((item) => item.displayName)).not.toContain(
      "Lian Li O11 Dynamic EVO (White)",
    );
    expect(mesh.candidates[0].displayName).toBe("NZXT H5 Flow (White)");
  });

  it("never counts a fact twice when an observation already did", () => {
    const set = matchVisualCandidates(createGlassFrontFixture()).find(
      (item) => item.category === "case",
    )!;
    const signals = set.candidates[0].matchedSignals;
    expect(signals.filter((item) => item.startsWith("Front panel")).length).toBe(1);
    expect(signals.filter((item) => item.startsWith("Color")).length).toBe(1);
  });
});

describe("Step C case layout (manufacturer pages, verified 2026-11-04)", () => {
  it("ranks the dual-chamber cases its pages name right behind the O11", () => {
    for (const id of Object.keys(caseAppearance))
      expect(v3Catalog.some((part) => part.id === id)).toBe(true);
    const cases = matchVisualCandidates(createGlassFrontFixture()).find(
      (set) => set.category === "case",
    )!;
    const names = cases.candidates.map((item) => item.displayName);
    expect(names.slice(1, 4).sort()).toEqual([
      "HYTE Y60 (Snow White)",
      "MONTECH KING 95 (Pure White)",
      "NZXT H9 Flow (White)",
    ]);
    // KING 95 ships with a glass and a mesh front, so the front stays unknown.
    expect(caseAppearance["maker-case-montech-king-95-white"].frontPanel).toBeNull();
    expect(caseAppearance["maker-case-phanteks-ph-nv523tg-dmw01"].layout).toBeNull();
  });
});
