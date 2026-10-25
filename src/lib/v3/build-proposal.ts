import {
  completeness,
  removePart,
  selectPart,
  selectedPart,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import type { Part } from "@/types/parts";

export interface PartSelectionProposal {
  baseRevision: number;
  slot: SlotId;
  previousPartId?: string;
  nextPartId: string;
  candidate: BuildDocumentV3;
  priceDelta: number;
  compatibilityBefore: BuildDocumentV3["build"]["compatibilityStatus"];
  compatibilityAfter: BuildDocumentV3["build"]["compatibilityStatus"];
  selectedBefore: number;
  selectedAfter: number;
}

export function proposePartSelection(
  current: BuildDocumentV3,
  slot: SlotId,
  part: Part,
): PartSelectionProposal {
  const previous = current.build.parts.find((item) => item.category === part.category);
  const candidate = selectPart(current, slot, part);
  return {
    baseRevision: current.revision,
    slot,
    previousPartId: previous?.id,
    nextPartId: part.id,
    candidate,
    priceDelta: candidate.build.totalPrice - current.build.totalPrice,
    compatibilityBefore: current.build.compatibilityStatus,
    compatibilityAfter: candidate.build.compatibilityStatus,
    selectedBefore: completeness(current).selected,
    selectedAfter: completeness(candidate).selected,
  };
}

export function confirmPartSelection(
  current: BuildDocumentV3,
  proposal: PartSelectionProposal,
): BuildDocumentV3 {
  if (
    current.revision !== proposal.baseRevision ||
    proposal.candidate.revision !== current.revision + 1
  ) {
    throw new Error("The build changed after this preview. Review the selection again.");
  }
  if (proposal.candidate.build.id !== current.build.id)
    throw new Error("The preview belongs to a different build.");
  const next = proposal.candidate.build.parts.find((part) => part.id === proposal.nextPartId);
  if (!next) throw new Error("The preview no longer contains the selected part.");
  return selectPart(current, proposal.slot, next);
}

export interface PartRemovalProposal {
  baseRevision: number;
  slot: SlotId;
  previousPartId: string;
  candidate: BuildDocumentV3;
  priceDelta: number;
}

export function proposePartRemoval(current: BuildDocumentV3, slot: SlotId): PartRemovalProposal {
  const previous = selectedPart(current, slot);
  if (!previous) throw new Error("This slot has no selected part.");
  const candidate = removePart(current, slot);
  return {
    baseRevision: current.revision,
    slot,
    previousPartId: previous.id,
    candidate,
    priceDelta: candidate.build.totalPrice - current.build.totalPrice,
  };
}

export function confirmPartRemoval(
  current: BuildDocumentV3,
  proposal: PartRemovalProposal,
): BuildDocumentV3 {
  if (
    current.revision !== proposal.baseRevision ||
    selectedPart(current, proposal.slot)?.id !== proposal.previousPartId
  ) {
    throw new Error("The build changed after this preview. Review the removal again.");
  }
  return removePart(current, proposal.slot);
}
