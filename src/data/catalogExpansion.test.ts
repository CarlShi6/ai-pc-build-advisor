import { describe, expect, it } from "vitest";
import { expansionParts } from "@/data/catalogExpansion";
import { seedParts } from "@/data/seedParts";
import { unknownAppearance, type AppearanceParams } from "@/lib/v3/appearance-params";
import {
  chooseCandidate,
  emptyCandidateReview,
  matchVisualCandidates,
} from "@/lib/v3/candidate-matcher";
import { COLOR_FROM_MAKER_PHOTO, colorSourceNote, v3Catalog } from "@/lib/v3/catalog";
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
