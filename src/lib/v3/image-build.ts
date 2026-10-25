import { seedParts } from "@/data/seedParts";
import {
  createDraft,
  primarySlots,
  slotCategory,
  slotLabel,
  type BuildDocumentV3,
  type ImageBuildContext,
  type SlotId,
  type VisualPriority,
} from "@/lib/v3/build-document";
import { matchVisualCandidates, type CandidateReview } from "@/lib/v3/candidate-matcher";
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
  budget: number,
  current: BuildDocumentV3 | null = null,
): ImageBuildProposal {
  if (!Number.isFinite(budget) || budget < 0) throw new Error("Enter a valid budget.");
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
    const picked =
      review?.status === "chosen"
        ? set.candidates.find((item) => item.partId === review.chosenPartId)
        : undefined;
    if (review?.status === "chosen" && !picked)
      throw new Error("A reviewed candidate is no longer available. Review it again.");
    if (picked) {
      const part = seedParts.find(
        (item) => item.id === picked.partId && item.category === slotCategory[slot],
      );
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
