import {
  ANCHOR_MM,
  aioCooler,
  appearanceModels,
  box,
  fanParts,
  gpuEnvelope,
  memoryKit,
  pick,
  placed,
  GPU_ROTOR_ASSUMPTION,
  type RadiatorMount,
  type ReferenceMaterial,
  type ReferenceModel,
  type ReferenceModelPart,
} from "@/lib/v3/reference-models";
import { countOf, type AppearanceParams, type ParamColor } from "@/lib/v3/appearance-params";
import { appearanceHex } from "@/lib/v3/photo-appearance";
import type { Point } from "@/lib/v3/scene-focus";

/**
 * Step A: parametric look-alikes built from the photo's appearance parameters, reusing the
 * detailed part builders. Where the photo leaves a field unknown, a typical value for the part
 * type stands in. No model is named and no maker's dimension is used: every size here is a
 * typical proportion, and the label says so.
 */
export const APPEARANCE_PARAMS_LABEL = "Appearance from photo · proportions estimated";

const TYPICAL =
  "Typical proportions for this kind of part; the photo shows its look, not its size or model.";

/** Case envelope (depth, height, width) by type, typical for each kind. */
const CASE_TYPICAL_MM: Record<AppearanceParams["case"]["type"], Point> = {
  "dual-chamber": [465, 460, 285],
  "mesh-front-mid-tower": [450, 465, 230],
  itx: [360, 330, 210],
  other: [450, 460, 230],
  unknown: [450, 460, 240],
};

export function caseTypicalMm(params: AppearanceParams): Point {
  return CASE_TYPICAL_MM[params.case.type];
}

const NEUTRAL_BODY = "#9AA0A8";

function colorHex(color: ParamColor): string | null {
  return color === "unknown" ? null : appearanceHex[color];
}

/** Copies the listed materials in the photo's colour (a neutral grey when it shows none). */
function tint(
  materials: Record<string, ReferenceMaterial>,
  color: ParamColor,
  ids: string[],
): Record<string, ReferenceMaterial> {
  const hex = colorHex(color) ?? NEUTRAL_BODY;
  return Object.fromEntries(
    Object.entries(materials).map(([id, material]) => [
      id,
      ids.includes(id) ? { ...material, color: hex } : material,
    ]),
  );
}

const FAN = 120;
const FAN_DEPTH = 25;
const PANEL = 6;
const FEET = 10;

/** Where the radiator of an AIO in this build sits, or null when there is no AIO. */
export function radiatorMount(params: AppearanceParams, caseMm: Point): RadiatorMount | null {
  const isAio =
    params.cooler.type === "aio" ||
    (params.cooler.type === "unknown" && params.cooler.radiatorSize !== "unknown");
  if (!isAio) return null;
  const [D, H, W] = caseMm;
  const length = radiatorLengthMm(params);
  const fan = radiatorFanMm(params);
  const position =
    params.cooler.radiatorPosition === "unknown" ? "top" : params.cooler.radiatorPosition;
  // Towards the glass side, clear of the panels.
  const z = Math.max(0, Math.min(40, W / 2 - PANEL - fan / 2 - 4));
  if (position === "top") return { position, centreMm: [0, H / 2 - 43, z] };
  if (position === "front") return { position, centreMm: [D / 2 - 43, H / 2 - 30 - length / 2, z] };
  const wall = params.case.type === "dual-chamber" ? dividerZ(caseMm) : -W / 2 + PANEL;
  return {
    position,
    centreMm: [D / 2 - fan / 2 - 20, H / 2 - 30 - length / 2, wall + 43],
  };
}

function radiatorFans(params: AppearanceParams) {
  const size = params.cooler.radiatorSize;
  return size === "240" || size === "280" ? 2 : 3;
}
function radiatorFanMm(params: AppearanceParams) {
  const size = params.cooler.radiatorSize;
  return size === "280" || size === "420" ? 140 : 120;
}
/** Typical radiator length: its fans end to end plus about 36 mm of end tanks. */
function radiatorLengthMm(params: AppearanceParams) {
  return radiatorFans(params) * radiatorFanMm(params) + 36;
}

/** The rear chamber's divider of a dual-chamber case, as a z position. */
function dividerZ([, , W]: Point) {
  return -W / 2 + 75;
}

/** A case of the photo's type, colour and glass, with its case fans at each position. */
export function caseLookModel(params: AppearanceParams): ReferenceModel {
  const caseMm = caseTypicalMm(params);
  const [D, H, W] = caseMm;
  const bodyBottom = -H / 2 + FEET;
  const bodyH = H - FEET;
  const bodyY = bodyBottom + bodyH / 2;
  const glass = params.case.glass;
  const sideGlass = glass === "side" || glass === "both" || glass === "unknown";
  const frontGlass = glass === "front" || glass === "both";
  const mesh = params.case.type === "mesh-front-mid-tower";
  const dual = params.case.type === "dual-chamber";
  const parts: ReferenceModelPart[] = [
    box(
      "top-panel",
      [D, PANEL, W],
      [0, H / 2 - PANEL / 2, 0],
      mesh ? "front-mesh" : "panel-white",
      2.5,
    ),
    box("bottom-panel", [D, PANEL, W], [0, bodyBottom + PANEL / 2, 0], "panel-white", 2.5),
    box("rear-panel", [PANEL, bodyH, W], [-D / 2 + PANEL / 2, bodyY, 0], "panel-white", 2.5),
    box("solid-side-panel", [D, bodyH, PANEL], [0, bodyY, -W / 2 + PANEL / 2], "panel-white", 2.5),
    frontGlass
      ? box(
          "front-glass",
          [2, bodyH - 2 * PANEL, W - 2 * PANEL],
          [D / 2 - 1, bodyY, 0],
          "clear-glass",
        )
      : box(
          "front-panel",
          [PANEL, bodyH, W],
          [D / 2 - PANEL / 2, bodyY, 0],
          mesh ? "front-mesh" : "panel-white",
          2.5,
        ),
    sideGlass
      ? box(
          "glass-side-panel",
          [D - 2 * PANEL, bodyH - 2 * PANEL, 2],
          [0, bodyY, W / 2 - 1],
          "clear-glass",
        )
      : box("side-panel", [D, bodyH, PANEL], [0, bodyY, W / 2 - PANEL / 2], "panel-white", 2.5),
  ];
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    parts.push(
      box(
        `foot-${x > 0 ? "front" : "rear"}-${z > 0 ? "glass" : "solid"}`,
        [60, FEET, 40],
        [x * (D / 2 - 45), -H / 2 + FEET / 2, z * (W / 2 - 30)],
        "panel-white",
        2,
      ),
    );
  if (dual)
    parts.push(
      box(
        "tray-divider",
        [D - 2 * PANEL, bodyH - 2 * PANEL, 3],
        [0, bodyY, dividerZ(caseMm)],
        "tray-white",
      ),
    );
  else
    parts.push(
      box(
        "psu-shroud",
        [D - 2 * PANEL, 90, W - 2 * PANEL - 2],
        [0, bodyBottom + PANEL + 45, 0],
        "panel-white",
        2,
      ),
    );
  parts.push(...caseFanParts(params, caseMm));
  return {
    partId: "appearance-case",
    slug: "appearance-case",
    frame: "case",
    geometryAccuracy: "reference_reconstructed",
    source: "spec-envelope",
    envelopeMm: caseMm,
    assumptions: [
      TYPICAL,
      ...(params.case.orientation === "horizontal"
        ? ["The photo shows the case lying horizontally; it is drawn upright."]
        : []),
    ],
    parts,
    materials: tint(
      {
        ...pick(["panel-white", "front-mesh", "clear-glass", "fan-white", "light"]),
        "tray-white": { color: "#CDD1D6", roughness: 0.6, metalness: 0 },
      },
      params.case.color,
      ["panel-white", "front-mesh", "fan-white"],
    ),
  };
}

/**
 * Case fans at each position the photo counts. Positions taken by the AIO radiator hold its own
 * fans instead, so none are drawn there twice.
 */
export function caseFanParts(params: AppearanceParams, caseMm: Point): ReferenceModelPart[] {
  const [D, H, W] = caseMm;
  const rad = radiatorMount(params, caseMm)?.position;
  const mainZ = params.case.type === "dual-chamber" ? (W / 2 + dividerZ(caseMm)) / 2 : 0;
  const inset = PANEL + FAN_DEPTH / 2 + 2;
  const top = H / 2 - inset;
  const bottom = -H / 2 + FEET + inset;
  const pitch = FAN + 5;
  const spots: Array<[string, number, (index: number) => Point, "x" | "y" | "z", number]> = [
    [
      "front",
      rad === "front" ? 0 : 3,
      (i) => [D / 2 - inset, H / 2 - 80 - i * pitch, mainZ],
      "x",
      Math.floor((H - 40) / pitch),
    ],
    [
      "top",
      rad === "top" ? 0 : 3,
      (i) => [D / 2 - 80 - i * pitch, top, mainZ],
      "y",
      Math.floor((D - 40) / pitch),
    ],
    [
      "bottom",
      3,
      (i) => [D / 2 - 80 - i * pitch, bottom, mainZ],
      "y",
      Math.floor((D - 40) / pitch),
    ],
    [
      "side",
      rad === "side" ? 0 : 3,
      (i) => [
        D / 2 - FAN / 2 - 20,
        H / 2 - 80 - i * pitch,
        (params.case.type === "dual-chamber" ? dividerZ(caseMm) : -W / 2 + PANEL) +
          FAN_DEPTH / 2 +
          2,
      ],
      "z",
      Math.floor((H - 40) / pitch),
    ],
    ["rear", 1, () => [-D / 2 + inset, H / 2 - 90, mainZ], "x", 1],
  ];
  const parts: ReferenceModelPart[] = [];
  for (const [position, cap, at, axis, room] of spots) {
    const wanted = countOf(params.fans[position as keyof AppearanceParams["fans"]]) ?? 0;
    const count = Math.min(wanted, cap, room);
    for (let index = 0; index < count; index += 1)
      parts.push(
        ...fanParts(
          `case-fan-${position}-${index + 1}`,
          at(index),
          axis,
          FAN,
          FAN_DEPTH,
          "fan-white",
        ),
      );
  }
  return parts;
}

/** A graphics card with the photo's fan count, length class, colour and light. */
export function gpuLookModel(params: AppearanceParams): ReferenceModel {
  const known = countOf(params.gpu.fanCount);
  const length = params.gpu.length;
  const fans = known ?? (length === "long" ? 3 : length === "short" ? 1 : 2);
  const lengthMm =
    length === "short"
      ? 200
      : length === "medium"
        ? 270
        : length === "long"
          ? 320
          : [0, 190, 260, 310][fans];
  const light = params.gpu.light;
  const model = gpuEnvelope({
    partId: "appearance-gpu",
    slug: "appearance-gpu",
    lengthMm: Math.max(lengthMm, fans * 95 + 20),
    heightMm: 120,
    thicknessMm: fans === 3 ? 55 : 45,
    fans,
    displayPorts: 0,
    hdmiPorts: 0,
    details: false,
    lightStrip: light !== "none" && light !== "unknown",
  });
  return {
    ...model,
    assumptions: [TYPICAL, GPU_ROTOR_ASSUMPTION],
    materials: {
      ...tint(model.materials, params.gpu.color, ["shroud-white", "backplate-white"]),
      // No model is known, so no hard black core.
      "heatsink-dark": { color: "#4A4E55", roughness: 0.6, metalness: 0.3 },
    },
  };
}

/** An AIO (radiator size, position, pump style) or an air tower, in the photo's colour. */
export function coolerLookModel(params: AppearanceParams, caseMm: Point): ReferenceModel | null {
  const mount = radiatorMount(params, caseMm);
  if (mount) {
    const style = params.cooler.pumpStyle === "unknown" ? "square" : params.cooler.pumpStyle;
    const model = aioCooler({
      partId: "appearance-cooler",
      slug: "appearance-cooler",
      radiatorLengthMm: radiatorLengthMm(params),
      fanSizeMm: radiatorFanMm(params),
      fanThicknessMm: FAN_DEPTH,
      fanCount: radiatorFans(params),
      mount,
      pumpStyle: style,
      assumptions: [TYPICAL, "The hose route is drawn, not measured."],
    });
    return {
      ...model,
      materials: tint(model.materials, params.cooler.color, ["fan-white", "hose-white"]),
    };
  }
  if (params.cooler.type === "air-tower") return towerLookModel(params);
  return null;
}

/** A single-tower air cooler on the CPU: base, heat pipes, fin stack and a front fan. */
function towerLookModel(params: AppearanceParams): ReferenceModel {
  const rel = (world: Point): Point =>
    world.map((value, k) => value - ANCHOR_MM.cooler[k]) as Point;
  const [cx, cy] = [ANCHOR_MM.cpu[0], ANCHOR_MM.cpu[1]];
  // Seated on the CPU at the board face; about 135 mm tall overall, a common single tower.
  const base = ANCHOR_MM.motherboard[2] + 5;
  const finDepth = 50;
  const finHeight = 125;
  const finReach = 100;
  const finZ = base + 28 + finReach / 2;
  const parts: ReferenceModelPart[] = [
    box("cold-plate", [40, 40, 8], rel([cx, cy, base]), "cold-plate", 1),
    ...[-12, -4, 4, 12].map(
      (dx, index): ReferenceModelPart => ({
        id: `heat-pipe-${index + 1}`,
        shape: "cylinder",
        sizeMm: [6, 6, finReach + 28],
        positionMm: rel([cx + dx, cy, base + (finReach + 28) / 2]),
        material: "cold-plate",
        axis: "z",
      }),
    ),
    {
      id: "tower-fins",
      shape: "fins",
      sizeMm: [finDepth, finHeight, finReach],
      positionMm: rel([cx, cy, finZ]),
      material: "radiator-fins",
      axis: "z",
    },
    box(
      "tower-cap",
      [finDepth + 2, finHeight + 2, 4],
      rel([cx, cy, finZ + finReach / 2 + 2]),
      "fan-white",
      1.5,
    ),
    ...fanParts(
      "tower-fan",
      rel([cx + finDepth / 2 + FAN_DEPTH / 2, cy, finZ]),
      "x",
      FAN,
      FAN_DEPTH,
      "fan-white",
    ),
  ];
  const model = placed({
    partId: "appearance-cooler",
    slug: "appearance-cooler",
    assumptions: [TYPICAL],
    parts,
    materials: pick(["fan-white", "radiator-fins", "cold-plate", "light"]),
  });
  return {
    ...model,
    materials: tint(model.materials, params.cooler.color, ["fan-white", "radiator-fins"]),
  };
}

const STICK_SLOTS: Record<string, number[]> = {
  "1": [1],
  "2": [1, 3],
  "3": [0, 1, 2],
  "4": [0, 1, 2, 3],
};

/** Memory with the photo's stick count, light bar and colour, at typical DDR5 proportions. */
export function memoryLookModel(params: AppearanceParams): ReferenceModel {
  const model = memoryKit({
    partId: "appearance-memory",
    slug: "appearance-memory",
    lengthMm: 133,
    widthMm: 7,
    heightMm: 42,
    slots: STICK_SLOTS[params.memory.sticks] ?? [1, 3],
    lightBar: params.memory.lightBar !== "no",
    assumptions: [TYPICAL],
  });
  return { ...model, materials: tint(model.materials, params.memory.color, ["fan-white"]) };
}

/** A generic ATX board in the photo's colour. */
export function boardLookModel(params: AppearanceParams): ReferenceModel {
  return appearanceModels.board(colorHex(params.motherboard.color));
}
