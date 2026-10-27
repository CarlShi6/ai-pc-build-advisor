import { MM_PER_SCENE_UNIT } from "@/lib/v3/reference-models";
import type { CasePanel, SceneBox } from "@/lib/v3/scene-explode";
import type { Point } from "@/lib/v3/scene-focus";

/**
 * "Diorama" render style: a stylised miniature on a plinth, seen from above at an isometric-like
 * angle. It changes only the camera, materials, lighting and set dressing; every part keeps its
 * size, structure and count, and the Build is untouched.
 */
export type RenderStyle = "studio" | "diorama";
export const renderStyles: RenderStyle[] = ["studio", "diorama"];

/** About 30° down from above, halfway between the front (+x) and the open glass side (+z). */
export const DIORAMA_ELEVATION = (30 * Math.PI) / 180;
export const DIORAMA_AZIMUTH = (45 * Math.PI) / 180;
export const DIORAMA_VIEW: Point = [
  Math.cos(DIORAMA_ELEVATION) * Math.sin(DIORAMA_AZIMUTH),
  Math.sin(DIORAMA_ELEVATION),
  Math.cos(DIORAMA_ELEVATION) * Math.cos(DIORAMA_AZIMUTH),
];
/** A narrow perspective: close to an isometric look, still a real camera. */
export const DIORAMA_FOV = 20;
/** Share of the free canvas the whole diorama (case and plinth) fills by default. */
export const DIORAMA_FILL = 0.8;

/** Cutaway: the glass side and the front come off, like a model with two walls removed. */
export const DIORAMA_REMOVED_PANELS: CasePanel[] = ["glass", "front"];

/** Plinth: 25 mm thick at model scale, reaching past the case footprint on every side. */
export const PLINTH_THICKNESS = 25 / MM_PER_SCENE_UNIT;
export const PLINTH_MARGIN = 0.55;

/**
 * The plinth under the case: top flush with the case's underside, or under the lowest part when
 * the build is exploded below it.
 */
export function plinthBox(caseBox: SceneBox, lowestY: number): SceneBox {
  const caseBottom = caseBox.centre[1] - caseBox.size[1] / 2;
  const top = lowestY < caseBottom - 1e-6 ? lowestY - 0.06 : caseBottom;
  return {
    centre: [caseBox.centre[0], top - PLINTH_THICKNESS / 2, caseBox.centre[2]],
    size: [
      caseBox.size[0] + 2 * PLINTH_MARGIN,
      PLINTH_THICKNESS,
      caseBox.size[2] + 2 * PLINTH_MARGIN,
    ],
  };
}

/**
 * Two small, non-interactive props on the plinth top, centred in the margin beside the case: a
 * potted plant at the rear corner on the glass side and a coiled cable at the front corner on the
 * solid side. `radius` scales them; each covers at most `footprint` around its point.
 */
export function dioramaProps(plinth: SceneBox, caseBox: SceneBox) {
  const top = plinth.centre[1] + plinth.size[1] / 2;
  const margin = (plinth.size[0] - caseBox.size[0]) / 2;
  const caseMin = caseBox.centre.map((value, k) => value - caseBox.size[k] / 2);
  const caseMax = caseBox.centre.map((value, k) => value + caseBox.size[k] / 2);
  const plant: Point = [caseMin[0] - margin / 2, top, caseMax[2] + margin / 2 - 0.35];
  const cable: Point = [caseMax[0] + margin / 2, top, caseMin[2] - margin / 2 + 0.35];
  const radius = margin * 0.55;
  return { plant, cable, radius, footprint: radius * 0.62 };
}
