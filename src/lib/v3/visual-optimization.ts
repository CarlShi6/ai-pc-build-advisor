import {
  catalogForSlot,
  selectedPart,
  setVisualPriorityLock,
  type BuildDocumentV3,
  type SlotId,
  type VisualPriority,
} from "@/lib/v3/build-document";
import {
  confirmPartSelection,
  proposePartSelection,
  type PartSelectionProposal,
} from "@/lib/v3/build-proposal";
import type { Part } from "@/types/parts";
import { priceUnknown } from "@/lib/v3/catalog";

/** PRD §10.1 optimization intents. */
export type OptimizationIntent =
  | "preserve_look"
  | "reduce_cost"
  | "improve_performance"
  | "balanced";

/** Balanced only: 0 favors savings, 1 favors performance. */
export type BalanceWeight = 0.25 | 0.5 | 0.75;

export type TraitOutcome = "retained" | "changed" | "unknown";

export interface TraitImpact {
  priorityId: string;
  label: string;
  locked: boolean;
  outcome: TraitOutcome;
}

export interface OptimizationOption {
  intent: OptimizationIntent;
  proposal: PartSelectionProposal;
  part: Part;
  traitImpacts: TraitImpact[];
  visualImpact: string;
  performanceEvidence: string;
  physicalFit: "requires_dimension_review";
}

export interface OptimizationResult {
  options: OptimizationOption[];
  /** Why the list is empty, including which locks block it. Null when options exist. */
  emptyReason: string | null;
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const priorityLabel: Record<VisualPriority["category"], string> = {
  colorway: "Color",
  case_style: "Case style",
  lighting: "Lighting",
  fan_layout: "Fan layout",
  component_placement: "Placement",
};

/** Compares a part with one visual priority using catalog color/style fields only. */
function traitOutcome(part: Part, priority: VisualPriority): TraitOutcome {
  if (priority.category === "colorway") {
    const color = part.color ?? String(part.specs.color ?? "");
    if (!color) return "unknown";
    return words(priority.value).some((word) => words(color).includes(word))
      ? "retained"
      : "changed";
  }
  if (priority.category === "case_style") {
    const style = String(part.specs.style ?? "");
    if (!style) return "unknown";
    return words(priority.value).some((word) => words(style).includes(word))
      ? "retained"
      : "changed";
  }
  // Lighting, fan layout and placement aren't described by catalog fields for these slots.
  return "unknown";
}

function slotPriorities(document: BuildDocumentV3, slot: SlotId) {
  return (document.imageContext?.visualPriorities ?? []).filter(
    (priority) => priority.sourceCategory === slot,
  );
}

export function traitImpacts(document: BuildDocumentV3, slot: SlotId, part: Part): TraitImpact[] {
  return slotPriorities(document, slot).map((priority) => ({
    priorityId: priority.id,
    label: `${priorityLabel[priority.category]}: ${priority.value}`,
    locked: priority.locked,
    outcome: traitOutcome(part, priority),
  }));
}

/** Locked traits this part would change. Unknown is not treated as a conflict or a match. */
export function lockConflicts(document: BuildDocumentV3, slot: SlotId, part: Part): TraitImpact[] {
  return traitImpacts(document, slot, part).filter(
    (impact) => impact.locked && impact.outcome === "changed",
  );
}

/**
 * Explicit override (PRD §10.3): confirms a selection that changes locked traits and unlocks
 * those traits in the same step, so the Build never claims a lock it no longer honors.
 */
export function confirmWithLockOverride(
  document: BuildDocumentV3,
  proposal: PartSelectionProposal,
  overriddenPriorityIds: string[],
): BuildDocumentV3 {
  return overriddenPriorityIds.reduce(
    (next, priorityId) => setVisualPriorityLock(next, priorityId, false),
    confirmPartSelection(document, proposal),
  );
}

/** Price distance for ordering; unknown prices sort last instead of looking free. */
function priceGap(part: Part, current: Part) {
  return priceUnknown(part) || priceUnknown(current)
    ? Number.POSITIVE_INFINITY
    : Math.abs(part.price - current.price);
}

function knownPerformance(part: Part): number | null {
  const score = part.specs.gaming1440pScore ?? part.specs.gamingScore ?? part.performanceScore;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function describeVisual(impacts: TraitImpact[]): string {
  if (!impacts.length)
    return "No visual priority recorded for this slot; compare visible styling before confirming.";
  const parts = impacts.map(
    (impact) => `${impact.label} ${impact.outcome}${impact.locked ? " (locked)" : ""}`,
  );
  return `${parts.join("; ")}. Based on catalog color and style fields, not a visual comparison.`;
}

function describePerformance(current: number | null, next: number | null): string {
  return current !== null && next !== null
    ? `Catalog gaming score: ${current} → ${next}; this is not an FPS estimate.`
    : "No comparable performance score in the local catalog.";
}

export function optimizationResult(
  document: BuildDocumentV3,
  slot: SlotId,
  intent: OptimizationIntent,
  balanceWeight: BalanceWeight = 0.5,
): OptimizationResult {
  const current = selectedPart(document, slot);
  if (!current) return { options: [], emptyReason: "Choose a part for this slot first." };
  const currentPerformance = knownPerformance(current);
  const lockedHere = slotPriorities(document, slot).filter((priority) => priority.locked);
  // Suggestions must show every locked trait as retained; unknown catalog data isn't offered.
  const lockSafe = catalogForSlot(slot).filter(
    (part) =>
      part.id !== current.id &&
      traitImpacts(document, slot, part).every(
        (impact) => !impact.locked || impact.outcome === "retained",
      ),
  );

  if (!lockSafe.length) {
    const blocking = lockedHere
      .map((priority) => `${priorityLabel[priority.category]}: ${priority.value}`)
      .join(", ");
    return {
      options: [],
      emptyReason: blocking
        ? `No catalog part keeps the locked look (${blocking}). Unlock it under Photo inspiration to see other parts, or keep the current part.`
        : "The local catalog has no other part for this slot.",
    };
  }

  let ranked: Part[];
  let emptyReason: string;

  if (intent === "preserve_look") {
    // Closest catalog appearance: retained traits first, then same color/style as now, then price.
    const sameAsCurrent = (part: Part) =>
      (part.color && current.color && part.color === current.color ? 1 : 0) +
      (part.specs.style !== undefined && part.specs.style === current.specs.style ? 1 : 0);
    ranked = lockSafe
      .map((part) => {
        const retained = traitImpacts(document, slot, part).filter(
          (impact) => impact.outcome === "retained",
        ).length;
        return { part, score: retained * 2 + sameAsCurrent(part) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || priceGap(a.part, current) - priceGap(b.part, current))
      .map((item) => item.part);
    emptyReason =
      "No catalog part shares this slot's recorded color or style, so a look-preserving alternative can't be shown.";
  } else if (intent === "reduce_cost") {
    ranked = lockSafe
      .filter((part) => !priceUnknown(part) && !priceUnknown(current) && part.price < current.price)
      .sort((a, b) => a.price - b.price);
    emptyReason = priceUnknown(current)
      ? "The current part's price is unknown, so cheaper options can't be compared."
      : "No cheaper catalog part keeps the locked look for this slot.";
  } else if (intent === "improve_performance") {
    ranked =
      currentPerformance === null
        ? []
        : lockSafe
            .filter((part) => (knownPerformance(part) ?? -Infinity) > currentPerformance)
            .sort((a, b) => knownPerformance(b)! - knownPerformance(a)!);
    emptyReason =
      currentPerformance === null
        ? "The local catalog has no performance score for the current part, so gains can't be compared."
        : "No faster catalog part (by catalog score) keeps the locked look for this slot.";
  } else {
    // Balanced: weigh relative catalog-score change against relative seed-price change.
    ranked =
      currentPerformance === null ||
      currentPerformance <= 0 ||
      priceUnknown(current) ||
      current.price <= 0
        ? []
        : lockSafe
            .filter((part) => knownPerformance(part) !== null && !priceUnknown(part))
            .map((part) => {
              const perfChange =
                (knownPerformance(part)! - currentPerformance) / currentPerformance;
              const priceChange = (part.price - current.price) / current.price;
              const score = balanceWeight * perfChange - (1 - balanceWeight) * priceChange;
              return { part, score, slowerAndPricier: perfChange < 0 && priceChange > 0 };
            })
            .filter((item) => !item.slowerAndPricier && item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.part);
    emptyReason =
      currentPerformance === null
        ? "Balanced needs a catalog performance score for the current part; none is available for this slot."
        : "No catalog part improves the balance of price and catalog score at this setting.";
  }

  const options = ranked.slice(0, 3).map((part): OptimizationOption => {
    const impacts = traitImpacts(document, slot, part);
    return {
      intent,
      proposal: proposePartSelection(document, slot, part),
      part,
      traitImpacts: impacts,
      visualImpact: describeVisual(impacts),
      performanceEvidence: describePerformance(currentPerformance, knownPerformance(part)),
      physicalFit: "requires_dimension_review",
    };
  });
  return { options, emptyReason: options.length ? null : emptyReason };
}

/** Options only; kept for existing callers. */
export function optimizationOptions(
  document: BuildDocumentV3,
  slot: SlotId,
  intent: OptimizationIntent,
  balanceWeight?: BalanceWeight,
): OptimizationOption[] {
  return optimizationResult(document, slot, intent, balanceWeight).options;
}
