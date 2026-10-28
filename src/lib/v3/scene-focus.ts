import type { SlotId } from "@/lib/v3/build-document";

/** Scene layout and showcase (click-to-present) math, kept pure so it can be tested without WebGL. */
export type Point = [number, number, number];
export type SceneMode = "standard" | "exploded" | "review";

export interface SlotLayout {
  anchor: Point;
  label: Point;
  size: Point;
}

export const slotLayout: Record<SlotId, SlotLayout> = {
  case: { anchor: [0, 0, 0], label: [-2.85, 1.45, 0], size: [2.35, 3.15, 1.55] },
  motherboard: { anchor: [-0.25, 0.1, -0.22], label: [-2.85, 0.58, 0], size: [1.45, 1.75, 0.12] },
  cpu: { anchor: [-0.24, 0.62, -0.07], label: [-2.85, -0.27, 0], size: [0.42, 0.42, 0.18] },
  cooler: { anchor: [-0.25, 0.64, 0.23], label: [-2.85, -1.12, 0], size: [0.78, 0.78, 0.45] },
  gpu: { anchor: [0.05, -0.42, 0.35], label: [2.85, 1.45, 0], size: [1.65, 0.39, 0.48] },
  memory: { anchor: [0.58, 0.55, 0.05], label: [2.85, 0.58, 0], size: [0.2, 1.06, 0.14] },
  storage: { anchor: [0.55, -0.77, 0.1], label: [2.85, -0.27, 0], size: [0.68, 0.2, 0.17] },
  psu: { anchor: [-0.37, -1.12, 0.05], label: [2.85, -1.12, 0], size: [0.85, 0.58, 0.88] },
};

/** Default camera: side front, looking in through the glass side panel (+z). */
export const DEFAULT_CAMERA: Point = [3.4, 1.2, 8.6];
export const CAMERA_FOV = 38;
/**
 * Exploded overview: about 30° off the glass side and higher than the default, so the board
 * (moving out the rear) stays to the left of the frame instead of behind it, and the glass,
 * memory and CPU (moving out the glass side) pass in front.
 */
export const EXPLODED_VIEW: Point = [3.6, 3.4, 6.6];

function normalize([x, y, z]: Point): Point {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a: Point, b: Point, scale = 1): Point => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];

/**
 * Showcase (E2): a clicked part leaves the case for a fixed spot in front of it, turns its best
 * face to the camera, and the rest dims and steps back. The camera looks at the spot from
 * straight ahead, a little above (`FOCUS_ELEVATION` radians).
 */
export const FOCUS_ELEVATION = 0.12;
/** Unit vector from the showcase spot towards the camera. */
export const FOCUS_VIEW: Point = [0, Math.sin(FOCUS_ELEVATION), Math.cos(FOCUS_ELEVATION)];
export const SHOWCASE_POINT: Point = [0, 0.3, 2.4];
/** How far everything else steps back, away from the camera, while a part is shown. */
export const RECEDE: Point = FOCUS_VIEW.map((value) => -value * 1.2) as Point;
/** Share of the free area (canvas minus the card) the shown part fills. */
export const FOCUS_FILL = 0.66;

/**
 * Best face towards the camera, from the part's assembled pose: the board flat on, the GPU's
 * fans (facing down when installed) forward, memory's side forward, the AIO pump face forward.
 * Every turn ends with a tilt back by the camera's elevation.
 */
export function showcaseRotation(slot: SlotId, airTower = false): Point {
  const tilt = -FOCUS_ELEVATION;
  if (slot === "case") return [0, 0, 0];
  // An air tower's fan faces the front (+x): a quarter turn brings it to the camera.
  if (slot === "cooler" && airTower) return [tilt, -Math.PI / 2, 0];
  if (slot === "gpu") return [-Math.PI / 2 + tilt, 0, 0];
  // Memory stands upright in its slots: turn its side forward and lay it flat, long edge across.
  if (slot === "memory") return [-Math.PI / 2 + tilt, 0, -Math.PI / 2];
  return [tilt, 0, 0];
}

/** Every other slot dims while one is focused. */
export function isDimmed(slot: SlotId, focusSlot: SlotId | null): boolean {
  return focusSlot !== null && focusSlot !== slot;
}

/** Free area for the shown part and where the replace card sits, in canvas pixels. */
export interface FocusFrame {
  card: { left: number; top: number; maxHeight: number };
  free: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Canvas pixels kept clear: the panel header and the "Show full build" button above, the mode
 * buttons below. The card may start higher, beside the button.
 */
export const FRAME_TOP = 112;
export const FRAME_BOTTOM = 72;
const CARD_TOP = 76;

/** Narrower canvases put the card under the part instead of beside it. */
export const SIDE_CARD_MIN_WIDTH = 720;

export function focusFrame(
  width: number,
  height: number,
  cardWidth: number,
  cardHeight: number,
): FocusFrame {
  const margin = 16;
  if (width >= SIDE_CARD_MIN_WIDTH) {
    const left = width - cardWidth - margin;
    return {
      card: {
        left,
        // Top-aligned beside the "Show full build" button; scrolls above the mode buttons.
        top: CARD_TOP,
        maxHeight: height - CARD_TOP - FRAME_BOTTOM,
      },
      free: { x0: margin, y0: FRAME_TOP, x1: left - margin, y1: height - FRAME_BOTTOM },
    };
  }
  const cardTop = Math.max(FRAME_TOP + 80, height - cardHeight - FRAME_BOTTOM);
  return {
    card: { left: 12, top: cardTop, maxHeight: height - cardTop - FRAME_BOTTOM },
    free: { x0: margin, y0: FRAME_TOP, x1: width - margin, y1: cardTop - 12 },
  };
}

export interface BoxLike {
  centre: Point;
  size: Point;
}

export interface CameraPose {
  position: Point;
  target: Point;
}

function cameraBasis(back: Point) {
  const forward = back.map((value) => -value) as Point;
  const right = normalize(cross(forward, [0, 1, 0]));
  return { forward, right, up: cross(right, forward) };
}

/**
 * Camera pose looking along -`view` that puts `box` in the middle of the free area, filling
 * `fill` of it in its tighter direction (measured at the box's nearest face).
 */
export function fitCamera(
  box: BoxLike,
  view: Point,
  fovDegrees: number,
  canvas: { width: number; height: number },
  free: FocusFrame["free"],
  fill: number,
): CameraPose {
  const back = normalize(view);
  const { forward, right, up } = cameraBasis(back);
  const half = box.size.map((value) => value / 2) as Point;
  const extent = (axis: Point) =>
    Math.abs(axis[0]) * half[0] + Math.abs(axis[1]) * half[1] + Math.abs(axis[2]) * half[2];
  const tan = Math.tan((fovDegrees * Math.PI) / 360);
  const aspect = canvas.width / canvas.height;
  const freeW = Math.max(0.05, (free.x1 - free.x0) / canvas.width);
  const freeH = Math.max(0.05, (free.y1 - free.y0) / canvas.height);
  const near = Math.max(
    extent(up) / (tan * fill * freeH),
    extent(right) / (tan * aspect * fill * freeW),
  );
  const distance = near + extent(forward);
  // Normalised device coordinates of the free area's centre.
  const cx = (free.x0 + free.x1) / canvas.width - 1;
  const cy = 1 - (free.y0 + free.y1) / canvas.height;
  let target = add(box.centre, right, -cx * distance * tan * aspect);
  target = add(target, up, -cy * distance * tan);
  return { position: add(target, back, distance), target };
}

/** Pixel rectangle a box covers on the canvas for a camera pose (perspective projection). */
export function projectBox(
  box: BoxLike,
  pose: CameraPose,
  fovDegrees: number,
  canvas: { width: number; height: number },
) {
  const { forward, right, up } = cameraBasis(normalize(add(pose.position, pose.target, -1)));
  const tan = Math.tan((fovDegrees * Math.PI) / 360);
  const aspect = canvas.width / canvas.height;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const corner: Point = [
          box.centre[0] + (sx * box.size[0]) / 2,
          box.centre[1] + (sy * box.size[1]) / 2,
          box.centre[2] + (sz * box.size[2]) / 2,
        ];
        const relative = add(corner, pose.position, -1);
        const depth = dot(relative, forward);
        xs.push(((dot(relative, right) / (depth * tan * aspect) + 1) * canvas.width) / 2);
        ys.push(((1 - dot(relative, up) / (depth * tan)) * canvas.height) / 2);
      }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Like `fitCamera` for several boxes, but fitted to their actual projected outline rather than
 * the corners of one box around them all (much tighter for a spread-out exploded layout).
 */
export function fitBoxes(
  boxes: BoxLike[],
  view: Point,
  fovDegrees: number,
  canvas: { width: number; height: number },
  free: FocusFrame["free"],
  fill: number,
): CameraPose {
  const min = [0, 1, 2].map((k) =>
    Math.min(...boxes.map((box) => box.centre[k] - box.size[k] / 2)),
  );
  const max = [0, 1, 2].map((k) =>
    Math.max(...boxes.map((box) => box.centre[k] + box.size[k] / 2)),
  );
  const union: BoxLike = {
    centre: min.map((value, k) => (value + max[k]) / 2) as Point,
    size: min.map((value, k) => max[k] - value) as Point,
  };
  let pose = fitCamera(union, view, fovDegrees, canvas, free, fill);
  const tan = Math.tan((fovDegrees * Math.PI) / 360);
  const aspect = canvas.width / canvas.height;
  const freeW = free.x1 - free.x0;
  const freeH = free.y1 - free.y0;
  for (let pass = 0; pass < 4; pass += 1) {
    const rects = boxes.map((box) => projectBox(box, pose, fovDegrees, canvas));
    const x0 = Math.min(...rects.map((rect) => rect.x0));
    const x1 = Math.max(...rects.map((rect) => rect.x1));
    const y0 = Math.min(...rects.map((rect) => rect.y0));
    const y1 = Math.max(...rects.map((rect) => rect.y1));
    const scale = Math.max((x1 - x0) / freeW, (y1 - y0) / freeH) / fill;
    const back = add(pose.position, pose.target, -1);
    const distance = Math.hypot(...back);
    const { right, up } = cameraBasis(normalize(back));
    // Shift so the outline's centre lands on the free area's centre, then dolly to the fill.
    const dx = ((x0 + x1 - free.x0 - free.x1) / canvas.width) * distance * tan * aspect;
    const dy = (-(y0 + y1 - free.y0 - free.y1) / canvas.height) * distance * tan;
    const target = add(add(pose.target, right, dx), up, dy);
    pose = { target, position: add(target, normalize(back), distance * scale) };
  }
  return pose;
}
