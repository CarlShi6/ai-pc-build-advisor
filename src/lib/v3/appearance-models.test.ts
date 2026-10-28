import { describe, expect, it } from "vitest";
import {
  appearanceParamsSchema,
  unknownAppearance,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";
import {
  APPEARANCE_PARAMS_LABEL,
  caseLookModel,
  caseTypicalMm,
  coolerLookModel,
  gpuLookModel,
  memoryLookModel,
} from "@/lib/v3/appearance-models";
import { ANCHOR_MM, type ReferenceModel } from "@/lib/v3/reference-models";
import type { Point } from "@/lib/v3/scene-focus";
import { createDraft } from "@/lib/v3/build-document";
import { scenePresentation } from "@/lib/v3/scene-presentation";

function params(patch: {
  [K in keyof AppearanceParams]?: Partial<AppearanceParams[K]>;
}): AppearanceParams {
  const merged = Object.fromEntries(
    Object.entries(unknownAppearance).map(([key, value]) => [
      key,
      { ...value, ...(patch[key as keyof AppearanceParams] ?? {}) },
    ]),
  );
  return appearanceParamsSchema.parse(merged);
}

const ids = (model: ReferenceModel, pattern: RegExp) =>
  model.parts.filter((part) => pattern.test(part.id));
/** A GPU's fans: its rotor-shaped blade parts. */
const rotors = (model: ReferenceModel) => model.parts.filter((part) => part.shape === "rotor");

/** A cooler part's centre in the case frame (cooler models are placed off the cooler anchor). */
const inCase = (point: Point): Point =>
  point.map((value, k) => value + ANCHOR_MM.cooler[k]) as Point;

/** True when every part of `model` (in the case frame) lies inside a case of `caseMm`. */
function insideCase(model: ReferenceModel, caseMm: Point, offset: (point: Point) => Point) {
  return model.parts.every((part) =>
    [0, 1, 2].every(
      (k) => Math.abs(offset(part.positionMm)[k]) + part.sizeMm[k] / 2 <= caseMm[k] / 2 + 0.5,
    ),
  );
}

const showcase = params({
  case: { type: "dual-chamber", color: "white", glass: "both", orientation: "upright" },
  gpu: { fanCount: "3", length: "long", color: "white", mount: "vertical", light: "blue" },
  cooler: {
    type: "aio",
    radiatorSize: "360",
    radiatorPosition: "top",
    pumpStyle: "round",
    color: "white",
  },
  fans: { side: "3", bottom: "2", ringColor: "blue" },
});
const tower = params({
  case: { type: "mesh-front-mid-tower", color: "black", glass: "side" },
  gpu: { fanCount: "2", length: "medium", color: "black", light: "none" },
  cooler: { type: "air-tower", color: "black" },
  fans: { front: "3", rear: "1", ringColor: "white" },
  memory: { sticks: "2", lightBar: "no", color: "black" },
});
const itx = params({
  case: { type: "itx", color: "white", glass: "side" },
  gpu: { fanCount: "1", length: "short" },
  cooler: { type: "aio", radiatorSize: "240", radiatorPosition: "front", pumpStyle: "screen" },
  fans: { top: "2" },
});

describe("parametric look-alikes (Step A)", () => {
  it("white dual-chamber, vertical three-fan GPU, top 360 AIO", () => {
    const caseMm = caseTypicalMm(showcase);
    const shell = caseLookModel(showcase);
    expect(shell.envelopeMm).toEqual(caseMm);
    expect(ids(shell, /^front-glass$|^glass-side-panel$/)).toHaveLength(2);
    expect(ids(shell, /^tray-divider$/)).toHaveLength(1);
    expect(ids(shell, /^case-fan-side-\d+-rotor$/)).toHaveLength(3);
    expect(ids(shell, /^case-fan-bottom-\d+-rotor$/)).toHaveLength(2);
    // The top holds the radiator, so no case fans are drawn there.
    expect(ids(shell, /^case-fan-top-/)).toHaveLength(0);
    expect(insideCase(shell, caseMm, (point) => point)).toBe(true);

    const gpu = gpuLookModel(showcase);
    expect(rotors(gpu)).toHaveLength(3);
    expect(ids(gpu, /^light-strip$/)).toHaveLength(1);
    expect(gpu.materials["shroud-white"].color).toBe("#e9ebee");
    const draft = createDraft("image", {
      imageContext: {
        referenceImageId: "x",
        analysisId: "x",
        imageStored: false,
        observations: [],
        appearance: showcase,
        reviews: {},
        visualPriorities: [],
        plannedSelections: {},
      },
    });
    expect(scenePresentation(draft).gpuVertical).toBe(true);

    const aio = coolerLookModel(showcase, caseMm)!;
    expect(ids(aio, /^fan-\d+-rotor$/)).toHaveLength(3);
    const radiator = ids(aio, /^radiator-core$/)[0];
    expect(radiator.sizeMm[0]).toBe(360 + 36 - 40); // three 120 mm fans plus tanks, along x
    // Under the top panel, inside the case.
    expect(inCase(radiator.positionMm)[1]).toBeGreaterThan(caseMm[1] / 2 - 60);
    expect(insideCase(aio, caseMm, inCase)).toBe(true);
    expect(ids(aio, /^pump-body$/)[0].shape).toBe("cylinder");
  });

  it("black mesh mid-tower, two-fan GPU, air tower, two plain sticks", () => {
    const caseMm = caseTypicalMm(tower);
    const shell = caseLookModel(tower);
    expect(ids(shell, /^front-panel$/)[0].material).toBe("front-mesh");
    expect(ids(shell, /^front-glass$/)).toHaveLength(0);
    expect(ids(shell, /^psu-shroud$/)).toHaveLength(1);
    expect(ids(shell, /^case-fan-front-\d+-rotor$/)).toHaveLength(3);
    expect(ids(shell, /^case-fan-rear-\d+-rotor$/)).toHaveLength(1);
    expect(shell.materials["panel-white"].color).toBe("#1f2124");
    expect(insideCase(shell, caseMm, (point) => point)).toBe(true);

    expect(rotors(gpuLookModel(tower))).toHaveLength(2);
    expect(ids(gpuLookModel(tower), /^light-strip$/)).toHaveLength(0);

    const cooler = coolerLookModel(tower, caseMm)!;
    expect(ids(cooler, /^tower-fins$/)).toHaveLength(1);
    expect(ids(cooler, /^radiator-core$/)).toHaveLength(0);
    expect(ids(cooler, /^heat-pipe-/)).toHaveLength(4);
    expect(insideCase(cooler, caseMm, inCase)).toBe(true);

    const memory = memoryLookModel(tower);
    expect(ids(memory, /-heatspreader$/)).toHaveLength(2);
    expect(ids(memory, /-light-bar$/)).toHaveLength(0);
  });

  it("ITX, short one-fan GPU, front 240 AIO with a screen", () => {
    const caseMm = caseTypicalMm(itx);
    expect(caseMm[0]).toBeLessThan(caseTypicalMm(tower)[0]);
    const aio = coolerLookModel(itx, caseMm)!;
    expect(ids(aio, /^fan-\d+-rotor$/)).toHaveLength(2);
    expect(ids(aio, /^pump-screen$/)).toHaveLength(1);
    // A front radiator stands upright behind the front panel.
    const radiator = ids(aio, /^radiator-core$/)[0];
    expect(radiator.sizeMm[1]).toBeGreaterThan(radiator.sizeMm[0]);
    expect(inCase(radiator.positionMm)[0]).toBeGreaterThan(caseMm[0] / 2 - 60);
    // The front holds the radiator; the two top fans are drawn.
    const shell = caseLookModel(itx);
    expect(ids(shell, /^case-fan-front-/)).toHaveLength(0);
    expect(ids(shell, /^case-fan-top-\d+-rotor$/)).toHaveLength(2);
    expect(rotors(gpuLookModel(itx))).toHaveLength(1);
  });

  it("all unknown: typical values, no case fans guessed, never a model name", () => {
    const shell = caseLookModel(unknownAppearance);
    expect(ids(shell, /^case-fan-/)).toHaveLength(0);
    expect(ids(shell, /^glass-side-panel$/)).toHaveLength(1);
    expect(rotors(gpuLookModel(unknownAppearance))).toHaveLength(2);
    expect(coolerLookModel(unknownAppearance, caseTypicalMm(unknownAppearance))).toBeNull();
    for (const model of [
      shell,
      gpuLookModel(unknownAppearance),
      memoryLookModel(unknownAppearance),
    ]) {
      expect(model.assumptions?.[0]).toMatch(/Typical proportions/);
      expect(model.partId).toMatch(/^appearance-/);
    }
    expect(APPEARANCE_PARAMS_LABEL).toBe("Appearance from photo · proportions estimated");
  });

  it("rejects anything outside the enums: unknown is the only way to say 'not visible'", () => {
    expect(() => params({ gpu: { fanCount: "4" as never } })).toThrow();
    expect(() => appearanceParamsSchema.parse({ ...unknownAppearance, extra: true })).toThrow();
  });
});
