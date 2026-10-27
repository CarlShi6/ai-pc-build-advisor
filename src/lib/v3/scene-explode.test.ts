import { describe, expect, it } from "vitest";
import { showcaseParts } from "@/data/showcaseParts";
import {
  catalogForSlot,
  createDraft,
  primarySlots,
  selectPart,
  type BuildDocumentV3,
} from "@/lib/v3/build-document";
import { referenceModelFor } from "@/lib/v3/reference-models";
import {
  EXPLODE_GAP,
  boxesIntersect,
  casePanelOf,
  explodeDirection,
  explodeDistances,
  explodeOffset,
  sceneBoxes,
  shiftBox,
  type ExplodeId,
} from "@/lib/v3/scene-explode";
import { createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";

function exploded(document: BuildDocumentV3, amount: number) {
  const boxes = sceneBoxes(document);
  const distances = explodeDistances(boxes);
  return Object.entries(boxes).map(([id, box]) => ({
    id,
    box: shiftBox(box, explodeOffset(id as ExplodeId, distances, amount)),
    assembled: box,
  }));
}

const showcase = createWhiteShowcaseSample();
const nzxtCase = showcaseParts.find((part) => part.id === "showcase-case-nzxt-cc-h52fw-01")!;
const documents: [string, BuildDocumentV3][] = [
  ["white showcase sample (reference O11 and parts)", showcase],
  ["spec-envelope case with a PSU shroud", selectPart(showcase, "case", nzxtCase)],
  ["empty build (generic placeholders)", createDraft("describe")],
  [
    "catalog parts (generic geometry)",
    createDraft("describe", { parts: primarySlots.map((slot) => catalogForSlot(slot)[0]) }),
  ],
];

describe("exploded view layout (E1)", () => {
  it.each(documents)("%s: at 100%% no two boxes intersect", (_, document) => {
    const items = exploded(document, 1);
    expect(items.length).toBeGreaterThanOrEqual(13);
    for (const [index, a] of items.entries())
      for (const b of items.slice(index + 1)) {
        expect(boxesIntersect(a.box, b.box), `${a.id} vs ${b.id}`).toBe(false);
        // The gap holds too, so nothing even touches.
        const grown = { ...a.box, size: a.box.size.map((v) => v + EXPLODE_GAP * 1.9) };
        expect(boxesIntersect(grown as typeof a.box, b.box), `${a.id} near ${b.id}`).toBe(false);
      }
  });

  it.each(documents)("%s: at 0%% everything is back in its assembled place", (_, document) => {
    for (const item of exploded(document, 0)) expect(item.box).toEqual(item.assembled);
  });

  it("moves every part out of the case and every panel along its outer normal", () => {
    const items = exploded(showcase, 1);
    const frame = items.find((item) => item.id === "case")!;
    expect(frame.box).toEqual(frame.assembled);
    for (const item of items.filter((entry) => entry.id !== "case")) {
      expect(boxesIntersect(item.box, frame.box), item.id).toBe(false);
      const moved = item.box.centre.map((value, k) => value - item.assembled.centre[k]);
      const along = moved.reduce(
        (sum, value, k) => sum + value * explodeDirection[item.id as ExplodeId][k],
        0,
      );
      expect(along, item.id).toBeGreaterThan(0);
    }
    expect(explodeDirection.top).toEqual([0, 1, 0]);
    expect(explodeDirection.glass).toEqual([0, 0, 1]);
    expect(explodeDirection.back).toEqual([0, 0, -1]);
    expect(explodeDirection.front).toEqual([1, 0, 0]);
    expect(explodeDirection.motherboard).toEqual([-1, 0, 0]);
    expect(explodeDirection.psu[1]).toBeLessThan(-0.8);
  });

  it("interpolates continuously between 0% and 100%", () => {
    const distances = explodeDistances(sceneBoxes(showcase));
    const half = explodeOffset("gpu", distances, 0.5);
    const full = explodeOffset("gpu", distances, 1);
    half.forEach((value, k) => expect(value).toBeCloseTo(full[k] / 2));
    expect(explodeOffset("gpu", distances, 2)).toEqual(full);
    expect(explodeOffset("gpu", distances, -1)).toEqual([0, 0, 0]);
  });

  it("splits the reference O11 into glass side, solid side, front, top and frame", () => {
    const model = referenceModelFor("showcase-case-lianli-o11dew")!;
    const panel = (id: string) => casePanelOf(model.parts.find((part) => part.id === id)!, model);
    expect(panel("side-glass")).toBe("glass");
    expect(panel("solid-side-panel")).toBe("back");
    expect(panel("front-glass")).toBe("front");
    expect(panel("top-panel")).toBe("top");
    expect(panel("interior-bottom-tray")).toBe("shroud");
    expect(panel("case-root")).toBeNull();
    expect(panel("rear-panel")).toBeNull();
  });
});
