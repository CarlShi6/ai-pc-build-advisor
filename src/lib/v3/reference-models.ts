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
 * scene's case slot; models inside the case use it too, with the origin on their slot anchor.
 * `gpu`: x = thickness (fan face +x), y = card height (PCIe fingers -y), z = length (I/O bracket
 * +z); the scene rotates it into the horizontal GPU slot.
 */
export type ReferenceFrame = "case" | "gpu";

/**
 * - `box`, `disc` (a flattened ellipsoid) and `cylinder` are plain solids.
 * - `rotor`: fan blades around a hub, inside a `sizeMm` envelope.
 * - `fins`: a radiator core, fin plates stacked along `axis`.
 * - `ring`: a light ring of the build's RGB colour; `sizeMm` is its outer diameter.
 * `axis` (default x) is the axis a cylinder, rotor or ring faces along.
 */
export type ReferenceShape = "box" | "disc" | "cylinder" | "rotor" | "fins" | "ring";
export type ReferenceAxis = "x" | "y" | "z";

export interface ReferenceModelPart {
  id: string;
  shape: ReferenceShape;
  sizeMm: Point;
  positionMm: Point;
  material: string;
  axis?: ReferenceAxis;
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
  /** Centre of the envelope in the model frame; [0, 0, 0] unless the model sits off its anchor. */
  centreMm?: Point;
  /** Spec-envelope models: what was estimated rather than read from the manufacturer's page. */
  assumptions?: string[];
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
  "fan-white": { color: "#E4E8EC", roughness: 0.5, metalness: 0 },
  "radiator-fins": { color: "#C9CED5", roughness: 0.55, metalness: 0.5 },
  "hose-white": { color: "#DDE1E6", roughness: 0.75, metalness: 0 },
  "cold-plate": { color: "#B87F57", roughness: 0.3, metalness: 1 },
  pcb: { color: "#15201A", roughness: 0.78, metalness: 0.2 },
  "heatsink-board": { color: "#2A2D32", roughness: 0.36, metalness: 0.75 },
  "slot-plastic": { color: "#18191C", roughness: 0.55, metalness: 0.05 },
  "slot-steel": { color: "#9EA4AB", roughness: 0.35, metalness: 0.9 },
  light: { color: "#FFFFFF", roughness: 0.4, metalness: 0 },
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
    assumptions: ["Panel, foot and PSU-shroud sizes are visual estimates inside the envelope."],
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
    assumptions: [
      "Fans evenly spaced; the page states the fan count, not the pitch.",
      "Heatsink, shroud, backplate, PCIe-finger and bracket proportions are visual estimates.",
      GPU_ROTOR_ASSUMPTION,
    ],
    parts: withRotors(parts),
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

const GPU_ROTOR_ASSUMPTION =
  "Fan blades drawn as nine pitched blades around a hub; blade count and shape are not published.";

/** GPU fans read as fans: the flat blade discs become pitched rotors of the same diameter. */
function withRotors(parts: ReferenceModelPart[]): ReferenceModelPart[] {
  return parts.map((part) =>
    part.id.startsWith("fan-blades-")
      ? { ...part, shape: "rotor", sizeMm: [4, part.sizeMm[1], part.sizeMm[2]], axis: "x" }
      : part,
  );
}

const along = (axis: ReferenceAxis, thickness: number, span: number): Point =>
  axis === "x"
    ? [thickness, span, span]
    : axis === "y"
      ? [span, thickness, span]
      : [span, span, thickness];

/**
 * A square-frame case fan of `sizeMm` x `thicknessMm` facing along `axis`: four frame rails, a
 * pitched rotor and a light ring. Rail width and ring diameter are visual estimates.
 */
function fanParts(
  prefix: string,
  centre: Point,
  axis: ReferenceAxis,
  sizeMm: number,
  thicknessMm: number,
  frameMaterial: string,
): ReferenceModelPart[] {
  const rail = 8;
  const half = sizeMm / 2 - rail / 2;
  const [i, j] = axis === "x" ? [1, 2] : axis === "y" ? [0, 2] : [0, 1];
  const parts: ReferenceModelPart[] = [];
  for (const [name, inPlane, sign] of [
    ["a", i, 1],
    ["b", i, -1],
    ["c", j, 1],
    ["d", j, -1],
  ] as const) {
    const size = along(axis, thicknessMm, sizeMm);
    size[inPlane] = rail;
    const position = [...centre] as Point;
    position[inPlane] += sign * half;
    parts.push(box(`${prefix}-frame-${name}`, size, position, frameMaterial));
  }
  parts.push(
    {
      id: `${prefix}-rotor`,
      shape: "rotor",
      sizeMm: along(axis, thicknessMm * 0.7, sizeMm - 2 * rail - 4),
      positionMm: centre,
      material: frameMaterial,
      axis,
    },
    {
      id: `${prefix}-light-ring`,
      shape: "ring",
      sizeMm: along(axis, 2, sizeMm - 2 * rail),
      positionMm: centre,
      material: "light",
      axis,
    },
  );
  return parts;
}

/** Envelope and centre from the parts, for models placed off their slot anchor. */
function placed(
  model: Omit<ReferenceModel, "envelopeMm" | "centreMm" | "geometryAccuracy" | "frame" | "source">,
): ReferenceModel {
  const lo = [0, 1, 2].map((k) =>
    Math.min(...model.parts.map((part) => part.positionMm[k] - part.sizeMm[k] / 2)),
  );
  const hi = [0, 1, 2].map((k) =>
    Math.max(...model.parts.map((part) => part.positionMm[k] + part.sizeMm[k] / 2)),
  );
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    ...model,
    frame: "case",
    geometryAccuracy: "reference_reconstructed",
    source: "spec-envelope",
    envelopeMm: lo.map((value, k) => round(hi[k] - value)) as Point,
    centreMm: lo.map((value, k) => round((hi[k] + value) / 2)) as Point,
  };
}

// Slot anchors in millimetres (scene-focus `slotLayout` x 150). Parts inside the case are placed
// relative to their own anchor so a model lines up with the others; placement stays illustrative.
const ANCHOR_MM = {
  motherboard: [-37.5, 15, -33],
  cpu: [-36, 93, -10.5],
  cooler: [-37.5, 96, 34.5],
  memory: [87, 82.5, 7.5],
} satisfies Record<string, Point>;
const rel = (slot: keyof typeof ANCHOR_MM, worldMm: Point): Point =>
  worldMm.map((value, k) => value - ANCHOR_MM[slot][k]) as Point;

/**
 * ATX board, 305 x 244 mm. Board coordinates are measured from the rear (I/O) edge and the top
 * edge; the socket sits on the CPU anchor. Slot counts are from the manufacturer page; the
 * position and size of every sub-part is a visual estimate.
 */
function atxBoard(options: {
  partId: string;
  slug: string;
  dimmSlots: number;
  pcieX16Slots: number;
  m2Heatsinks: number;
}): ReferenceModel {
  const W = 244;
  const H = 305;
  const socket = rel("motherboard", [ANCHOR_MM.cpu[0], ANCHOR_MM.cpu[1], ANCHOR_MM.motherboard[2]]);
  const socketFromRear = 110;
  const socketFromTop = 72;
  const x = (fromRear: number) => socket[0] - socketFromRear + fromRear;
  const y = (fromTop: number) => socket[1] + socketFromTop - fromTop;
  const face = 0.8;
  const on = (depth: number) => face + depth / 2;
  const parts: ReferenceModelPart[] = [
    box("pcb", [W, H, 1.6], [x(W / 2), y(H / 2), 0], "pcb"),
    box("socket-frame", [62, 62, 4], [socket[0], socket[1], on(4)], "slot-steel"),
    box("io-shroud", [44, 150, 36], [x(24), y(80), on(36)], "heatsink-board"),
    box("vrm-heatsink-top", [86, 26, 24], [x(112), y(20), on(24)], "heatsink-board"),
    box("chipset-heatsink", [70, 58, 10], [x(186), y(240), on(10)], "heatsink-board"),
    box("atx-24-pin", [10, 52, 15], [x(236), y(110), on(15)], "slot-plastic"),
  ];
  // The DIMM slot right of the socket, the first of `dimmSlots` (memory sits in the 2nd and 4th).
  for (let index = 0; index < options.dimmSlots; index += 1)
    parts.push(
      box(
        `dimm-slot-${index + 1}`,
        [6.5, 140, 7],
        [x(158 + index * 9.5), y(80), on(7)],
        "slot-plastic",
      ),
    );
  // The top x16 slot sits under the GPU slot's PCIe fingers.
  const topSlotY = -53 - ANCHOR_MM.motherboard[1];
  for (let index = 0; index < options.pcieX16Slots; index += 1)
    parts.push(
      box(
        `pcie-x16-${index + 1}`,
        [89, 9, 11],
        [x(95), topSlotY - index * 40, on(11)],
        "slot-steel",
      ),
    );
  for (let index = 0; index < options.m2Heatsinks; index += 1)
    parts.push(
      box(
        `m2-heatsink-${index + 1}`,
        [96, 24, 6],
        [x(95), topSlotY - 20 - index * 40, on(6)],
        "heatsink-board",
      ),
    );
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      "Placement of the socket, VRM and I/O heatsinks, chipset heatsink, connectors and slots is a visual estimate; the board is not drawn from its layout drawing.",
      "The board is shown on the generic layout's anchors, not on the case's real standoffs.",
    ],
    parts,
    materials: pick(["pcb", "heatsink-board", "slot-plastic", "slot-steel"]),
  });
}

/**
 * A 360 mm AIO: pump head on the CPU, radiator under the case top with three fans below it and two
 * hoses. Radiator length is the published product length; everything else is labeled below.
 */
function aio360(options: {
  partId: string;
  slug: string;
  radiatorLengthMm: number;
  fanSizeMm: number;
  fanThicknessMm: number;
}): ReferenceModel {
  const { radiatorLengthMm: L, fanSizeMm: F, fanThicknessMm: T } = options;
  const radThickness = 27;
  const radWidth = F;
  const tank = 20;
  const radiator = rel("cooler", [0, 186.5, 40]);
  const pump = rel("cooler", [ANCHOR_MM.cpu[0], ANCHOR_MM.cpu[1], 16.7]);
  const pumpSize: Point = [72, 72, 45];
  const parts: ReferenceModelPart[] = [
    box(
      "cold-plate",
      [56, 56, 3],
      [pump[0], pump[1], pump[2] - pumpSize[2] / 2 - 1.5],
      "cold-plate",
    ),
    box("pump-body", pumpSize, pump, "fan-white"),
    {
      id: "pump-light-ring",
      shape: "ring",
      sizeMm: [58, 58, 2],
      positionMm: [pump[0], pump[1], pump[2] + pumpSize[2] / 2 + 0.5],
      material: "light",
      axis: "z",
    },
    {
      id: "radiator-core",
      shape: "fins",
      sizeMm: [L - 2 * tank, radThickness, radWidth],
      positionMm: radiator,
      material: "radiator-fins",
      axis: "x",
    },
  ];
  for (const sign of [-1, 1])
    parts.push(
      box(
        `end-tank-${sign < 0 ? "rear" : "front"}`,
        [tank, radThickness, radWidth],
        [radiator[0] + sign * (L / 2 - tank / 2), radiator[1], radiator[2]],
        "fan-white",
      ),
    );
  const fanY = radiator[1] - radThickness / 2 - T / 2;
  for (let index = 0; index < 3; index += 1)
    parts.push(
      ...fanParts(
        `fan-${index + 1}`,
        [radiator[0] + (index - 1) * F, fanY, radiator[2]],
        "y",
        F,
        T,
        "fan-white",
      ),
    );
  // Hoses leave the pump's rear face and climb to the rear end tank.
  const tankX = radiator[0] - (L / 2 - tank / 2);
  const hoseTop = radiator[1] - radThickness / 2;
  const pumpRear = pump[0] - pumpSize[0] / 2;
  for (const [name, dz] of [
    ["a", -14],
    ["b", 14],
  ] as const) {
    const z = pump[2] + dz;
    parts.push(
      {
        id: `hose-${name}-run`,
        shape: "cylinder",
        sizeMm: [pumpRear - tankX, 12, 12],
        positionMm: [(pumpRear + tankX) / 2, pump[1], z],
        material: "hose-white",
        axis: "x",
      },
      {
        id: `hose-${name}-rise`,
        shape: "cylinder",
        sizeMm: [12, hoseTop - pump[1] + 6, 12],
        positionMm: [tankX, (hoseTop + pump[1] - 6) / 2, z],
        material: "hose-white",
        axis: "y",
      },
    );
  }
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      'Radiator length is the page\'s "Product Length 396", read as millimetres (the page gives no unit).',
      "Radiator width is one fan width (the page states 360 mm radiator size and RX120 fans); thickness 27 mm and 20 mm end tanks are estimates.",
      "Pump head size and the hose route are estimates; the published 450 mm tubing length is not drawn.",
      "Fan frame rails, blade count and light-ring size are visual estimates.",
    ],
    parts,
    materials: pick(["fan-white", "radiator-fins", "hose-white", "cold-plate", "light"]),
  });
}

/** A two-module kit seated in the board's 2nd and 4th DIMM slots, light bar on the top edge. */
function memoryKit(options: {
  partId: string;
  slug: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}): ReferenceModel {
  const { lengthMm: L, widthMm: W, heightMm: H } = options;
  const lightBar = 10;
  const bottom = ANCHOR_MM.motherboard[2] + 3; // seated a few millimetres into the slot
  const parts: ReferenceModelPart[] = [];
  // Board slot positions: x(158 + i * 9.5) on the board (see atxBoard), board-relative.
  const slotX = (index: number) => ANCHOR_MM.cpu[0] - 110 + 158 + index * 9.5;
  for (const index of [1, 3]) {
    const [x, y] = rel("memory", [slotX(index), ANCHOR_MM.cpu[1] + 72 - 80, 0]);
    const z = (zWorld: number) => zWorld - ANCHOR_MM.memory[2];
    parts.push(
      box(
        `module-${index + 1}-heatspreader`,
        [W, L, H - lightBar],
        [x, y, z(bottom + (H - lightBar) / 2)],
        "fan-white",
      ),
      box(
        `module-${index + 1}-light-bar`,
        [W - 1, L - 4, lightBar],
        [x, y, z(bottom + H - lightBar / 2)],
        "light",
      ),
    );
  }
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      "Light-bar height (10 mm) is an estimate; module length, width and height are from the manufacturer.",
      "Modules shown in the 2nd and 4th slots of the reference board.",
    ],
    parts,
    materials: pick(["fan-white", "light"]),
  });
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
  // corsair.com CW-9061021-WW: "Radiator Size 360mm", "Product Length 396" (no unit), three RX120
  // fans; the RX120 page (CO-9051021-WW) lists "120 x 25mm".
  aio360({
    partId: "showcase-cooler-corsair-cw-9061021-ww",
    slug: "corsair-titan-360-rx-white",
    radiatorLengthMm: 396,
    fanSizeMm: 120,
    fanThicknessMm: 25,
  }),
  // corsair.com "DDR5 memory module dimensions": VENGEANCE RGB (CMH) 135 mm x 8 mm x 44 mm.
  memoryKit({
    partId: "showcase-ram-corsair-cmh32gx5m2b6000c30w",
    slug: "corsair-vengeance-rgb-ddr5-white",
    lengthMm: 135,
    widthMm: 8,
    heightMm: 44,
  }),
  // rog.asus.com ROG MAXIMUS Z790 HERO spec: "ATX Form Factor 12 inch x 9.6 inch ( 30.5 cm x
  // 24.4 cm )", 4 x DIMM, 3 x PCIe x16 (2 x PCIe 5.0 + 1 x PCIe 4.0), 3 x M.2 on the board.
  atxBoard({
    partId: "mobo-z790-hero",
    slug: "asus-rog-maximus-z790-hero",
    dimmSlots: 4,
    pcieX16Slots: 3,
    m2Heatsinks: 2,
  }),
];

const byPartId = new Map(
  [
    ...generatedReferenceModels.map((model) =>
      model.frame === "gpu"
        ? { ...model, parts: withRotors(model.parts), assumptions: [GPU_ROTOR_ASSUMPTION] }
        : model,
    ),
    ...envelopeModels,
  ].map((model) => [model.partId, model]),
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

/** Envelope centre relative to the slot anchor, in scene units (case-frame models only). */
export function sceneCentre(model: ReferenceModel): Point {
  return (model.centreMm ?? [0, 0, 0]).map((value) => value / MM_PER_SCENE_UNIT) as Point;
}

/** Slots whose selected part renders as a reference reconstruction. */
export function referenceModelSlots(document: BuildDocumentV3): SlotId[] {
  return primarySlots.filter((slot) => referenceModelFor(selectedPart(document, slot)?.id));
}
