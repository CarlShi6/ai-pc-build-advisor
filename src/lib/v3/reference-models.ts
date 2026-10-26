import { generatedReferenceModels } from "@/data/referenceModels.generated";
import {
  selectedPart,
  primarySlots,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import type { Point } from "@/lib/v3/scene-focus";

/**
 * Per-SKU 3D models for the demo track (week 3), scaled 1:1 from the manufacturer's millimetre
 * dimensions. Two kinds share one shape:
 *
 * - `img2threejs`: reconstructed from manufacturer product images by the img2threejs pipeline
 *   (reference-models/<slug>/object-sculpt-spec.json, exported by tools/reference-models).
 * - `spec-envelope`: built directly from the published millimetre dimensions plus features the
 *   manufacturer's own page states (glass side, mesh front, fan count). Sub-part sizes are
 *   visual estimates inside that envelope.
 *
 * Neither kind is a real CAD model or a fit check; the UI says so with `REFERENCE_MODEL_LABEL`.
 */
export const REFERENCE_MODEL_LABEL =
  "Reference reconstruction · dimensions from manufacturer specs";
/** Millimetres per scene unit: a 465 mm case is 3.1 units tall. */
export const MM_PER_SCENE_UNIT = 150;

/**
 * Model frames. `case`: x = depth (front +x), y = up, z = width (glass side +z), the same as the
 * scene's case slot. `gpu`: x = thickness (fan face +x), y = card height (PCIe fingers -y),
 * z = length (I/O bracket +z); the scene rotates it into the horizontal GPU slot.
 */
export type ReferenceFrame = "case" | "gpu";

export interface ReferenceModelPart {
  id: string;
  shape: "box" | "disc";
  sizeMm: Point;
  positionMm: Point;
  material: string;
}

export interface ReferenceMaterial {
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
}

export interface ReferenceModel {
  partId: string;
  slug: string;
  frame: ReferenceFrame;
  geometryAccuracy: "reference_reconstructed";
  source: "img2threejs" | "spec-envelope";
  envelopeMm: Point;
  /** img2threejs only: credited build passes and the last AI vision score. */
  passes?: number;
  finalVisionScore?: number | null;
  parts: ReferenceModelPart[];
  materials: Record<string, ReferenceMaterial>;
}

const sharedMaterials: Record<string, ReferenceMaterial> = {
  "panel-white": { color: "#EEF0F3", roughness: 0.45, metalness: 0 },
  "front-mesh": { color: "#D5D9DE", roughness: 0.85, metalness: 0 },
  "clear-glass": { color: "#F5F8FA", roughness: 0.05, metalness: 0, transmission: 1 },
  "shroud-white": { color: "#E0E6EF", roughness: 0.5, metalness: 0 },
  "fan-disc": { color: "#939AA6", roughness: 0.45, metalness: 0 },
  "heatsink-dark": { color: "#1A191F", roughness: 0.55, metalness: 0.6 },
  "gold-contacts": { color: "#8C7048", roughness: 0.3, metalness: 1 },
  "bracket-steel": { color: "#4A4A45", roughness: 0.5, metalness: 0.7 },
  "backplate-white": { color: "#E6E9F1", roughness: 0.45, metalness: 0 },
};

function pick(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, sharedMaterials[id]]));
}

function box(id: string, sizeMm: Point, positionMm: Point, material: string): ReferenceModelPart {
  return { id, shape: "box", sizeMm, positionMm, material };
}

/** A case from its published millimetre envelope; panel, foot and shroud sizes are visual estimates. */
function caseEnvelope(options: {
  partId: string;
  slug: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  meshTop: boolean;
  psuShroud: boolean;
}): ReferenceModel {
  const { widthMm: W, heightMm: H, depthMm: D } = options;
  const feet = 10;
  const panel = 6;
  const bodyBottom = -H / 2 + feet;
  const bodyH = H - feet;
  const bodyY = bodyBottom + bodyH / 2;
  const parts: ReferenceModelPart[] = [
    box(
      "top-panel",
      [D, panel, W],
      [0, H / 2 - panel / 2, 0],
      options.meshTop ? "front-mesh" : "panel-white",
    ),
    box("bottom-panel", [D, panel, W], [0, bodyBottom + panel / 2, 0], "panel-white"),
    box("rear-panel", [panel, bodyH, W], [-D / 2 + panel / 2, bodyY, 0], "panel-white"),
    box("solid-side-panel", [D, bodyH, panel], [0, bodyY, -W / 2 + panel / 2], "panel-white"),
    box("front-panel", [panel, bodyH, W], [D / 2 - panel / 2, bodyY, 0], "front-mesh"),
    box(
      "glass-side-panel",
      [D - 2 * panel, bodyH - 2 * panel, 2],
      [0, bodyY, W / 2 - 1],
      "clear-glass",
    ),
  ];
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    parts.push(
      box(
        `foot-${x > 0 ? "front" : "rear"}-${z > 0 ? "glass" : "solid"}`,
        [60, feet, 40],
        [x * (D / 2 - 45), -H / 2 + feet / 2, z * (W / 2 - 30)],
        "panel-white",
      ),
    );
  }
  if (options.psuShroud) {
    const shroudH = 90;
    parts.push(
      box(
        "psu-shroud",
        [D - 2 * panel, shroudH, W - 2 * panel - 2],
        [0, bodyBottom + panel + shroudH / 2, 0],
        "front-mesh",
      ),
    );
  }
  return {
    partId: options.partId,
    slug: options.slug,
    frame: "case",
    geometryAccuracy: "reference_reconstructed",
    source: "spec-envelope",
    envelopeMm: [D, H, W],
    parts,
    materials: pick(["panel-white", "front-mesh", "clear-glass"]),
  };
}

/**
 * A graphics card from its published length x height x thickness. Fans are evenly spaced (the
 * manufacturer states the count, not the pitch); the 11 mm PCIe-finger band and the 120 mm
 * bracket follow the img2threejs MSI reconstruction's proportions.
 */
function gpuEnvelope(options: {
  partId: string;
  slug: string;
  lengthMm: number;
  heightMm: number;
  thicknessMm: number;
  fans: number;
}): ReferenceModel {
  const { lengthMm: L, heightMm: H, thicknessMm: T, fans } = options;
  const fingers = 11;
  const shroudH = H - fingers;
  const shroudY = H / 2 - shroudH / 2;
  const front = T / 2;
  const parts: ReferenceModelPart[] = [
    box("heatsink-core", [T - 10, shroudH - 4, L - 4], [-1, shroudY, 0], "heatsink-dark"),
    box("front-shroud", [6, shroudH, L], [front - 5, shroudY, 0], "shroud-white"),
    box("backplate", [3, shroudH, L], [-front + 1.5, shroudY, 0], "backplate-white"),
    box(
      "pcie-fingers",
      [1.6, fingers, 82.7],
      [-10, -H / 2 + fingers / 2, L / 2 - 90],
      "gold-contacts",
    ),
    box("io-bracket", [40, 120, 1.5], [-2, H / 2 - 30 - 60, L / 2 + 3], "bracket-steel"),
  ];
  const pitch = L / fans;
  const diameter = Math.min(shroudH * 0.76, pitch - 8);
  const face = front - 2;
  for (let index = 0; index < fans; index += 1) {
    const z = L / 2 - pitch * (index + 0.5);
    const layers: [string, number, number, string][] = [
      ["outline", face + 0.1, diameter + 4, "fan-disc"],
      ["ring", face + 0.5, diameter, "shroud-white"],
      ["blades", face + 0.9, diameter * 0.94, "fan-disc"],
      ["hub", face + 1.4, diameter * 0.21, "shroud-white"],
    ];
    for (const [layer, x, d, material] of layers) {
      parts.push({
        id: `fan-${layer}-${index + 1}`,
        shape: "disc",
        sizeMm: [0.6, d, d],
        positionMm: [x, shroudY, z],
        material,
      });
    }
  }
  return {
    partId: options.partId,
    slug: options.slug,
    frame: "gpu",
    geometryAccuracy: "reference_reconstructed",
    source: "spec-envelope",
    envelopeMm: [T, H, L],
    parts,
    materials: pick([
      "shroud-white",
      "fan-disc",
      "heatsink-dark",
      "gold-contacts",
      "bracket-steel",
      "backplate-white",
    ]),
  };
}

const envelopeModels: ReferenceModel[] = [
  // nzxt.com/products/h5-flow: 465 H x 225 W x 430 D mm; mesh top and front; perforated PSU shroud; tempered glass side.
  caseEnvelope({
    partId: "showcase-case-nzxt-cc-h52fw-01",
    slug: "nzxt-h5-flow-white",
    widthMm: 225,
    heightMm: 465,
    depthMm: 430,
    meshTop: true,
    psuShroud: true,
  }),
  // corsair.com CC-9011201-WW: height 466, length 453, width 230 mm; steel high-airflow front; tempered glass side.
  caseEnvelope({
    partId: "showcase-case-corsair-cc-9011201-ww",
    slug: "corsair-4000d-airflow-white",
    widthMm: 230,
    heightMm: 466,
    depthMm: 453,
    meshTop: false,
    psuShroud: false,
  }),
  // asus.com PRIME-RTX5070-O12G-WHITE: 304 x 126 x 50 mm; "three Axial-tech fans".
  gpuEnvelope({
    partId: "showcase-gpu-asus-prime-rtx5070-o12g-white",
    slug: "asus-prime-rtx5070-white",
    lengthMm: 304,
    heightMm: 126,
    thicknessMm: 50,
    fans: 3,
  }),
];

const byPartId = new Map(
  [...generatedReferenceModels, ...envelopeModels].map((model) => [model.partId, model]),
);

export const referenceModels: ReferenceModel[] = [...byPartId.values()];

export function referenceModelFor(partId: string | undefined): ReferenceModel | null {
  return partId ? (byPartId.get(partId) ?? null) : null;
}

/** Size in scene units along the scene's axes (the GPU slot lies flat: length, thickness, height). */
export function sceneSize(model: ReferenceModel): Point {
  const [a, b, c] = model.envelopeMm;
  const mm: Point = model.frame === "gpu" ? [c, a, b] : [a, b, c];
  return mm.map((value) => value / MM_PER_SCENE_UNIT) as Point;
}

/** Slots whose selected part renders as a reference reconstruction. */
export function referenceModelSlots(document: BuildDocumentV3): SlotId[] {
  return primarySlots.filter((slot) => referenceModelFor(selectedPart(document, slot)?.id));
}
