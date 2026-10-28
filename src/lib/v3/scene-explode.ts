import {
  primarySlots,
  selectedPart,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import {
  MM_PER_SCENE_UNIT,
  referenceModelFor,
  sceneCentre,
  sceneSize,
  type ReferenceModel,
  type ReferenceModelPart,
} from "@/lib/v3/reference-models";
import { scenePresentation } from "@/lib/v3/scene-presentation";
import { slotModel } from "@/lib/v3/slot-models";
import { slotLayout, type Point } from "@/lib/v3/scene-focus";

/**
 * Exploded view (E1), kept pure so it can be tested without WebGL. The case splits into its
 * panels and main frame; every part and panel moves along its own direction, and each distance
 * comes from the bounding boxes so that at 100% no two boxes intersect.
 */
export type CasePanel = "glass" | "back" | "front" | "top" | "shroud";
/** A slot (the "case" slot is the case's main frame) or one of the case's panels. */
export type ExplodeId = SlotId | CasePanel;

export const casePanels: CasePanel[] = ["glass", "back", "front", "top", "shroud"];

export interface SceneBox {
  centre: Point;
  size: Point;
}

function normalize([x, y, z]: Point): Point {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/**
 * Scene axes: x = depth (front +x), y = up, z = width (glass side +z). Seen from the front, the
 * glass side is on the left and the solid side on the right.
 */
export const explodeDirection: Record<ExplodeId, Point> = {
  case: [0, 0, 0],
  motherboard: [-1, 0, 0],
  // CPU and memory come off the board towards the viewer, fanned slightly apart.
  cpu: normalize([0.25, 0.2, 1]),
  cooler: [0, 1, 0],
  memory: normalize([0.45, 0.05, 1]),
  gpu: normalize([1, -0.35, 0]),
  storage: [0, 0, 1],
  // Down and out the glass side: straight down it would hide under the case floor, and from above
  // it must land clear of the radiator.
  psu: normalize([0, -0.6, 1]),
  glass: [0, 0, 1],
  back: [0, 0, -1],
  front: [1, 0, 0],
  // Up and towards the rear, so it never parks right above the radiator it would hide.
  top: normalize([-0.6, 1, 0]),
  // Out the rear, low: under the board, clear of the PSU and GPU paths.
  shroud: normalize([-1, -0.35, 0]),
};

/** Placement order: the frame stays put, parts clear it first, then panels clear everything. */
export const explodeOrder: ExplodeId[] = [
  "case",
  "motherboard",
  "cpu",
  "cooler",
  "memory",
  "gpu",
  "storage",
  "psu",
  "glass",
  "top",
  "front",
  "back",
  "shroud",
];

/**
 * Extra travel beyond the first clear position: small parts that sit against the board are pulled
 * well clear of the case outline, so they are easy to see and to click.
 */
export const EXPLODE_EXTRA: Partial<Record<ExplodeId, number>> = { cpu: 1.1, memory: 1.1 };

/** Clear space kept between any two exploded boxes, and the least a part or panel moves. */
export const EXPLODE_GAP = 0.12;
export const EXPLODE_MIN_PULL = 0.2;

/** Open range of distances along `direction` at which `moving` overlaps `fixed` (gap included). */
function blockedRange(
  moving: SceneBox,
  direction: Point,
  fixed: SceneBox,
  gap: number,
): [number, number] | null {
  let lo = -Infinity;
  let hi = Infinity;
  for (let k = 0; k < 3; k += 1) {
    const reach = (moving.size[k] + fixed.size[k]) / 2 + gap;
    const delta = fixed.centre[k] - moving.centre[k];
    if (direction[k] === 0) {
      if (Math.abs(delta) >= reach) return null;
      continue;
    }
    const a = (delta - reach) / direction[k];
    const b = (delta + reach) / direction[k];
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  return lo < hi ? [lo, hi] : null;
}

export function shiftBox(box: SceneBox, offset: Point): SceneBox {
  return { centre: box.centre.map((value, k) => value + offset[k]) as Point, size: box.size };
}

/**
 * Distance each item travels at 100%: the least distance (at least `EXPLODE_MIN_PULL`) at which
 * its box, moved along its direction, keeps `EXPLODE_GAP` from every item placed before it.
 */
export function explodeDistances(
  boxes: Partial<Record<ExplodeId, SceneBox>>,
): Partial<Record<ExplodeId, number>> {
  const placed: SceneBox[] = [];
  const distances: Partial<Record<ExplodeId, number>> = {};
  for (const id of explodeOrder) {
    const box = boxes[id];
    if (!box) continue;
    const direction = explodeDirection[id];
    if (id === "case") {
      distances[id] = 0;
      placed.push(box);
      continue;
    }
    const ranges = placed
      .map((other) => blockedRange(box, direction, other, EXPLODE_GAP))
      .filter((range): range is [number, number] => range !== null);
    const clear = (start: number) => {
      let distance = start;
      for (let moved = true; moved; ) {
        moved = false;
        for (const [lo, hi] of ranges)
          if (distance > lo && distance < hi) {
            distance = hi + 1e-6;
            moved = true;
          }
      }
      return distance;
    };
    const distance = clear(clear(EXPLODE_MIN_PULL) + (EXPLODE_EXTRA[id] ?? 0));
    distances[id] = distance;
    placed.push(shiftBox(box, direction.map((value) => value * distance) as Point));
  }
  return distances;
}

/** Offset of one item at `amount` (0–1) of the full explode, from precomputed distances. */
export function explodeOffset(
  id: ExplodeId,
  distances: Partial<Record<ExplodeId, number>>,
  amount: number,
): Point {
  const t = Math.max(0, Math.min(1, amount));
  const distance = (distances[id] ?? 0) * t;
  return explodeDirection[id].map((value) => value * distance + 0) as Point; // + 0: no -0
}

/** Wall thickness and PSU-shroud height of the generic (illustrative) case, in scene units. */
export const GENERIC_CASE_WALL = 0.035;
export const GENERIC_SHROUD_FROM_BOTTOM = 0.72;

/** Size of the case slot when no reference model draws it. */
export function genericCaseSize(document: BuildDocumentV3): Point {
  return scenePresentation(document).layout === "showcase"
    ? [2.55, 3.05, 1.75]
    : slotLayout.case.size;
}

/** Panel boxes of the generic case, matching the boxes `CaseModel` draws. */
export function genericCasePanels([w, h, d]: Point): Record<CasePanel, SceneBox> {
  const t = GENERIC_CASE_WALL;
  return {
    glass: { centre: [0, 0, d / 2], size: [w, h, 0.02] },
    back: { centre: [0, 0, -d / 2], size: [w, h, t] },
    front: { centre: [w / 2, 0, 0], size: [t, h, d] },
    top: { centre: [0, h / 2, 0], size: [w, t, d] },
    shroud: {
      centre: [0, -h / 2 + GENERIC_SHROUD_FROM_BOTTOM, 0],
      size: [w - t * 2, 0.04, d - t * 2],
    },
  };
}

/** Thinner than this (mm) along a face's axis, and within `FACE_REACH_MM` of it: a panel. */
const PANEL_THICKNESS_MM = 12;
const FACE_REACH_MM = 8;

function partBounds(part: ReferenceModelPart) {
  return {
    min: part.positionMm.map((value, k) => value - part.sizeMm[k] / 2) as Point,
    max: part.positionMm.map((value, k) => value + part.sizeMm[k] / 2) as Point,
  };
}

/**
 * Which panel of a reference case a part belongs to, or null for the main frame: a PSU shroud
 * by name, else a thin part on the top, front, glass-side (+z) or solid-side (-z) face.
 */
export function casePanelOf(part: ReferenceModelPart, model: ReferenceModel): CasePanel | null {
  if (/shroud|bottom-tray/.test(part.id)) return "shroud";
  const all = model.parts.map(partBounds);
  const min = [0, 1, 2].map((k) => Math.min(...all.map((item) => item.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...all.map((item) => item.max[k])));
  const own = partBounds(part);
  const faces: [CasePanel, number, 1 | -1][] = [
    ["top", 1, 1],
    ["front", 0, 1],
    ["glass", 2, 1],
    ["back", 2, -1],
  ];
  for (const [panel, k, sign] of faces) {
    const thin = part.sizeMm[k] <= PANEL_THICKNESS_MM;
    const touches =
      sign > 0 ? max[k] - own.max[k] <= FACE_REACH_MM : own.min[k] - min[k] <= FACE_REACH_MM;
    if (thin && touches) return panel;
  }
  return null;
}

function boundsBox(parts: ReferenceModelPart[]): SceneBox {
  const all = parts.map(partBounds);
  const min = [0, 1, 2].map((k) => Math.min(...all.map((item) => item.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...all.map((item) => item.max[k])));
  return {
    centre: min.map((value, k) => (value + max[k]) / 2 / MM_PER_SCENE_UNIT) as Point,
    size: min.map((value, k) => (max[k] - value) / MM_PER_SCENE_UNIT) as Point,
  };
}

/** Assembled box of a slot, the same size the scene draws it at. */
export function slotBox(document: BuildDocumentV3, slot: SlotId): SceneBox {
  // Reference models, photo look-alikes and the ghosted board are drawn at their own size.
  const model = slotModel(document, slot)?.model;
  const anchor = slotLayout[slot].anchor;
  const centre = model?.frame === "case" ? sceneCentre(model) : ([0, 0, 0] as Point);
  const size = model
    ? sceneSize(model)
    : slot === "case"
      ? genericCaseSize(document)
      : slotLayout[slot].size;
  // A vertical GPU stands on its end: length and thickness swap.
  const turned =
    slot === "gpu" && scenePresentation(document).gpuVertical
      ? ([size[1], size[0], size[2]] as Point)
      : size;
  return { centre: anchor.map((value, k) => value + centre[k]) as Point, size: turned };
}

/** Assembled boxes of every slot and case panel; the "case" box is the whole main frame. */
export function sceneBoxes(document: BuildDocumentV3): Record<ExplodeId, SceneBox> {
  const slots = Object.fromEntries(primarySlots.map((slot) => [slot, slotBox(document, slot)]));
  const caseBox = slots.case as SceneBox;
  const model =
    slotOccupancy(document, "case") === "selected"
      ? referenceModelFor(selectedPart(document, "case")?.id)
      : null;
  let panels: Partial<Record<CasePanel, SceneBox>>;
  if (model) {
    panels = {};
    for (const panel of casePanels) {
      const parts = model.parts.filter((part) => casePanelOf(part, model) === panel);
      if (parts.length) panels[panel] = shiftBox(boundsBox(parts), caseBox.centre);
    }
  } else {
    panels = Object.fromEntries(
      Object.entries(genericCasePanels(caseBox.size)).map(([panel, box]) => [
        panel,
        shiftBox(box, caseBox.centre),
      ]),
    );
  }
  return { ...slots, ...panels } as Record<ExplodeId, SceneBox>;
}

/** Whether two boxes overlap (touching faces do not count). */
export function boxesIntersect(a: SceneBox, b: SceneBox): boolean {
  return [0, 1, 2].every((k) => Math.abs(a.centre[k] - b.centre[k]) < (a.size[k] + b.size[k]) / 2);
}
