import type { BuildDocumentV3 } from "@/lib/v3/build-document";
import { MM_PER_SCENE_UNIT, caseGrommetsMm, type ReferenceModel } from "@/lib/v3/reference-models";
import { slotLayout, type Point } from "@/lib/v3/scene-focus";
import { slotModel } from "@/lib/v3/slot-models";

/**
 * Braided power cables of an assembled build (set dressing, not Build parts): the board's
 * 24-pin and the GPU's 16-pin, each leaving its connector and passing through a tray grommet.
 * Drawn only when the board, the GPU and the case are reference models with those features;
 * routes and diameters are visual estimates. Points are in scene units, assembled positions.
 */
export interface SceneCable {
  id: "atx-24-pin" | "gpu-16-pin";
  points: Point[];
  diameter: number;
}

const toScene = (mm: Point): Point => mm.map((value) => value / MM_PER_SCENE_UNIT) as Point;
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** A case-frame model part's world position (mm), from its slot anchor. */
function caseFramePart(model: ReferenceModel, anchor: Point, id: string) {
  const part = model.parts.find((item) => item.id === id);
  if (!part) return null;
  return { centre: add(toScene(part.positionMm), anchor), size: toScene(part.sizeMm) };
}

/**
 * A GPU-frame part's world position: the slot lays the card flat, fans down, top edge towards
 * the glass and bracket to the rear (model x → -y, y → +z, z → -x).
 */
function gpuFramePart(model: ReferenceModel, anchor: Point, id: string) {
  const part = model.parts.find((item) => item.id === id);
  if (!part) return null;
  const [x, y, z] = part.positionMm;
  return { centre: add(toScene([-z, -x, y]), anchor) };
}

export function sceneCables(document: BuildDocumentV3): SceneCable[] {
  const caseModel = slotModel(document, "case");
  if (caseModel?.kind !== "reference") return [];
  const grommets = caseGrommetsMm(caseModel.model).map((mm) =>
    add(toScene(mm), slotLayout.case.anchor),
  );
  if (grommets.length < 3) return [];
  const cables: SceneCable[] = [];
  const board = slotModel(document, "motherboard");
  const atx =
    board?.kind === "reference"
      ? caseFramePart(board.model, slotLayout.motherboard.anchor, "atx-24-pin")
      : null;
  if (atx) {
    const [x, y, z] = atx.centre;
    const face = z + atx.size[2] / 2;
    const grommet = grommets[0];
    cables.push({
      id: "atx-24-pin",
      diameter: 14 / MM_PER_SCENE_UNIT,
      points: [
        [x, y, face + 0.02],
        [x, y, face + 0.18],
        [grommet[0], (y + grommet[1]) / 2, face + 0.18],
        [grommet[0], grommet[1], (face + grommet[2]) / 2],
        [grommet[0], grommet[1], grommet[2]],
      ],
    });
  }
  const gpu = slotModel(document, "gpu");
  const power =
    gpu?.kind === "reference" && gpu.model.frame === "gpu"
      ? gpuFramePart(gpu.model, slotLayout.gpu.anchor, "power-16-pin")
      : null;
  if (power) {
    const [x, y, z] = power.centre;
    const face = z + 5 / MM_PER_SCENE_UNIT;
    const grommet = grommets[2];
    cables.push({
      id: "gpu-16-pin",
      diameter: 10 / MM_PER_SCENE_UNIT,
      points: [
        // The connector faces the glass: a short lift, then straight back towards the tray.
        [x, y, face + 0.02],
        [x, y + 0.05, face + 0.06],
        [(x + grommet[0]) / 2, (y + grommet[1]) / 2 + 0.12, face - 0.08],
        [grommet[0], grommet[1], (face + grommet[2]) / 2],
        [grommet[0], grommet[1], grommet[2]],
      ],
    });
  }
  return cables;
}
