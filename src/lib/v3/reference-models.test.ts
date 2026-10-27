import { describe, expect, it } from "vitest";
import { showcaseMeta, showcaseParts } from "@/data/showcaseParts";
import { createDraft, selectPart } from "@/lib/v3/build-document";
import {
  MM_PER_SCENE_UNIT,
  REFERENCE_MODEL_LABEL,
  referenceModelFor,
  referenceModelSlots,
  referenceModels,
  sceneCentre,
  sceneSize,
  type ReferenceModelPart,
} from "@/lib/v3/reference-models";

const within = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(tolerance);

describe("per-SKU reference models (demo track week 3)", () => {
  it("covers the showcase cases and GPUs with millimetres plus the slice D parts, and nothing else", () => {
    const withMm = showcaseParts.filter(
      (part) => ["case", "gpu"].includes(part.category) && showcaseMeta[part.id]?.dimensions?.mm,
    );
    expect(referenceModels.map((model) => model.partId).sort()).toEqual(
      [
        ...withMm.map((part) => part.id),
        "showcase-cooler-corsair-cw-9061021-ww",
        "showcase-ram-corsair-cmh32gx5m2b6000c30w",
        "mobo-z790-hero",
      ].sort(),
    );
    // No published size, so no model: the PSU stays generic.
    expect(referenceModelFor("showcase-psu-corsair-cp-9020274-na")).toBeNull();
  });

  it("is labeled as a reference reconstruction, never a real model", () => {
    expect(REFERENCE_MODEL_LABEL).toBe(
      "Reference reconstruction · dimensions from manufacturer specs",
    );
    for (const model of referenceModels)
      expect(model.geometryAccuracy).toBe("reference_reconstructed");
  });

  it("matches the published case envelope 1:1 (depth, height, width)", () => {
    for (const model of referenceModels.filter((item) => item.frame === "case" && !item.centreMm)) {
      const mm = showcaseMeta[model.partId].dimensions!.mm!;
      // The O11's glass border print stands up to 1.3 mm proud of its panels.
      within(model.envelopeMm[0], mm.depth, 0.01);
      within(model.envelopeMm[1], mm.height, 0.01);
      within(model.envelopeMm[2], mm.width, 0.01);
    }
  });

  it("matches the published GPU length and thickness 1:1; height adds only the PCIe bracket", () => {
    for (const model of referenceModels.filter((item) => item.frame === "gpu")) {
      const mm = showcaseMeta[model.partId].dimensions!.mm!;
      within(model.envelopeMm[0], mm.depth, 0.01); // thickness
      within(model.envelopeMm[2], mm.width, 0.015); // length, plus the bracket plate
      const card = model.parts.filter((part) => part.id !== "io-bracket");
      const top = Math.max(...card.map((part) => part.positionMm[1] + part.sizeMm[1] / 2));
      const bottom = Math.min(...card.map((part) => part.positionMm[1] - part.sizeMm[1] / 2));
      within(top - bottom, mm.height, 0.02);
    }
  });

  it("img2threejs models carry their credited passes", () => {
    const o11 = referenceModelFor("showcase-case-lianli-o11dew")!;
    const msi = referenceModelFor("showcase-gpu-msi-g507t-16gtcw")!;
    for (const model of [o11, msi]) {
      expect(model.source).toBe("img2threejs");
      expect(model.passes).toBe(8);
    }
    expect(referenceModelFor("showcase-gpu-asus-prime-rtx5070-o12g-white")!.source).toBe(
      "spec-envelope",
    );
  });

  it("sizes the scene slot in scene units, laying the GPU flat (length, thickness, height)", () => {
    const msi = referenceModelFor("showcase-gpu-msi-g507t-16gtcw")!;
    const [x, y, z] = sceneSize(msi);
    expect(x).toBeCloseTo(msi.envelopeMm[2] / MM_PER_SCENE_UNIT);
    expect(y).toBeCloseTo(msi.envelopeMm[0] / MM_PER_SCENE_UNIT);
    expect(z).toBeCloseTo(msi.envelopeMm[1] / MM_PER_SCENE_UNIT);
    expect(sceneSize(referenceModelFor("showcase-case-lianli-o11dew")!)[1]).toBeCloseTo(
      459 / 150,
      2,
    );
  });

  it("reports which slots of a build render as reference reconstructions", () => {
    const byId = (id: string) => showcaseParts.find((part) => part.id === id)!;
    let document = createDraft("blank");
    expect(referenceModelSlots(document)).toEqual([]);
    document = selectPart(document, "case", byId("showcase-case-lianli-o11dew"));
    document = selectPart(document, "psu", byId("showcase-psu-corsair-cp-9020274-na"));
    expect(referenceModelSlots(document)).toEqual(["case"]);
    document = selectPart(document, "gpu", byId("showcase-gpu-msi-g507t-16gtcw"));
    expect(referenceModelSlots(document)).toEqual(["case", "gpu"]);
  });
});

describe("slice D part models", () => {
  const model = (partId: string) => referenceModelFor(partId)!;
  const parts = (partId: string, prefix: string) =>
    model(partId).parts.filter((part) => part.id.startsWith(prefix));
  const span = (items: ReferenceModelPart[], axis: number) =>
    Math.max(...items.map((part) => part.positionMm[axis] + part.sizeMm[axis] / 2)) -
    Math.min(...items.map((part) => part.positionMm[axis] - part.sizeMm[axis] / 2));

  it("draws the AIO radiator at the published 396 mm with three 120 x 25 mm fans", () => {
    const id = "showcase-cooler-corsair-cw-9061021-ww";
    const radiator = model(id).parts.filter(
      (part) => part.id === "radiator-core" || part.id.startsWith("end-tank-"),
    );
    expect(span(radiator, 0)).toBeCloseTo(396);
    expect(model(id).parts.find((part) => part.id === "radiator-core")?.shape).toBe("fins");
    for (const index of [1, 2, 3]) {
      const fan = parts(id, `fan-${index}-frame`);
      expect(span(fan, 0)).toBeCloseTo(120);
      expect(span(fan, 2)).toBeCloseTo(120);
      expect(span(fan, 1)).toBeCloseTo(25);
      expect(parts(id, `fan-${index}-rotor`)[0].shape).toBe("rotor");
    }
    // A light ring on the pump and on each fan.
    expect(model(id).parts.filter((part) => part.shape === "ring")).toHaveLength(4);
  });

  it("draws each memory module at Corsair's 135 x 8 x 44 mm, light bar on top, in DIMM slots 2 and 4", () => {
    const id = "showcase-ram-corsair-cmh32gx5m2b6000c30w";
    const board = model("mobo-z790-hero");
    for (const slot of [2, 4]) {
      const module = parts(id, `module-${slot}-`);
      expect(span(module, 0)).toBeCloseTo(8);
      expect(span(module, 1)).toBeCloseTo(135);
      expect(span(module, 2)).toBeCloseTo(44);
      const bar = module.find((part) => part.id.endsWith("light-bar"))!;
      expect(bar.material).toBe("light");
      expect(bar.positionMm[2]).toBeGreaterThan(module[0].positionMm[2]);
      // Same world x as the board's slot (anchors are 0.83 scene units apart).
      const dimm = board.parts.find((part) => part.id === `dimm-slot-${slot}`)!;
      expect(bar.positionMm[0] + 0.58 * MM_PER_SCENE_UNIT).toBeCloseTo(
        dimm.positionMm[0] - 0.25 * MM_PER_SCENE_UNIT,
      );
    }
  });

  it("draws the ATX board at 244 x 305 mm with the page's 4 DIMM and 3 x16 slots", () => {
    const board = model("mobo-z790-hero");
    const pcb = board.parts.find((part) => part.id === "pcb")!;
    expect(pcb.sizeMm.slice(0, 2)).toEqual([244, 305]);
    expect(parts("mobo-z790-hero", "dimm-slot-")).toHaveLength(4);
    expect(parts("mobo-z790-hero", "pcie-x16-")).toHaveLength(3);
    expect(board.parts.filter((part) => /heatsink|io-shroud/.test(part.id)).length).toBeGreaterThan(
      2,
    );
  });

  it("gives every GPU three pitched rotors instead of flat blade discs", () => {
    for (const gpu of referenceModels.filter((item) => item.frame === "gpu")) {
      expect(gpu.parts.filter((part) => part.shape === "rotor")).toHaveLength(3);
      expect(gpu.assumptions?.join(" ")).toMatch(/blade count and shape are not published/);
    }
  });

  it("writes down what was estimated, draws no logos and keeps the envelope around every part", () => {
    for (const item of referenceModels) {
      expect(item.parts.some((part) => /logo|brand|badge|text/i.test(part.id))).toBe(false);
      if (item.source === "spec-envelope") expect(item.assumptions?.length).toBeGreaterThan(0);
      if (item.frame !== "case" || !item.centreMm) continue;
      for (const axis of [0, 1, 2])
        expect(span(item.parts, axis)).toBeCloseTo(item.envelopeMm[axis], 1);
    }
    // Off-anchor models report where their envelope sits, for the selection outline.
    expect(sceneCentre(model("showcase-cooler-corsair-cw-9061021-ww"))[1]).toBeGreaterThan(0);
    expect(sceneCentre(referenceModelFor("showcase-case-lianli-o11dew")!)).toEqual([0, 0, 0]);
  });
});
