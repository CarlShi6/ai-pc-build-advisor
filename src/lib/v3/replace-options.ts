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
  /** Seed-catalog price difference; seed prices are not live offers. */
  priceDelta: number;
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
export function replaceOptions(
  document: BuildDocumentV3,
  slot: SlotId,
  limit = 4,
): { options: ReplaceOption[]; total: number } {
  const current = selectedPart(document, slot);
  const before = compatibilitySummary(document);
  const beforeIds = new Set(document.build.compatibilityWarnings.map((warning) => warning.id));
  const all = catalogForSlot(slot)
    .filter((part) => part.id !== current?.id)
    .map((part): ReplaceOption => {
      const proposal = proposePartSelection(document, slot, part);
      return {
        part,
        proposal,
        priceDelta: proposal.priceDelta,
        before,
        after: compatibilitySummary(proposal.candidate),
        traitImpacts: traitImpacts(document, slot, part),
        lockConflicts: lockConflicts(document, slot, part),
        newFindings: proposal.candidate.build.compatibilityWarnings
          .filter((warning) => !beforeIds.has(warning.id))
          .map((warning) => warning.message),
      };
    })
    .sort(
      (a, b) =>
        a.lockConflicts.length - b.lockConflicts.length ||
        Math.abs(a.priceDelta) - Math.abs(b.priceDelta) ||
        a.part.displayName.localeCompare(b.part.displayName),
    );
  return { options: all.slice(0, limit), total: all.length };
}
