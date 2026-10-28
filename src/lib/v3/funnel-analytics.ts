import { trackAnalyticsEvent, type AnalyticsProperties } from "@/lib/analytics";
import { completeness, type BuildDocumentV3, type SlotId } from "@/lib/v3/build-document";
import type { CandidateReview } from "@/lib/v3/candidate-matcher";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import { matchGaps } from "@/lib/v3/slot-identity";

/**
 * v3 funnel (PRD §19.1): image submitted → analysis completed → candidate reviewed → draft
 * created → saved/exported → shopping intent (only on an actual link click).
 *
 * Events carry only counts, categories and enums. Never image bytes, file names, observation
 * text, pasted lists, descriptions or manual notes. The per-tab `session_id` that
 * `trackAnalyticsEvent` adds ties the steps of one funnel together.
 */

export type ImageRun = { fixture: boolean };
export type ReportFormat = "markdown_copy" | "markdown_file" | "json_file";

/** Occupancy counts for a draft. Unknown slots are reported as unresolved, never as passed. */
export function draftProperties(document: BuildDocumentV3): AnalyticsProperties {
  const status = completeness(document);
  return {
    source: document.source,
    selected_count: status.selected,
    unresolved_count: status.unresolved,
    empty_count: status.missing,
    complete: status.complete,
  };
}

export function analysisProperties(result: ImageAnalysisResult): AnalyticsProperties {
  return {
    fixture: result.provider === "fixture",
    quality: result.quality,
    observation_count: result.observations.length,
    observed_count: result.observations.filter((item) => item.origin === "observed").length,
    // Category enums only: which parts the photo was read as showing, and which as clearly not
    // installed. An empty Build slot after review traces back to one of these two lists.
    visible_categories: [
      ...new Set(
        result.observations.filter((item) => item.visibleInImage).map((item) => item.category),
      ),
    ]
      .sort()
      .join(","),
    absent_parts: [...(result.absentParts ?? [])].sort().join(","),
  };
}

/**
 * Why each visible category has no leading catalog match when a photo draft is confirmed, as
 * category → reason code (never observation text). These records pick the catalog's next parts.
 */
export function matchGapProperties(
  analysis: ImageAnalysisResult,
  reviews: Partial<Record<VisibleCatalogCategory, CandidateReview>>,
): AnalyticsProperties {
  const gaps = matchGaps(analysis, reviews);
  return {
    fixture: analysis.provider === "fixture",
    gap_count: Object.keys(gaps).length,
    ...Object.fromEntries(Object.entries(gaps).map(([category, gap]) => [`gap_${category}`, gap])),
  };
}

export function reviewProperties(
  category: VisibleCatalogCategory,
  review: CandidateReview,
): AnalyticsProperties {
  return {
    category,
    review_status: review.status,
    excluded_count: review.excludedPartIds.length,
  };
}

export const funnel = {
  imageSubmitted: (run: ImageRun) => trackAnalyticsEvent("v3_image_submitted", run),
  imageAnalysisCompleted: (result: ImageAnalysisResult) =>
    trackAnalyticsEvent("v3_image_analysis_completed", analysisProperties(result)),
  imageAnalysisFailed: (run: ImageRun, errorCode: string) =>
    trackAnalyticsEvent("v3_image_analysis_failed", {
      ...run,
      error_code: errorCode.slice(0, 40),
    }),
  candidateReviewed: (category: VisibleCatalogCategory, review: CandidateReview) =>
    trackAnalyticsEvent("v3_candidate_reviewed", reviewProperties(category, review)),
  matchGaps: (
    analysis: ImageAnalysisResult,
    reviews: Partial<Record<VisibleCatalogCategory, CandidateReview>>,
  ) => trackAnalyticsEvent("v3_image_match_gaps", matchGapProperties(analysis, reviews)),
  draftCreated: (document: BuildDocumentV3) =>
    trackAnalyticsEvent("v3_draft_created", draftProperties(document)),
  buildSaved: (document: BuildDocumentV3, firstSave: boolean) =>
    trackAnalyticsEvent("v3_build_saved", { ...draftProperties(document), first_save: firstSave }),
  buildSaveConflict: (document: BuildDocumentV3) =>
    trackAnalyticsEvent("v3_build_save_conflict", { source: document.source }),
  reportExported: (document: BuildDocumentV3, format: ReportFormat) =>
    trackAnalyticsEvent("v3_report_exported", { ...draftProperties(document), format }),
  shoppingLinkOpened: (document: BuildDocumentV3, slot: SlotId, linkKind: "official" | "search") =>
    trackAnalyticsEvent("v3_shopping_link_opened", {
      source: document.source,
      slot,
      link_kind: linkKind,
    }),
};
