import {
  selectedPart,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { appearanceHex, lightHex, photoAppearance } from "@/lib/v3/photo-appearance";
import {
  MM_PER_SCENE_UNIT,
  appearanceModels,
  referenceModelFor,
  type ReferenceModel,
} from "@/lib/v3/reference-models";
import { anyKnown, type AppearanceParams, type ParamLight } from "@/lib/v3/appearance-params";
import {
  boardLookModel,
  caseLookModel,
  caseTypicalMm,
  coolerLookModel,
  gpuLookModel,
  memoryLookModel,
} from "@/lib/v3/appearance-models";
import { scenePresentation } from "@/lib/v3/scene-presentation";
import { slotLayout, type Point } from "@/lib/v3/scene-focus";

/**
 * What the scene draws in a slot, when it is a detailed model (PRD §9.3):
 * - `reference`: the selected part's reference reconstruction;
 * - `appearance`: a look-alike for a part the photo shows but whose model is not confirmed, in the
 *   photo's colour, naming no model;
 * - `ghost`: a faint generic board in an open motherboard slot, so the parts around it have
 *   something to sit on.
 * Null leaves the slot to the generic illustrative geometry.
 */
export type SlotModelKind = "reference" | "appearance" | "ghost";

export interface SlotModel {
  model: ReferenceModel;
  kind: SlotModelKind;
  /** The photo's light colour for this part's lit rings and strips, when it shows one. */
  accent?: string;
}

function accentOf(light: ParamLight): string | undefined {
  return lightHex[light] ?? undefined;
}

/** The case the parts sit in (depth, height, width in mm): confirmed model, photo type, or generic. */
function caseFrameMm(document: BuildDocumentV3, params: AppearanceParams): Point {
  if (slotOccupancy(document, "case") === "selected") {
    const model = referenceModelFor(selectedPart(document, "case")?.id);
    if (model) return model.envelopeMm;
  }
  if (params.case.type !== "unknown") return caseTypicalMm(params);
  const size =
    scenePresentation(document).layout === "showcase" ? [2.55, 3.05, 1.75] : slotLayout.case.size;
  return size.map((value) => value * MM_PER_SCENE_UNIT) as Point;
}

/** Step A: a parametric look-alike from the photo's appearance parameters, if it shows the part. */
function paramModel(
  document: BuildDocumentV3,
  slot: SlotId,
  params: AppearanceParams,
): SlotModel | null {
  const fansKnown = anyKnown(params.fans);
  if (slot === "case" && (anyKnown(params.case) || fansKnown))
    return {
      model: caseLookModel(params),
      kind: "appearance",
      accent: accentOf(params.fans.ringColor),
    };
  if (slot === "gpu" && anyKnown(params.gpu))
    return { model: gpuLookModel(params), kind: "appearance", accent: accentOf(params.gpu.light) };
  if (slot === "cooler" && anyKnown(params.cooler)) {
    const model = coolerLookModel(params, caseFrameMm(document, params));
    return model ? { model, kind: "appearance", accent: accentOf(params.fans.ringColor) } : null;
  }
  if (slot === "memory" && anyKnown(params.memory))
    return { model: memoryLookModel(params), kind: "appearance" };
  if (slot === "motherboard")
    return params.motherboard.color !== "unknown"
      ? { model: boardLookModel(params), kind: "appearance" }
      : { model: appearanceModels.ghostBoard, kind: "ghost" };
  return null;
}

export function slotModel(document: BuildDocumentV3, slot: SlotId): SlotModel | null {
  if (slotOccupancy(document, slot) === "selected") {
    const model = referenceModelFor(selectedPart(document, slot)?.id);
    return model ? { model, kind: "reference" } : null;
  }
  const params = document.imageContext?.appearance;
  if (params) return paramModel(document, slot, params);
  const look = photoAppearance(document)[slot];
  const body = look?.color ? appearanceHex[look.color] : null;
  if (look && slot === "gpu") return { model: appearanceModels.gpu(body), kind: "appearance" };
  if (look && slot === "cooler" && look.coolerType === "aio")
    return { model: appearanceModels.aio(body), kind: "appearance" };
  if (slot === "motherboard")
    return look
      ? { model: appearanceModels.board(body), kind: "appearance" }
      : { model: appearanceModels.ghostBoard, kind: "ghost" };
  return null;
}
