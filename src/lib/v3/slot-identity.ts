import {
  catalogForSlot,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { visibleCatalogCategories, type VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import {
  equallyLikelyCandidates,
  emptyCandidateReview,
  matchVisualCandidates,
  seenInLook,
  type AppearanceCandidate,
  type CandidateReview,
} from "@/lib/v3/candidate-matcher";
import type { ImageAnalysisResult, VisualObservation } from "@/lib/v3/image-contract";
import type { Part } from "@/types/parts";

/**
 * Stage 1: an unconfirmed photo slot in the Studio shows what the photo says about it, the
 * catalog parts that look most alike (never "this part"), a search by name and a way to keep it
 * unknown. The review's decisions (chosen, excluded, kept unknown) carry over.
 */
export const SIMILAR_LOOK_LABEL = "Similar look, not this exact part";
export const KEEP_UNKNOWN_NOTE = "Not in catalog · kept unknown";

/**
 * Why a visible category has no leading catalog match, as a code (never observation text):
 * - `not_seen`: the photo shows nothing of it;
 * - `judged_absent`: the analysis says it is clearly not installed;
 * - `no_catalog_category`: the catalog has no parts of this category;
 * - `no_close_match`: catalog parts exist but none matches what the photo shows (for example, no
 *   white motherboard in the catalog);
 * - `all_excluded`: the user excluded every candidate;
 * - `tied`: two or more candidates fit equally well, so the photo cannot tell them apart.
 */
export type MatchGap =
  | "not_seen"
  | "judged_absent"
  | "no_catalog_category"
  | "no_close_match"
  | "all_excluded"
  | "tied";

type AnalysisLike = Pick<ImageAnalysisResult, "observations"> &
  Partial<Pick<ImageAnalysisResult, "absentParts" | "appearance">>;

function candidateSet(analysis: AnalysisLike, category: VisibleCatalogCategory) {
  return matchVisualCandidates({ absentParts: [], ...analysis } as ImageAnalysisResult).find(
    (set) => set.category === category,
  );
}

/** The reason a category has no leading match, or null when one candidate leads. */
export function matchGap(
  analysis: AnalysisLike,
  category: VisibleCatalogCategory,
  review: CandidateReview = emptyCandidateReview(),
): MatchGap | null {
  if (analysis.absentParts?.includes(category as never)) return "judged_absent";
  // Seen as an observation or in the appearance parameters (memory only ever in the latter).
  const visible =
    seenInLook(analysis, category) ||
    analysis.observations.some(
      (item) => item.category === category && item.visibleInImage && item.origin !== "unknown",
    );
  if (!visible) return "not_seen";
  const set = candidateSet(analysis, category);
  if (!set || set.status === "no_catalog_coverage") return "no_catalog_category";
  if (!set.candidates.length) return "no_close_match";
  if (set.candidates.every((item) => review.excludedPartIds.includes(item.partId)))
    return "all_excluded";
  if (equallyLikelyCandidates(set, review).length) return "tied";
  return null;
}

/** Every visible-catalog category's gap, for the analytics record that guides catalog growth. */
export function matchGaps(
  analysis: AnalysisLike,
  reviews: Partial<Record<VisibleCatalogCategory, CandidateReview>> = {},
): Partial<Record<VisibleCatalogCategory, MatchGap>> {
  return Object.fromEntries(
    visibleCatalogCategories.flatMap((category) => {
      const gap = matchGap(analysis, category, reviews[category]);
      return gap ? [[category, gap]] : [];
    }),
  );
}

/** "Photo: white · 3 fans · RGB lighting", from the slot's own visible observations. */
export function photoEvidenceLine(observations: VisualObservation[], category: string) {
  const values = observations
    .filter(
      (item) =>
        item.category === category &&
        item.visibleInImage &&
        item.origin !== "unknown" &&
        !/^(none|unreadable|unknown)\b/i.test(item.value.trim()),
    )
    .map((item) => item.value.trim().slice(0, 40));
  return values.length ? `Photo: ${[...new Set(values)].slice(0, 4).join(" · ")}` : null;
}

export interface SlotIdentityHelp {
  category: VisibleCatalogCategory;
  evidence: string | null;
  /** Closest-looking catalog parts, the review's choice first; excluded ones are left out. */
  candidates: Array<AppearanceCandidate & { reviewChoice: boolean }>;
  excludedCount: number;
  kept: boolean;
  gap: MatchGap | null;
}

const isVisibleCategory = (slot: SlotId): slot is SlotId & VisibleCatalogCategory =>
  (visibleCatalogCategories as readonly string[]).includes(slot);

/** Help for an unconfirmed slot the photo shows; null for other slots. */
export function slotIdentityHelp(document: BuildDocumentV3, slot: SlotId): SlotIdentityHelp | null {
  const context = document.imageContext;
  if (!context || !isVisibleCategory(slot) || slotOccupancy(document, slot) !== "unresolved")
    return null;
  const review = context.reviews[slot] ?? emptyCandidateReview();
  const analysis = { observations: context.observations };
  const set = candidateSet(analysis, slot);
  const open = (set?.candidates ?? []).filter(
    (item) => !review.excludedPartIds.includes(item.partId),
  );
  const chosen = review.status === "chosen" ? review.chosenPartId : undefined;
  const candidates = [
    ...open.filter((item) => item.partId === chosen),
    ...open.filter((item) => item.partId !== chosen),
  ].map((item) => ({ ...item, reviewChoice: item.partId === chosen }));
  return {
    category: slot,
    evidence: photoEvidenceLine(context.observations, slot),
    candidates,
    excludedCount: review.excludedPartIds.length,
    kept: !!review.kept || document.unresolved[slot] === KEEP_UNKNOWN_NOTE,
    gap: matchGap(analysis, slot, review),
  };
}

/** Catalog parts for a slot whose name, brand or model contains every word of `query`. */
export function searchCatalog(slot: SlotId, query: string, limit = 8): Part[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return catalogForSlot(slot)
    .filter((part) => {
      const text = `${part.displayName} ${part.brand} ${part.model}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, limit);
}

/** "Not in catalog · keep unknown": the slot stays unresolved, noted, and the review agrees. */
export function keepSlotUnknown(document: BuildDocumentV3, slot: SlotId): BuildDocumentV3 {
  if (slotOccupancy(document, slot) !== "unresolved")
    throw new Error("Only an unconfirmed slot can be kept unknown.");
  const context = document.imageContext;
  return {
    ...document,
    revision: document.revision + 1,
    unresolved: { ...document.unresolved, [slot]: KEEP_UNKNOWN_NOTE },
    imageContext:
      context && isVisibleCategory(slot)
        ? {
            ...context,
            reviews: {
              ...context.reviews,
              [slot]: { ...(context.reviews[slot] ?? emptyCandidateReview()), kept: true },
            },
          }
        : context,
  };
}
