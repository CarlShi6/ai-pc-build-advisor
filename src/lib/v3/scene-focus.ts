import type { SlotId } from "@/lib/v3/build-document";

/** Scene layout and Focus/Isolate math (PRD §4.5), kept pure so it can be tested without WebGL. */
export type Point = [number, number, number];
export type SceneMode = "standard" | "exploded" | "review";

export interface SlotLayout {
  anchor: Point;
  label: Point;
  size: Point;
  /** Direction and distance used by the global explode slider. */
  offset: Point;
}

export const slotLayout: Record<SlotId, SlotLayout> = {
  case: { anchor: [0, 0, 0], label: [-2.85, 1.45, 0], size: [2.35, 3.15, 1.55], offset: [0, 0, 0] },
  motherboard: {
    anchor: [-0.25, 0.1, -0.22],
    label: [-2.85, 0.58, 0],
    size: [1.45, 1.75, 0.12],
    offset: [-0.85, 0, -0.3],
  },
  cpu: {
    anchor: [-0.24, 0.62, -0.07],
    label: [-2.85, -0.27, 0],
    size: [0.42, 0.42, 0.18],
    offset: [-1.45, 0.45, 0],
  },
  cooler: {
    anchor: [-0.25, 0.64, 0.23],
    label: [-2.85, -1.12, 0],
    size: [0.78, 0.78, 0.45],
    offset: [-1.5, 0.85, 0.8],
  },
  gpu: {
    anchor: [0.05, -0.42, 0.35],
    label: [2.85, 1.45, 0],
    size: [1.65, 0.39, 0.48],
    offset: [1.4, 0, 1],
  },
  memory: {
    anchor: [0.58, 0.55, 0.05],
    label: [2.85, 0.58, 0],
    size: [0.2, 1.06, 0.14],
    offset: [1.35, 0.4, 0.1],
  },
  storage: {
    anchor: [0.55, -0.77, 0.1],
    label: [2.85, -0.27, 0],
    size: [0.68, 0.2, 0.17],
    offset: [1.4, -0.6, 0.35],
  },
  psu: {
    anchor: [-0.37, -1.12, 0.05],
    label: [2.85, -1.12, 0],
    size: [0.85, 0.58, 0.88],
    offset: [0.95, -0.75, 0.1],
  },
};

/** How far a focused part is pulled out of the case, towards the default camera. */
export const FOCUS_PULL = 1.25;

function normalize([x, y, z]: Point): Point {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Offset applied to the focused part only. The case stays put; it is isolated by dimming. */
export function focusOffset(slot: SlotId): Point {
  if (slot === "case") return [0, 0, 0];
  const [x, y, z] = normalize(slotLayout[slot].offset);
  // Mostly outwards along the slot's own explode direction, plus a lift towards the viewer.
  return [x * FOCUS_PULL * 0.7, y * FOCUS_PULL * 0.4 + 0.15, z * FOCUS_PULL * 0.4 + 0.85];
}

/** Final (resting) position of a slot for the current mode, explode amount and focus. */
export function slotPosition(
  slot: SlotId,
  mode: SceneMode,
  explode: number,
  focusSlot: SlotId | null,
): Point {
  const spec = slotLayout[slot];
  const factor = mode === "exploded" ? Math.max(0, Math.min(100, explode)) / 100 : 0;
  const focus = focusSlot === slot ? focusOffset(slot) : [0, 0, 0];
  return spec.anchor.map(
    (value, index) => value + spec.offset[index] * factor + focus[index],
  ) as Point;
}

/** Every other slot dims while one is focused. */
export function isDimmed(slot: SlotId, focusSlot: SlotId | null): boolean {
  return focusSlot !== null && focusSlot !== slot;
}
