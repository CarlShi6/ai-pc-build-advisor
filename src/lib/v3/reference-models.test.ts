import { describe, expect, it } from "vitest";
import { showcaseMeta, showcaseParts } from "@/data/showcaseParts";
import { createDraft, selectPart } from "@/lib/v3/build-document";
import {
  MM_PER_SCENE_UNIT,
  REFERENCE_MODEL_LABEL,
  referenceModelFor,
  referenceModelSlots,
  referenceModels,
  sceneSize,
} from "@/lib/v3/reference-models";

const within = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(tolerance);

describe("per-SKU reference models (demo track week 3)", () => {
  it("covers every white showcase case and GPU that publishes millimetres, and nothing else", () => {
    const withMm = showcaseParts.filter(
      (part) => ["case", "gpu"].includes(part.category) && showcaseMeta[part.id]?.dimensions?.mm,
    );
    expect(withMm.map((part) => part.id).sort()).toEqual(
      referenceModels.map((model) => model.partId).sort(),
    );
    for (const part of showcaseParts.filter((item) => !["case", "gpu"].includes(item.category)))
      expect(referenceModelFor(part.id)).toBeNull();
  });

  it("is labeled as a reference reconstruction, never a real model", () => {
    expect(REFERENCE_MODEL_LABEL).toBe(
      "Reference reconstruction · dimensions from manufacturer specs",
    );
    for (const model of referenceModels)
      expect(model.geometryAccuracy).toBe("reference_reconstructed");
  });

  it("matches the published case envelope 1:1 (depth, height, width)", () => {
    for (const model of referenceModels.filter((item) => item.frame === "case")) {
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
    document = selectPart(document, "memory", byId("showcase-ram-corsair-cmh32gx5m2b6000c30w"));
    expect(referenceModelSlots(document)).toEqual(["case"]);
    document = selectPart(document, "gpu", byId("showcase-gpu-msi-g507t-16gtcw"));
    expect(referenceModelSlots(document)).toEqual(["case", "gpu"]);
  });
});
