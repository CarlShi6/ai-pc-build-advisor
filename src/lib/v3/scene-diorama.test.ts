import { describe, expect, it } from "vitest";
import { createDraft } from "@/lib/v3/build-document";
import { caseGrommetsMm, referenceModelFor } from "@/lib/v3/reference-models";
import { sceneCables } from "@/lib/v3/scene-cables";
import {
  DIORAMA_REMOVED_PANELS,
  DIORAMA_VIEW,
  PLINTH_MARGIN,
  PLINTH_THICKNESS,
  dioramaProps,
  plinthBox,
} from "@/lib/v3/scene-diorama";
import { sceneBoxes } from "@/lib/v3/scene-explode";
import { createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";

const sample = createWhiteShowcaseSample();
const caseBox = sceneBoxes(sample).case;
const lowest = (box: typeof caseBox) => box.centre[1] - box.size[1] / 2;

describe("diorama set", () => {
  it("looks down about 30 degrees from between the front and the open glass side", () => {
    const [x, y, z] = DIORAMA_VIEW;
    expect((Math.asin(y) * 180) / Math.PI).toBeCloseTo(30, 5);
    expect(x).toBeCloseTo(z, 5);
    expect(x).toBeGreaterThan(0);
    expect(DIORAMA_REMOVED_PANELS.sort()).toEqual(["front", "glass"]);
  });

  it("puts a 25 mm plinth under the case, wider than its footprint on every side", () => {
    const plinth = plinthBox(caseBox, lowest(caseBox));
    expect(PLINTH_THICKNESS * 150).toBeCloseTo(25, 5);
    expect(plinth.centre[1] + plinth.size[1] / 2).toBeCloseTo(lowest(caseBox), 5);
    for (const k of [0, 2])
      expect(plinth.size[k]).toBeCloseTo(caseBox.size[k] + 2 * PLINTH_MARGIN, 5);
    // Exploded parts below the case push the plinth down under them.
    const lower = plinthBox(caseBox, lowest(caseBox) - 1);
    expect(lower.centre[1] + lower.size[1] / 2).toBeLessThan(lowest(caseBox) - 1);
  });

  it("places the two props on the plinth top, clear of the case", () => {
    const plinth = plinthBox(caseBox, lowest(caseBox));
    const props = dioramaProps(plinth, caseBox);
    for (const point of [props.plant, props.cable]) {
      expect(point[1]).toBeCloseTo(plinth.centre[1] + plinth.size[1] / 2, 5);
      const insideCase = [0, 2].every(
        (k) => Math.abs(point[k] - caseBox.centre[k]) < caseBox.size[k] / 2 + props.footprint,
      );
      expect(insideCase).toBe(false);
      for (const k of [0, 2])
        expect(Math.abs(point[k] - plinth.centre[k]) + props.footprint).toBeLessThan(
          plinth.size[k] / 2,
        );
    }
  });
});

describe("assembled power cables", () => {
  it("routes the 24-pin and the GPU 16-pin from their connectors into tray grommets", () => {
    const cables = sceneCables(sample);
    expect(cables.map((cable) => cable.id)).toEqual(["atx-24-pin", "gpu-16-pin"]);
    const grommets = caseGrommetsMm(referenceModelFor("showcase-case-lianli-o11dew")!).map((mm) =>
      mm.map((value) => value / 150),
    );
    for (const cable of cables) {
      expect(cable.points.length).toBeGreaterThanOrEqual(4);
      const end = cable.points.at(-1)!;
      expect(grommets.some((g) => g.every((value, k) => Math.abs(value - end[k]) < 1e-9))).toBe(
        true,
      );
      // Inside the case the whole way.
      for (const point of cable.points)
        for (const k of [0, 1, 2])
          expect(Math.abs(point[k] - caseBox.centre[k])).toBeLessThan(caseBox.size[k] / 2);
    }
  });

  it("draws no cables without reference models to connect", () => {
    expect(sceneCables(createDraft("describe"))).toEqual([]);
  });
});
