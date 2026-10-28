import { describe, expect, it } from "vitest";
import { primarySlots } from "@/lib/v3/build-document";
import {
  CAMERA_FOV,
  FOCUS_FILL,
  FOCUS_VIEW,
  focusFrame,
  fitCamera,
  isDimmed,
  projectBox,
  showcaseRotation,
  SHOWCASE_POINT,
  type Point,
} from "@/lib/v3/scene-focus";

// Boxes as shown (best face forward): board, GPU fans-forward, AIO, memory side-on, CPU, case.
const shown: [string, Point][] = [
  ["motherboard", [1.63, 2.03, 0.25]],
  ["gpu", [2.28, 1.05, 0.33]],
  ["cooler", [2.64, 0.95, 0.8]],
  ["memory", [0.9, 0.29, 0.18]],
  ["cpu", [0.42, 0.42, 0.18]],
  ["case", [3.11, 3.06, 1.91]],
];

describe("showcase framing (E2)", () => {
  for (const [width, height] of [
    [1264, 640],
    [390, 640],
  ])
    it.each(shown)(`%s fills about two thirds of the free area at ${width}px`, (_, size) => {
      const canvas = { width, height };
      const frame = focusFrame(width, height, width >= 720 ? 320 : 366, 240);
      const box = { centre: SHOWCASE_POINT, size };
      const pose = fitCamera(box, FOCUS_VIEW, CAMERA_FOV, canvas, frame.free, FOCUS_FILL);
      const rect = projectBox(box, pose, CAMERA_FOV, canvas);
      // Fully inside the free area: on the canvas and clear of the card.
      expect(rect.x0).toBeGreaterThanOrEqual(frame.free.x0 - 1);
      expect(rect.x1).toBeLessThanOrEqual(frame.free.x1 + 1);
      expect(rect.y0).toBeGreaterThanOrEqual(frame.free.y0 - 1);
      expect(rect.y1).toBeLessThanOrEqual(frame.free.y1 + 1);
      const fill = Math.max(
        (rect.x1 - rect.x0) / (frame.free.x1 - frame.free.x0),
        (rect.y1 - rect.y0) / (frame.free.y1 - frame.free.y0),
      );
      expect(fill).toBeGreaterThan(0.55);
      expect(fill).toBeLessThan(0.75);
    });

  it("puts the card beside the part on wide canvases and under it on narrow ones", () => {
    const wide = focusFrame(1264, 640, 320, 300);
    expect(wide.card.left).toBeGreaterThanOrEqual(wide.free.x1);
    expect(wide.card.top + wide.card.maxHeight).toBeLessThanOrEqual(640 - 72);
    const narrow = focusFrame(390, 640, 366, 240);
    expect(narrow.card.top).toBeGreaterThanOrEqual(narrow.free.y1);
  });

  it("turns each part's best face to the camera", () => {
    expect(showcaseRotation("case")).toEqual([0, 0, 0]);
    // GPU fans face down (-y) when installed; a quarter turn about x brings them forward.
    expect(showcaseRotation("gpu")[0]).toBeCloseTo(-Math.PI / 2 - 0.12);
    // Memory: side face (+x) forward, long edge (+y) across.
    expect(showcaseRotation("memory")).toEqual([-Math.PI / 2 - 0.12, 0, -Math.PI / 2]);
    // An air tower turns its front fan to the camera.
    expect(showcaseRotation("cooler", true)[1]).toBeCloseTo(-Math.PI / 2);
  });

  it("dims every other slot only while something is focused", () => {
    expect(primarySlots.some((slot) => isDimmed(slot, null))).toBe(false);
    expect(primarySlots.filter((slot) => isDimmed(slot, "cooler"))).toHaveLength(7);
    expect(isDimmed("cooler", "cooler")).toBe(false);
  });
});
