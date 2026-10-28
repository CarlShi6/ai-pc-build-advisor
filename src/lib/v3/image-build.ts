import { catalogPartById, priceCoverage, priceUnknown } from "@/lib/v3/catalog";
import {
  completeness,
  createDraft,
  primarySlots,
  slotCategory,
  slotLabel,
  type BuildDocumentV3,
  type ImageBuildContext,
  type SlotId,
  type VisualPriority,
} from "@/lib/v3/build-document";
import {
  chooseCandidate,
  emptyCandidateReview,
  equallyLikelyCandidates,
  matchVisualCandidates,
  type AppearanceCandidate,
  type CandidateReview,
} from "@/lib/v3/candidate-matcher";
import { appearanceSummary, photoAppearance } from "@/lib/v3/photo-appearance";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import type { ImageAnalysisResult, VisualObservation } from "@/lib/v3/image-contract";
import type { Part } from "@/types/parts";

export type ImageReviews = Partial<Record<VisibleCatalogCategory, CandidateReview>>;

const visualCategories = new Set(["case", "gpu", "cooler", "fan", "motherboard"]);

function priorityFromObservation(item: VisualObservation): VisualPriority | null {
  if (!item.visibleInImage || item.origin === "unknown") return null;
  const attribute = item.attribute.toLowerCase();
  let category: VisualPriority["category"] | null = null;
  if (item.category === "lighting" || /light|rgb/.test(attribute)) category = "lighting";
  else if (item.category === "fan" && /layout|count|position/.test(attribute))
    category = "fan_layout";
  else if (/vertical|horizontal|orientation|position|placement/.test(attribute))
    category = "component_placement";
  else if (item.category === "case" && /shape|silhouette|style|panel/.test(attribute))
    category = "case_style";
  else if (item.category === "theme" || /color|colour|material/.test(attribute))
    category = "colorway";
  if (!category) return null;
  return {
    id: item.id,
    category,
    value: item.value,
    observationId: item.id,
    sourceCategory: item.category,
    locked: item.origin === "observed" && item.confidenceBand !== "low",
  };
}

export function visualPrioritiesFromAnalysis(analysis: ImageAnalysisResult): VisualPriority[] {
  return analysis.observations.flatMap((item) => {
    const priority = priorityFromObservation(item);
    return priority ? [priority] : [];
  });
}

export interface ImageBuildProposal {
  analysisId: string;
  baseDraft: { id: string; revision: number } | null;
  candidate: BuildDocumentV3;
  selected: Array<{ slot: SlotId; partId: string; name: string }>;
  unresolved: Array<{ slot: SlotId; reason: string }>;
  remaining: SlotId[];
  visualWarnings: string[];
}

export function proposeImageBuild(
  analysis: ImageAnalysisResult,
  reviews: ImageReviews,
  /** Photo drafts have no target budget (null); a number is kept for callers that set one. */
  budget: number | null,
  current: BuildDocumentV3 | null = null,
): ImageBuildProposal {
  if (budget !== null && (!Number.isFinite(budget) || budget < 0))
    throw new Error("Enter a valid budget.");
  const candidateSets = matchVisualCandidates(analysis);
  const selected: ImageBuildProposal["selected"] = [];
  const unresolved: ImageBuildProposal["unresolved"] = [];
  const plannedSelections: ImageBuildContext["plannedSelections"] = {};
  const parts: Part[] = [];
  for (const set of candidateSets) {
    if (!visualCategories.has(set.category)) continue;
    const slot = set.category === "fan" ? null : (set.category as SlotId);
    if (!slot) continue;
    const review = reviews[set.category];
    // Not in the photo: leave the slot open (unselected), not "needs review", unless the user wrote a note.
    if (set.status === "not_in_photo" && review?.status !== "manual") continue;
    const picked =
      review?.status === "chosen"
        ? set.candidates.find((item) => item.partId === review.chosenPartId)
        : undefined;
    if (review?.status === "chosen" && !picked)
      throw new Error("A reviewed candidate is no longer available. Review it again.");
    if (picked) {
      const found = catalogPartById(picked.partId);
      const part = found?.category === slotCategory[slot] ? found : undefined;
      if (!part)
        throw new Error("A reviewed candidate is missing from the catalog. Review it again.");
      parts.push(part);
      selected.push({ slot, partId: part.id, name: part.displayName });
      plannedSelections[slot] = {
        partId: part.id,
        origin: "image_review",
        observationIds: [...picked.matchedObservationIds],
      };
      continue;
    }
    const reason =
      review?.status === "manual"
        ? `Manual model note: ${review.manualText ?? "Unknown"}`
        : review?.excludedPartIds.length
          ? "Catalog options excluded; identity remains unknown"
          : "Visible in reference; exact identity unresolved";
    unresolved.push({ slot, reason });
  }
  const unresolvedMap = Object.fromEntries(unresolved.map(({ slot, reason }) => [slot, reason]));
  const context: ImageBuildContext = {
    referenceImageId: analysis.imageId,
    analysisId: analysis.analysisId,
    imageStored: false,
    observations: analysis.observations,
    reviews: structuredClone(reviews),
    visualPriorities: visualPrioritiesFromAnalysis(analysis),
    plannedSelections,
  };
  const candidate = createDraft("image", {
    name: "Reference photo build",
    budget,
    parts,
    unresolved: unresolvedMap,
    imageContext: context,
  });
  const visualWarnings = selected.flatMap(({ slot, partId }) => {
    const part = parts.find((item) => item.id === partId)!;
    return context.visualPriorities.flatMap((priority) => {
      if (!priority.locked || priority.sourceCategory !== slot) return [];
      const catalogValue =
        priority.category === "case_style"
          ? String(part.specs.style ?? "")
          : priority.category === "colorway"
            ? String(part.color ?? part.specs.color ?? "")
            : "";
      if (!catalogValue || catalogValue.toLowerCase().includes(priority.value.toLowerCase()))
        return [];
      return [
        `${slotLabel[slot]}: selected catalog ${priority.category.replaceAll("_", " ")} (${catalogValue}) differs from the observed ${priority.value}. Review this visual lock in Studio.`,
      ];
    });
  });
  return {
    analysisId: analysis.analysisId,
    baseDraft: current ? { id: current.build.id, revision: current.revision } : null,
    candidate,
    selected,
    unresolved,
    remaining: primarySlots.filter(
      (slot) =>
        !selected.some((item) => item.slot === slot) &&
        !unresolved.some((item) => item.slot === slot),
    ),
    visualWarnings,
  };
}

export function confirmImageBuild(
  proposal: ImageBuildProposal,
  current: BuildDocumentV3 | null,
): BuildDocumentV3 {
  const expected = proposal.baseDraft;
  if (
    (expected === null) !== (current === null) ||
    (expected &&
      current &&
      (expected.id !== current.build.id || expected.revision !== current.revision))
  ) {
    throw new Error("The active Build changed after this preview. Review the image draft again.");
  }
  if (proposal.candidate.imageContext?.analysisId !== proposal.analysisId)
    throw new Error("The image analysis does not match this preview.");
  return proposal.candidate;
}

export function imageBuildPreviewText(proposal: ImageBuildProposal): string[] {
  return [
    ...proposal.selected.map((item) => `${slotLabel[item.slot]}: ${item.name} (planned selection)`),
    ...proposal.unresolved.map((item) => `${slotLabel[item.slot]}: ${item.reason}`),
    ...proposal.remaining.map((slot) => `${slotLabel[slot]}: not selected`),
  ];
}

const reviewLabels: Record<VisibleCatalogCategory, string> = {
  case: "Case",
  gpu: "GPU",
  cooler: "Cooler",
  fan: "Fans",
  motherboard: "Motherboard",
};

/** "Weak visual match · appearance only" and the like, shared by review cards and change lists. */
export function candidateMatchLabel(candidate: AppearanceCandidate): string {
  const band = candidate.visualMatchBand;
  return `${band[0].toUpperCase()}${band.slice(1)} visual match · ${
    candidate.identityEvidence === "visible_marking" ? "visible marking" : "appearance only"
  }`;
}

export interface SuggestedChange {
  category: VisibleCatalogCategory;
  label: string;
  /** Catalog part the category would use, or null when it stays as the photo shows it. */
  partName: string | null;
  match: string | null;
  price: string;
  appearance: string;
  /** Names of the top candidates the photo cannot tell apart; the user picks one. */
  equallyLikely: string[];
  /**
   * Where the row comes from: the user's "Use this", the top match filled in, a tie left open,
   * "keep unknown", a manual note, or no catalog match. "declined" is a filled-in top match the
   * user unticked in the change list: shown, but its slot stays unconfirmed.
   */
  decision: "yours" | "suggested" | "declined" | "tie" | "kept" | "note" | "none";
}

export interface SuggestedParts {
  reviews: ImageReviews;
  proposal: ImageBuildProposal;
  changes: SuggestedChange[];
  total: { known: number; unknown: number };
  compatibility: string;
}

/**
 * "Build it in 3D": the user's own decisions, with the top-ranked candidate filled in for every
 * category they left open (skipping ones they excluded), as a full preview. Nothing changes until
 * the proposal is confirmed. A tie, "keep unknown" or a manual note is never filled in, and a
 * category in `declined` (a filled-in row the user unticked) stays unconfirmed.
 */
export function suggestParts(
  analysis: ImageAnalysisResult,
  current: ImageReviews,
  budget: number | null,
  draft: BuildDocumentV3 | null = null,
  declined: readonly VisibleCatalogCategory[] = [],
): SuggestedParts {
  const reviews: ImageReviews = { ...current };
  const picks: Partial<Record<VisibleCatalogCategory, AppearanceCandidate>> = {};
  const ties: Partial<Record<VisibleCatalogCategory, AppearanceCandidate[]>> = {};
  const decisions: Partial<Record<VisibleCatalogCategory, SuggestedChange["decision"]>> = {};
  const declinedTop: Partial<Record<VisibleCatalogCategory, AppearanceCandidate>> = {};
  for (const set of matchVisualCandidates(analysis)) {
    const review = current[set.category] ?? emptyCandidateReview();
    if (review.status === "manual" || review.kept) {
      decisions[set.category] = review.status === "manual" ? "note" : "kept";
      continue;
    }
    const yours =
      review.status === "chosen"
        ? set.candidates.find((candidate) => candidate.partId === review.chosenPartId)
        : undefined;
    if (yours) {
      picks[set.category] = yours;
      decisions[set.category] = "yours";
      continue;
    }
    const top = set.candidates.find(
      (candidate) => !review.excludedPartIds.includes(candidate.partId),
    );
    if (!top) continue;
    const tied = equallyLikelyCandidates(set, review);
    if (tied.length) {
      ties[set.category] = tied;
      decisions[set.category] = "tie";
      continue;
    }
    if (declined.includes(set.category)) {
      declinedTop[set.category] = top;
      decisions[set.category] = "declined";
      continue;
    }
    reviews[set.category] = chooseCandidate(set, review, top.partId);
    picks[set.category] = top;
    decisions[set.category] = "suggested";
  }
  const proposal = proposeImageBuild(analysis, reviews, budget, draft);
  const observations = analysis.observations.filter(
    (item) => item.visibleInImage && item.origin !== "unknown",
  );
  const looks = photoAppearance(proposal.candidate);
  const changes: SuggestedChange[] = [];
  for (const set of matchVisualCandidates(analysis)) {
    const label = reviewLabels[set.category];
    const pick = picks[set.category];
    if (set.status === "not_in_photo") continue;
    if (!pick) {
      const look = set.category === "fan" ? undefined : looks[set.category as SlotId];
      const skipped = declinedTop[set.category];
      if (skipped) {
        changes.push({
          category: set.category,
          label,
          decision: "declined",
          partName: skipped.displayName,
          match: candidateMatchLabel(skipped),
          price: "Not counted",
          appearance: look
            ? `Not filled in; stays unconfirmed, drawn from the photo (${appearanceSummary(look)})`
            : "Not filled in; stays unconfirmed",
          equallyLikely: [],
        });
        continue;
      }
      const tied = ties[set.category] ?? [];
      const decision = decisions[set.category] ?? "none";
      const reason = {
        tie: "Choose one in the review",
        kept: "Kept unknown",
        note: `Your note: ${current[set.category]?.manualText ?? ""}`,
        none: "No catalog match",
      }[decision as "tie" | "kept" | "note" | "none"];
      const until = tied.length ? " until then" : "";
      changes.push({
        category: set.category,
        label,
        decision,
        partName: null,
        match: tied.length ? `${tied.length} options equally likely` : null,
        price: "Not counted",
        appearance: look
          ? `${reason}; drawn from the photo${until} (${appearanceSummary(look)})`
          : set.category === "fan"
            ? `${reason}; a style note only, not a Build slot`
            : `${reason}; stays unresolved`,
        equallyLikely: tied.map((candidate) => candidate.displayName),
      });
      continue;
    }
    const part = catalogPartById(pick.partId);
    const observed = observations
      .filter((item) => item.category === set.category && /colou?r/.test(item.attribute))
      .map((item) => item.value.toLowerCase());
    const partColor = (part?.color ?? (part?.specs.color as string | undefined) ?? "").trim();
    const appearance =
      set.category === "fan"
        ? `Style note only; fans are not a Build slot and add nothing to the total`
        : !partColor
          ? "Catalog colour unknown"
          : !observed.length
            ? `${partColor} (the photo shows no colour for this part)`
            : observed.some((value) => value.includes(partColor.toLowerCase()))
              ? `${partColor}, matches the photo`
              : `${partColor}; the photo shows ${observed[0]}`;
    changes.push({
      category: set.category,
      label,
      decision: decisions[set.category] ?? "suggested",
      partName: pick.displayName,
      match: candidateMatchLabel(pick),
      equallyLikely: [],
      price:
        set.category === "fan" || !part
          ? "Not counted"
          : priceUnknown(part)
            ? "Price unknown"
            : `$${part.price.toLocaleString()}`,
      appearance,
    });
  }
  const status = completeness(proposal.candidate);
  const findings = proposal.candidate.build.compatibilityWarnings.length;
  return {
    reviews,
    proposal,
    changes,
    total: priceCoverage(proposal.candidate.build.parts),
    compatibility: status.complete
      ? `${proposal.candidate.build.compatibilityStatus} · ${findings} rule finding${findings === 1 ? "" : "s"}`
      : `Incomplete · ${status.selected} of 8 slots selected · ${findings} rule finding${findings === 1 ? "" : "s"} so far`,
  };
}
