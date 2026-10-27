import {
  primarySlots,
  slotLabel,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { photoAppearance, photoFans } from "@/lib/v3/photo-appearance";
import { referenceModelSlots } from "@/lib/v3/reference-models";

/**
 * The scene's one-line disclosure: every slot under exactly one kind of geometry.
 * - Reference reconstruction: the selected part's model, at manufacturer dimensions.
 * - Appearance from photo: a look-alike for a part the photo shows (plus photo fans, which are a
 *   style note, not Build parts); no model is named.
 * - Illustrative: generic geometry, including empty slots and the ghosted board.
 */
export type DisclosureKind = "reference" | "photo" | "illustrative";

export interface DisclosureGroup {
  kind: DisclosureKind;
  label: string;
  items: string[];
}

export const DISCLOSURE_NOTE = "Nothing here checks physical fit.";

export function sceneDisclosure(document: BuildDocumentV3): DisclosureGroup[] {
  const reference = referenceModelSlots(document);
  const photo = Object.keys(photoAppearance(document)) as SlotId[];
  const fans = photoFans(document);
  const illustrative = primarySlots.filter(
    (slot) => !reference.includes(slot) && !photo.includes(slot),
  );
  const groups: DisclosureGroup[] = [
    {
      kind: "reference",
      label: "Reference reconstruction",
      items: reference.map((slot) => slotLabel[slot]),
    },
    {
      kind: "photo",
      label: "Appearance from photo",
      items: [
        ...photo.map((slot) => slotLabel[slot]),
        ...(fans ? [`${fans.count} fan${fans.count === 1 ? "" : "s"}`] : []),
      ],
    },
    {
      kind: "illustrative",
      label: "Illustrative",
      items: illustrative.map((slot) => slotLabel[slot]),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
