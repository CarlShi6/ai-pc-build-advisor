import {
  selectedPart,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { appearanceHex, photoAppearance } from "@/lib/v3/photo-appearance";
import {
  appearanceModels,
  referenceModelFor,
  type ReferenceModel,
} from "@/lib/v3/reference-models";

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
}

export function slotModel(document: BuildDocumentV3, slot: SlotId): SlotModel | null {
  if (slotOccupancy(document, slot) === "selected") {
    const model = referenceModelFor(selectedPart(document, slot)?.id);
    return model ? { model, kind: "reference" } : null;
  }
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
