import {
  catalogForSlot,
  completeness,
  selectedPart,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { proposePartSelection, type PartSelectionProposal } from "@/lib/v3/build-proposal";
import { lockConflicts, traitImpacts, type TraitImpact } from "@/lib/v3/visual-optimization";
import type { Part } from "@/types/parts";
import { priceCoverage, priceUnknown } from "@/lib/v3/catalog";

/**
 * Data for the in-scene replace card (demo track week 2). Every option is a normal
 * `proposePartSelection` preview; nothing here changes the Build.
 */
export interface CompatibilitySummary {
  /** "Incomplete" while any slot is open or unresolved; never "pass" for a partial build. */
  label: "Incomplete" | "pass" | "warning" | "fail";
  findings: number;
}

export interface ReplaceOption {
  part: Part;
  proposal: PartSelectionProposal;
  /** Known price difference, or null when either price is unknown (never treated as $0). */
  priceDelta: number | null;
  /** Known total after the swap and how many prices it leaves unknown. */
  totalAfter: { known: number; unknown: number };
  before: CompatibilitySummary;
  after: CompatibilitySummary;
  traitImpacts: TraitImpact[];
  /** Locked traits this part would change; confirming requires an explicit override. */
  lockConflicts: TraitImpact[];
  /** Rule findings the swap would add, so a new warning is explained, not just counted. */
  newFindings: string[];
}

export function compatibilitySummary(document: BuildDocumentV3): CompatibilitySummary {
  return {
    label: completeness(document).complete ? document.build.compatibilityStatus : "Incomplete",
    findings: document.build.compatibilityWarnings.length,
  };
}

/** Candidates for one slot: lock-safe parts first, then the closest seed price. */
/** The preview of putting one catalog part in a slot (nothing changes until it is confirmed). */
export function replaceOption(document: BuildDocumentV3, slot: SlotId, part: Part): ReplaceOption {
  const current = selectedPart(document, slot);
  const beforeIds = new Set(document.build.compatibilityWarnings.map((warning) => warning.id));
  const proposal = proposePartSelection(document, slot, part);
  return {
    part,
    proposal,
    priceDelta:
      priceUnknown(part) || (current && priceUnknown(current))
        ? null
        : part.price - (current?.price ?? 0),
    totalAfter: priceCoverage(proposal.candidate.build.parts),
    before: compatibilitySummary(document),
    after: compatibilitySummary(proposal.candidate),
    traitImpacts: traitImpacts(document, slot, part),
    lockConflicts: lockConflicts(document, slot, part),
    newFindings: proposal.candidate.build.compatibilityWarnings
      .filter((warning) => !beforeIds.has(warning.id))
      .map((warning) => warning.message),
  };
}

export function replaceOptions(
  document: BuildDocumentV3,
  slot: SlotId,
  limit = 4,
): { options: ReplaceOption[]; total: number } {
  const current = selectedPart(document, slot);
  const all = catalogForSlot(slot)
    .filter((part) => part.id !== current?.id)
    .map((part) => replaceOption(document, slot, part))
    .sort(
      (a, b) =>
        a.lockConflicts.length - b.lockConflicts.length ||
        Math.abs(a.priceDelta ?? Number.POSITIVE_INFINITY) -
          Math.abs(b.priceDelta ?? Number.POSITIVE_INFINITY) ||
        a.part.displayName.localeCompare(b.part.displayName),
    );
  return { options: all.slice(0, limit), total: all.length };
}
