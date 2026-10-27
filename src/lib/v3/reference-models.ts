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
 * - `tube`: a bent tube (an AIO hose) through `pathMm`; `sizeMm` is the box around it.
 * `axis` (default x) is the axis a cylinder, rotor or ring faces along.
 */
export type ReferenceShape = "box" | "disc" | "cylinder" | "rotor" | "fins" | "ring" | "tube";
export type ReferenceAxis = "x" | "y" | "z";

export interface ReferenceModelPart {
  id: string;
  shape: ReferenceShape;
  sizeMm: Point;
  positionMm: Point;
  material: string;
  axis?: ReferenceAxis;
  /** Boxes: corner radius in millimetres (drawn square in the light quality tier). */
  roundMm?: number;
  /** Tubes: centreline points relative to `positionMm`, and the tube's outer diameter. */
  pathMm?: Point[];
  diameterMm?: number;
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
  "heatsink-board": { color: "#40444B", roughness: 0.4, metalness: 0.5 },
  "slot-plastic": { color: "#18191C", roughness: 0.55, metalness: 0.05 },
  "slot-steel": { color: "#9EA4AB", roughness: 0.35, metalness: 0.9 },
  "slot-latch": { color: "#3A3D42", roughness: 0.5, metalness: 0.05 },
  "port-dark": { color: "#0E0F11", roughness: 0.6, metalness: 0.2 },
  "fitting-steel": { color: "#B9BEC5", roughness: 0.3, metalness: 0.9 },
  "grommet-rubber": { color: "#2B2E33", roughness: 0.85, metalness: 0 },
  light: { color: "#FFFFFF", roughness: 0.4, metalness: 0 },
};

function pick(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, sharedMaterials[id]]));
}

function box(
  id: string,
  sizeMm: Point,
  positionMm: Point,
  material: string,
  roundMm?: number,
): ReferenceModelPart {
  return { id, shape: "box", sizeMm, positionMm, material, ...(roundMm ? { roundMm } : {}) };
}

/** Largest corner radius a box can take: just under half its thinnest side. */
export function cornerRadius(part: ReferenceModelPart): number {
  return part.roundMm ? Math.min(part.roundMm, Math.min(...part.sizeMm) * 0.45) : 0;
}

/**
 * Softened edges for a whole model: every box at least `minSideMm` thick gets `radiusMm`
 * (glass panes and thin trims stay square). Edge radii are a visual estimate.
 */
function withRounding(model: ReferenceModel, radiusMm: number, minSideMm = 4): ReferenceModel {
  return {
    ...model,
    parts: model.parts.map((part) =>
      part.shape === "box" &&
      !part.roundMm &&
      !model.materials[part.material]?.transmission &&
      Math.min(...part.sizeMm) >= minSideMm
        ? { ...part, roundMm: radiusMm }
        : part,
    ),
  };
}

/** A hose through `points` (absolute, model frame): position and size are its bounding box. */
function tube(
  id: string,
  points: Point[],
  diameterMm: number,
  material: string,
): ReferenceModelPart {
  const lo = [0, 1, 2].map((k) => Math.min(...points.map((point) => point[k])) - diameterMm / 2);
  const hi = [0, 1, 2].map((k) => Math.max(...points.map((point) => point[k])) + diameterMm / 2);
  const centre = lo.map((value, k) => (value + hi[k]) / 2) as Point;
  return {
    id,
    shape: "tube",
    sizeMm: lo.map((value, k) => hi[k] - value) as Point,
    positionMm: centre,
    material,
    pathMm: points.map((point) => point.map((value, k) => value - centre[k]) as Point),
    diameterMm,
  };
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
  return withRounding(
    {
      partId: options.partId,
      slug: options.slug,
      frame: "case",
      geometryAccuracy: "reference_reconstructed",
      source: "spec-envelope",
      envelopeMm: [D, H, W],
      assumptions: [
        "Panel, foot and PSU-shroud sizes are visual estimates inside the envelope.",
        "Panel edge radii are visual estimates.",
      ],
      parts,
      materials: pick(["panel-white", "front-mesh", "clear-glass"]),
    },
    2.5,
  );
}

/**
 * GPU details shared by both GPU kinds, in the GPU frame: vent slots and display outputs on the
 * bracket and the power connector on the top edge. Output and connector counts
 * come from the manufacturer pages; sizes and positions are visual estimates.
 */
function gpuDetailParts(options: {
  bracketCentre: Point;
  bracketHeightMm: number;
  pcbX: number;
  topY: number;
  centreZ: number;
  lengthMm: number;
  displayPorts: number;
  hdmiPorts: number;
}): ReferenceModelPart[] {
  const { bracketCentre: b, bracketHeightMm: bh } = options;
  const outer = b[2] + 0.75 + 1.25;
  // Vent slots in the bracket above the outputs, and a screw per slot at its top.
  const screws: ReferenceModelPart[] = [-1, 1].map((sign, index) => ({
    id: `io-bracket-screw-${index + 1}`,
    shape: "cylinder",
    sizeMm: [6, 6, 2.5],
    positionMm: [b[0] + sign * 10, b[1] + bh / 2 - 5, outer + 0.25],
    material: "fitting-steel",
    axis: "z",
  }));
  const parts: ReferenceModelPart[] = [
    ...screws,
    ...[0, 1, 2].map((index) =>
      box(
        `io-bracket-vent-${index + 1}`,
        [4, 28, 1.8],
        [b[0] + 6 + index * 8, b[1] + bh / 2 - 26, outer - 0.4],
        "port-dark",
      ),
    ),
  ];
  // Outputs stack along the bracket from its lower end; DisplayPort first, then HDMI.
  const ports = [
    ...Array.from({ length: options.displayPorts }, (_, index) => `dp-${index + 1}`),
    ...Array.from({ length: options.hdmiPorts }, (_, index) => `hdmi-${index + 1}`),
  ];
  ports.forEach((name, index) =>
    parts.push(
      box(
        `port-${name}`,
        [5.5, name.startsWith("hdmi") ? 15 : 16, 2.5],
        [options.pcbX, b[1] - bh / 2 + 16 + index * 20, outer],
        "port-dark",
      ),
    ),
  );
  parts.push(
    box(
      "power-16-pin",
      [9, 10, 20],
      // Flush with the top edge, inside the published card height.
      [options.pcbX + 4, options.topY - 5, options.centreZ - options.lengthMm * 0.08],
      "slot-plastic",
      1,
    ),
  );
  return parts;
}

const GPU_DETAIL_ASSUMPTION =
  "Bracket vents and screws, display-output openings and the 16-pin connector are drawn at estimated sizes and positions; their counts are from the manufacturer page.";

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
  displayPorts: number;
  hdmiPorts: number;
  /** False for a look-alike with no model behind it: no outputs, vents or power connector. */
  details?: boolean;
}): ReferenceModel {
  const { lengthMm: L, heightMm: H, thicknessMm: T, fans } = options;
  const fingers = 11;
  const shroudH = H - fingers;
  const shroudY = H / 2 - shroudH / 2;
  const front = T / 2;
  const parts: ReferenceModelPart[] = [
    box("heatsink-core", [T - 10, shroudH - 4, L - 4], [-1, shroudY, 0], "heatsink-dark"),
    box("front-shroud", [6, shroudH, L], [front - 5, shroudY, 0], "shroud-white", 3),
    box("backplate", [3, shroudH, L], [-front + 1.5, shroudY, 0], "backplate-white", 1.2),
    box(
      "pcie-fingers",
      [1.6, fingers, 82.7],
      [-10, -H / 2 + fingers / 2, L / 2 - 90],
      "gold-contacts",
    ),
    box("io-bracket", [40, 120, 1.5], [-2, H / 2 - 30 - 60, L / 2 + 3], "bracket-steel"),
    ...(options.details === false
      ? []
      : gpuDetailParts({
          bracketCentre: [-2, H / 2 - 30 - 60, L / 2 + 3],
          bracketHeightMm: 120,
          pcbX: -10,
          topY: H / 2,
          centreZ: 0,
          lengthMm: L,
          displayPorts: options.displayPorts,
          hdmiPorts: options.hdmiPorts,
        })),
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
      GPU_DETAIL_ASSUMPTION,
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
      "port-dark",
      "slot-plastic",
      "fitting-steel",
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
    parts.push(box(`${prefix}-frame-${name}`, size, position, frameMaterial, 1.5));
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
  epsConnectors: number;
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
    box("pcb", [W, H, 1.6], [x(W / 2), y(H / 2), 0], "pcb", 1),
    box("socket-frame", [62, 62, 4], [socket[0], socket[1], on(4)], "slot-steel", 2),
    box("socket-lever", [3, 50, 3], [socket[0] + 36, socket[1], on(3)], "slot-steel", 1),
    box("io-shroud", [44, 150, 36], [x(24), y(80), on(36)], "heatsink-board", 5),
    // The page lists a pre-mounted I/O shield: a plate standing on the rear edge.
    box("io-shield", [1.5, 158, 44], [x(-0.75), y(84), on(44)], "slot-steel"),
    // VRM heatsinks as finned blocks: left of the socket and above it.
    {
      id: "vrm-heatsink-left",
      shape: "fins",
      sizeMm: [24, 92, 22],
      positionMm: [x(60), y(84), on(22)],
      material: "heatsink-board",
      axis: "y",
    },
    {
      id: "vrm-heatsink-top",
      shape: "fins",
      sizeMm: [86, 26, 24],
      positionMm: [x(112), y(22), on(24)],
      material: "heatsink-board",
      axis: "x",
    },
    box("chipset-heatsink", [70, 58, 10], [x(186), y(240), on(10)], "heatsink-board", 3),
    box("atx-24-pin", [10, 52, 15], [x(236), y(110), on(15)], "slot-plastic", 1),
    box("pcie-6-pin", [10, 17, 13], [x(236), y(196), on(13)], "slot-plastic", 1),
  ];
  for (let index = 0; index < options.epsConnectors; index += 1)
    parts.push(
      box(
        `eps-8-pin-${index + 1}`,
        [20, 8, 13],
        [x(65 + index * 23), y(4.5), on(13)],
        "slot-plastic",
        1,
      ),
    );
  // The DIMM slot right of the socket, the first of `dimmSlots` (memory sits in the 2nd and 4th),
  // each with a latch at both ends.
  for (let index = 0; index < options.dimmSlots; index += 1) {
    const slotX = x(158 + index * 9.5);
    parts.push(box(`dimm-slot-${index + 1}`, [6.5, 140, 7], [slotX, y(80), on(7)], "slot-plastic"));
    for (const [end, fromTop] of [
      ["top", 6],
      ["bottom", 154],
    ] as const)
      parts.push(
        box(
          `dimm-latch-${index + 1}-${end}`,
          [7.5, 8, 10],
          [slotX, y(fromTop), on(10)],
          "slot-latch",
          1,
        ),
      );
  }
  // The top x16 slot sits under the GPU slot's PCIe fingers; each has a release latch.
  const topSlotY = -53 - ANCHOR_MM.motherboard[1];
  for (let index = 0; index < options.pcieX16Slots; index += 1)
    parts.push(
      box(
        `pcie-x16-${index + 1}`,
        [89, 9, 11],
        [x(95), topSlotY - index * 40, on(11)],
        "slot-steel",
        1,
      ),
      box(
        `pcie-x16-${index + 1}-latch`,
        [8, 10, 13],
        [x(143.5), topSlotY - index * 40, on(13)],
        "slot-latch",
        1,
      ),
    );
  for (let index = 0; index < options.m2Heatsinks; index += 1)
    parts.push(
      box(
        `m2-heatsink-${index + 1}`,
        [96, 24, 6],
        [x(95), topSlotY - 20 - index * 40, on(6)],
        "heatsink-board",
        2,
      ),
    );
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      "Placement of the socket, VRM and I/O heatsinks, chipset heatsink, connectors and slots is a visual estimate; the board is not drawn from its layout drawing.",
      "The board is shown on the generic layout's anchors, not on the case's real standoffs.",
      "Connector, latch, I/O-shield and heatsink-fin sizes and edge radii are visual estimates; connector counts are from the manufacturer page.",
      "Two of the board's three M.2 slots are drawn with covers.",
    ],
    parts,
    materials: pick(["pcb", "heatsink-board", "slot-plastic", "slot-steel", "slot-latch"]),
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
    box("pump-body", pumpSize, pump, "fan-white", 8),
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
        4,
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
  // Hoses leave fittings on the pump's rear face and bend up into fittings under the rear tank.
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
        id: `fitting-${name}-pump`,
        shape: "cylinder",
        sizeMm: [12, 16, 16],
        positionMm: [pumpRear - 6, pump[1], z],
        material: "fitting-steel",
        axis: "x",
      },
      {
        id: `fitting-${name}-tank`,
        shape: "cylinder",
        sizeMm: [16, 10, 16],
        positionMm: [tankX, hoseTop - 5, z],
        material: "fitting-steel",
        axis: "y",
      },
      tube(
        `hose-${name}`,
        [
          [pumpRear - 11, pump[1], z],
          [tankX + 30, pump[1] + 6, z],
          [tankX + 2, pump[1] + 45, z],
          [tankX, hoseTop - 9, z],
        ],
        12,
        "hose-white",
      ),
    );
  }
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      'Radiator length is the page\'s "Product Length 396", read as millimetres (the page gives no unit).',
      "Radiator width is one fan width (the page states 360 mm radiator size and RX120 fans); thickness 27 mm and 20 mm end tanks are estimates.",
      "Pump head size, the hose route and the fittings are estimates; the published 450 mm tubing length is not drawn.",
      "Edge radii of the pump, end tanks and fan frames are visual estimates.",
      "Fan frame rails, blade count and light-ring size are visual estimates.",
    ],
    parts,
    materials: pick([
      "fan-white",
      "radiator-fins",
      "hose-white",
      "cold-plate",
      "light",
      "fitting-steel",
    ]),
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
    // Bottom up: PCB edge with gold contacts, heatspreader, light bar; together the module height.
    const edge = 4;
    parts.push(
      box(`module-${index + 1}-pcb`, [1.2, L - 1, edge], [x, y, z(bottom + edge / 2)], "pcb"),
      box(
        `module-${index + 1}-contacts`,
        [1.4, L - 14, 3],
        [x, y, z(bottom + 1.5)],
        "gold-contacts",
      ),
      box(
        `module-${index + 1}-heatspreader`,
        [W, L, H - lightBar - edge],
        [x, y, z(bottom + edge + (H - lightBar - edge) / 2)],
        "fan-white",
        1.5,
      ),
      box(
        `module-${index + 1}-light-bar`,
        [W - 1, L - 4, lightBar],
        [x, y, z(bottom + H - lightBar / 2)],
        "light",
        1.5,
      ),
    );
  }
  return placed({
    partId: options.partId,
    slug: options.slug,
    assumptions: [
      "Light-bar height (10 mm) is an estimate; module length, width and height are from the manufacturer.",
      "The 4 mm PCB edge with gold contacts, and edge radii, are visual estimates.",
      "Modules shown in the 2nd and 4th slots of the reference board.",
    ],
    parts,
    materials: pick(["fan-white", "light", "pcb", "gold-contacts"]),
  });
}

/**
 * Look-alikes for slots a photo shows but whose model is not confirmed, and the ghosted board of
 * an open motherboard slot (PRD §9.3). They reuse the detailed builders at illustrative
 * proportions; no model is identified and no size is read from a manufacturer page. They are
 * never listed as reference models.
 */
const ILLUSTRATIVE_ASSUMPTION =
  "Illustrative proportions of the part type; no model is identified, so no size comes from a manufacturer page.";

const appearanceGpuModel: ReferenceModel = {
  ...gpuEnvelope({
    partId: "appearance-gpu-3-fan",
    slug: "appearance-gpu-3-fan",
    lengthMm: 300,
    heightMm: 120,
    thicknessMm: 50,
    fans: 3,
    displayPorts: 0,
    hdmiPorts: 0,
    details: false,
  }),
  assumptions: [ILLUSTRATIVE_ASSUMPTION, GPU_ROTOR_ASSUMPTION],
};

const appearanceAioModel: ReferenceModel = {
  ...aio360({
    partId: "appearance-cooler-aio-360",
    slug: "appearance-cooler-aio-360",
    radiatorLengthMm: 400,
    fanSizeMm: 120,
    fanThicknessMm: 25,
  }),
  assumptions: [ILLUSTRATIVE_ASSUMPTION],
};

const appearanceBoardModel: ReferenceModel = {
  ...atxBoard({
    partId: "appearance-board-atx",
    slug: "appearance-board-atx",
    dimmSlots: 4,
    pcieX16Slots: 2,
    m2Heatsinks: 2,
    epsConnectors: 1,
  }),
  assumptions: [
    "A generic ATX board (305 x 244 mm form factor) with illustrative slots and heatsinks; no model is identified.",
  ],
};

/** Neutral body colour when the photo shows a part but not its colour. */
const NEUTRAL_BODY = "#9AA0A8";

/** A look-alike's body materials in the photo's colour (lights take the photo's light colour). */
function tinted(model: ReferenceModel, bodyHex: string | null, bodyMaterials: string[]) {
  const color = bodyHex ?? NEUTRAL_BODY;
  return {
    ...model,
    materials: Object.fromEntries(
      Object.entries(model.materials).map(([id, material]) => [
        id,
        bodyMaterials.includes(id) ? { ...material, color } : material,
      ]),
    ),
  };
}

export const appearanceModels = {
  // The look-alike's heatsink is a soft dark grey: no model is known, so no hard black core.
  gpu: (bodyHex: string | null) =>
    tinted(
      {
        ...appearanceGpuModel,
        materials: {
          ...appearanceGpuModel.materials,
          "heatsink-dark": { color: "#4A4E55", roughness: 0.6, metalness: 0.3 },
        },
      },
      bodyHex,
      ["shroud-white", "backplate-white"],
    ),
  aio: (bodyHex: string | null) => tinted(appearanceAioModel, bodyHex, ["fan-white", "hose-white"]),
  board: (bodyHex: string | null) => tinted(appearanceBoardModel, bodyHex, ["heatsink-board"]),
  /** The open motherboard slot's ghost: the generic board, drawn faint by the scene. */
  ghostBoard: appearanceBoardModel,
};

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
    // Tech specs: "1 x Native HDMI 2.1b", "3 x Native DisplayPort 2.1b", "1 x 16-pin".
    displayPorts: 3,
    hdmiPorts: 1,
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
    // "1 x 24-pin Main Power connector", "2 x 8-pin +12V Power connector", "1 x 6-pin PCIe Power
    // connector", "Pre-mounted I/O shield".
    epsConnectors: 2,
  }),
];

/**
 * Cable pass-throughs on a case's tray (the "tray-divider" part): three rubber grommets just in
 * front of the board's front edge. Positions and sizes are visual estimates.
 */
const GROMMET_SIZE_MM: Point = [22, 60, 2];
export function caseGrommetsMm(model: ReferenceModel): Point[] {
  const tray = model.parts.find((part) => part.id === "tray-divider");
  if (!tray) return [];
  const face = tray.positionMm[2] + tray.sizeMm[2] / 2 + GROMMET_SIZE_MM[2] / 2;
  return [90, 0, -90].map((y) => [125, tray.positionMm[1] + y, face] as Point);
}

function withGrommets(model: ReferenceModel): ReferenceModel {
  const grommets = caseGrommetsMm(model);
  if (!grommets.length) return model;
  return {
    ...model,
    parts: [
      ...model.parts,
      ...grommets.map((centre, index) =>
        box(`cable-grommet-${index + 1}`, GROMMET_SIZE_MM, centre, "grommet-rubber", 0.9),
      ),
    ],
    materials: { ...model.materials, ...pick(["grommet-rubber"]) },
    assumptions: [
      ...(model.assumptions ?? []),
      "Cable grommets on the tray are drawn at estimated sizes and positions.",
    ],
  };
}

/** Interior surfaces (trays, inner rails) a step greyer than the outer white panels. */
const INTERIOR_WHITE = "#CDD1D6";
function withGreyInterior(materials: Record<string, ReferenceMaterial>) {
  return Object.fromEntries(
    Object.entries(materials).map(([id, material]) => [
      id,
      id === "tray-white" ? { ...material, color: INTERIOR_WHITE, roughness: 0.6 } : material,
    ]),
  );
}

// Display outputs of the img2threejs GPUs, from their manufacturer spec pages.
const generatedGpuOutputs: Record<string, { displayPorts: number; hdmiPorts: number }> = {
  // msi.com GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE specification: "DisplayPort x 3",
  // "HDMI x 1", "16-pin x 1".
  "showcase-gpu-msi-g507t-16gtcw": { displayPorts: 3, hdmiPorts: 1 },
};

/** An img2threejs GPU with rotors, softened shroud edges and the shared details. */
function detailedGeneratedGpu(model: ReferenceModel): ReferenceModel {
  const part = (id: string) => model.parts.find((item) => item.id === id);
  const bracket = part("io-bracket");
  const fingers = part("pcie-fingers");
  const shroud = part("front-shroud");
  const outputs = generatedGpuOutputs[model.partId];
  const details =
    bracket && fingers && shroud && outputs
      ? gpuDetailParts({
          bracketCentre: bracket.positionMm,
          bracketHeightMm: bracket.sizeMm[1],
          pcbX: fingers.positionMm[0],
          topY: shroud.positionMm[1] + shroud.sizeMm[1] / 2,
          centreZ: shroud.positionMm[2],
          lengthMm: model.envelopeMm[2],
          ...outputs,
        })
      : [];
  return withRounding(
    {
      ...model,
      parts: [...withRotors(model.parts), ...details],
      materials: { ...model.materials, ...pick(["port-dark", "slot-plastic", "fitting-steel"]) },
      assumptions: [
        GPU_ROTOR_ASSUMPTION,
        ...(details.length ? [GPU_DETAIL_ASSUMPTION] : []),
        "Edge radii are visual estimates.",
      ],
    },
    2.5,
  );
}

const byPartId = new Map(
  [
    ...generatedReferenceModels.map((model) =>
      model.frame === "gpu"
        ? detailedGeneratedGpu(model)
        : withRounding(
            withGrommets({
              ...model,
              materials: withGreyInterior(model.materials),
              assumptions: [
                "Panel edge radii are visual estimates.",
                "Interior trays are drawn a slightly grey white so parts in front of them keep their shading.",
              ],
            }),
            2.5,
          ),
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
