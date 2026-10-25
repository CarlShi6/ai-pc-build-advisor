import {
  catalogForSlot,
  selectedPart,
  type BuildDocumentV3,
  type SlotId,
  type VisualPriority,
} from "@/lib/v3/build-document";
import { proposePartSelection, type PartSelectionProposal } from "@/lib/v3/build-proposal";
import type { Part } from "@/types/parts";

export type OptimizationIntent = "reduce_cost" | "improve_performance";

export interface OptimizationOption {
  intent: OptimizationIntent;
  proposal: PartSelectionProposal;
  part: Part;
  visualImpact: string;
  performanceEvidence: string;
  physicalFit: "requires_dimension_review";
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function preservesLockedAppearance(
  part: Part,
  slot: SlotId,
  priorities: VisualPriority[],
): boolean {
  return priorities.every((priority) => {
    if (!priority.locked || priority.sourceCategory !== slot) return true;
    if (priority.category === "colorway") {
      const color = part.color ?? String(part.specs.color ?? "");
      return words(priority.value).some((word) => words(color).includes(word));
    }
    if (priority.category === "case_style") {
      const style = String(part.specs.style ?? "");
      return words(priority.value).some((word) => words(style).includes(word));
    }
    return true;
  });
}

function knownPerformance(part: Part): number | null {
  const score = part.specs.gaming1440pScore ?? part.specs.gamingScore ?? part.performanceScore;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function optimizationOptions(
  document: BuildDocumentV3,
  slot: SlotId,
  intent: OptimizationIntent,
): OptimizationOption[] {
  const current = selectedPart(document, slot);
  if (!current) return [];
  const priorities = document.imageContext?.visualPriorities ?? [];
  const currentPerformance = knownPerformance(current);
  return catalogForSlot(slot)
    .filter((part) => part.id !== current.id && preservesLockedAppearance(part, slot, priorities))
    .filter((part) =>
      intent === "reduce_cost"
        ? part.price < current.price
        : currentPerformance !== null &&
          knownPerformance(part) !== null &&
          knownPerformance(part)! > currentPerformance,
    )
    .map((part) => {
      const proposal = proposePartSelection(document, slot, part);
      const nextPerformance = knownPerformance(part);
      return {
        intent,
        proposal,
        part,
        visualImpact: priorities.some(
          (priority) => priority.locked && priority.sourceCategory === slot,
        )
          ? "Locked visible traits retained where catalog metadata permits; other appearance details remain unverified."
          : "No appearance lock for this slot; compare visible styling before confirming.",
        performanceEvidence:
          currentPerformance !== null && nextPerformance !== null
            ? `Catalog gaming score: ${currentPerformance} → ${nextPerformance}; this is not an FPS estimate.`
            : "No comparable performance score in the local catalog.",
        physicalFit: "requires_dimension_review" as const,
      };
    })
    .sort((a, b) =>
      intent === "reduce_cost"
        ? a.part.price - b.part.price
        : (knownPerformance(b.part) ?? 0) - (knownPerformance(a.part) ?? 0),
    )
    .slice(0, 3);
}
