import type { ReactNode } from "react";
import {
  primarySlots,
  selectedPart,
  slotLabel,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { priceUnknown } from "@/lib/v3/catalog";
import { referenceModelFor } from "@/lib/v3/reference-models";
import {
  PHOTO_APPEARANCE_LABEL,
  appearanceSummary,
  colorName,
  photoAppearance,
} from "@/lib/v3/photo-appearance";

/**
 * The Studio's 2D layout: the same eight slots as the 3D scene, as cards. It is the full
 * fallback when WebGL is unavailable, so a card opens the same replace card the 3D focus uses.
 */
export function SlotGrid2D({
  document,
  selectedSlot,
  focusSlot,
  onPick,
  focusCard,
}: {
  document: BuildDocumentV3;
  selectedSlot: SlotId;
  focusSlot: SlotId | null;
  onPick: (slot: SlotId) => void;
  focusCard: ReactNode;
}) {
  const looks = photoAppearance(document);
  return (
    <div className="v3-slot-grid-2d">
      <div className="v3-slot-grid-cards">
        {primarySlots.map((slot) => {
          const part = selectedPart(document, slot);
          const occupancy = slotOccupancy(document, slot);
          const look = looks[slot];
          return (
            <button
              type="button"
              key={slot}
              data-slot={slot}
              data-color={look?.color ?? colorName(part?.color) ?? undefined}
              data-look={look ? "photo" : undefined}
              className={`${occupancy} ${selectedSlot === slot ? "active" : ""}`}
              aria-pressed={focusSlot === slot}
              onClick={() => onPick(slot)}
            >
              <span className="v3-slot-grid-label">{slotLabel[slot]}</span>
              <strong>
                {part?.displayName ??
                  (look
                    ? appearanceSummary(look)
                    : occupancy === "unresolved"
                      ? "Identity unresolved"
                      : "No part yet")}
              </strong>
              <small>
                {!part
                  ? look
                    ? PHOTO_APPEARANCE_LABEL
                    : occupancy === "unresolved"
                      ? "Review the match"
                      : "Add part"
                  : part.owned
                    ? "Already owned"
                    : priceUnknown(part)
                      ? "Price unknown"
                      : `$${part.price.toLocaleString()}`}
                {part && (referenceModelFor(part.id) ? " · Reference reconstruction" : "")}
              </small>
            </button>
          );
        })}
      </div>
      {focusSlot && focusCard && <div className="v3-slot-grid-card">{focusCard}</div>}
    </div>
  );
}
