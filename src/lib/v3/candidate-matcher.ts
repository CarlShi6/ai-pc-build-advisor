import {
  appearanceProfiles,
  visibleCatalogCategories,
  type AppearanceProfile,
  type VisibleCatalogCategory,
} from "@/lib/v3/appearance-catalog";
import type { ImageAnalysisResult, VisualObservation } from "@/lib/v3/image-contract";

export interface AppearanceCandidate {
  partId: string;
  displayName: string;
  category: VisibleCatalogCategory;
  rank: number;
  visualMatchBand: "strong" | "possible" | "weak";
  identityEvidence: "visible_marking" | "appearance_only";
  matchedObservationIds: string[];
  matchedSignals: string[];
  observationEvidence: string[];
  missingEvidence: string[];
  catalogSpecFields: number;
  compatibilityStatus: "not_checked";
  catalogSourceId: string;
  /** Manufacturer page and verification date for hand-curated entries; null for seed parts. */
  catalogSourceUrl: string | null;
  catalogVerifiedAt: string | null;
}

export interface CandidateSet {
  category: VisibleCatalogCategory;
  status: "candidates" | "unresolved" | "no_catalog_coverage";
  observationIds: string[];
  candidates: AppearanceCandidate[];
  explanation: string;
}

const stopwords = new Set([
  "the",
  "and",
  "pc",
  "gpu",
  "case",
  "geforce",
  "radeon",
  "rtx",
  "rx",
  "edition",
  "black",
  "white",
  "series",
  "visible",
]);

function tokens(value: string) {
  return (
    value
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => !stopwords.has(token)) ?? []
  );
}

function signalMatch(value: string, catalogValue: string | null) {
  if (!catalogValue) return false;
  const observed = tokens(value);
  const catalog = new Set(tokens(catalogValue));
  return observed.length > 0 && observed.some((token) => catalog.has(token));
}

function colorWords(value: string): string[] {
  return (
    value
      .toLowerCase()
      .match(/\b(black|white|silver|gray|grey|red|blue|green|pink|wood|walnut)\b/g) ?? []
  );
}

/** A photo can show that a fan is lit, not which lighting standard (RGB vs ARGB) it uses. */
function describesLighting(value: string) {
  return (
    /\b(a-?rgb|rgb|led|leds|lit|illuminated|glowing|lighting)\b/i.test(value) &&
    !/\b(no|unlit|none|without|off)\b/i.test(value)
  );
}

function scoreProfile(profile: AppearanceProfile, observations: VisualObservation[]) {
  const matchedObservationIds: string[] = [];
  const matchedSignals: string[] = [];
  const observationEvidence: string[] = [];
  let marking = false;
  let score = 0;
  for (const item of observations) {
    if (!item.visibleInImage || item.origin === "unknown") continue;
    const attribute = item.attribute.toLowerCase();
    const weight = item.origin === "observed" ? 2 : 1;
    const isColor = /color|colour/.test(attribute);
    if (isColor && profile.color && colorWords(item.value).length) {
      const expected = colorWords(profile.color);
      if (expected.length && !colorWords(item.value).some((color) => expected.includes(color))) {
        if (item.origin === "observed" && item.confidenceBand !== "low") return null;
        continue;
      }
      if (expected.length) {
        score += weight;
        matchedObservationIds.push(item.id);
        matchedSignals.push(`Color: ${item.value}`);
        observationEvidence.push(item.evidence);
      }
    } else if (
      /shape|silhouette|style|panel|layout/.test(attribute) &&
      signalMatch(item.value, profile.style)
    ) {
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(`Catalog style: ${profile.style}`);
      observationEvidence.push(item.evidence);
    } else if (
      /cooler.type|cooling.type|radiator|aio|air.cooler/.test(attribute) &&
      signalMatch(item.value, profile.coolerType)
    ) {
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(`Cooler type: ${profile.coolerType}`);
      observationEvidence.push(item.evidence);
    } else if (
      /lighting|led|rgb|glow/.test(attribute) &&
      profile.lighting &&
      describesLighting(item.value)
    ) {
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(`Lighting: ${item.value} (catalog: ${profile.lighting})`);
      observationEvidence.push(item.evidence);
    } else if (
      /brand|logo|model|marking|visible.text|label/.test(attribute) &&
      item.origin === "observed" &&
      signalMatch(item.value, profile.identityText)
    ) {
      score += 3;
      marking = true;
      matchedObservationIds.push(item.id);
      matchedSignals.push(`Visible marking: ${item.value}`);
      observationEvidence.push(item.evidence);
    }
  }
  if (!score) return null;
  return { score, marking, matchedObservationIds, matchedSignals, observationEvidence };
}

export function matchVisualCandidates(analysis: ImageAnalysisResult): CandidateSet[] {
  return visibleCatalogCategories
    .filter((category) => analysis.observations.some((item) => item.category === category))
    .map((category) => {
      const observations = analysis.observations.filter((item) => item.category === category);
      const profiles = appearanceProfiles.filter((profile) => profile.category === category);
      if (!profiles.length)
        return {
          category,
          status: "no_catalog_coverage" as const,
          observationIds: observations.map((item) => item.id),
          candidates: [],
          explanation: "The current local catalog has no parts in this visible category.",
        };
      const candidates = profiles
        .map((profile) => ({ profile, evidence: scoreProfile(profile, observations) }))
        .filter(
          (
            item,
          ): item is {
            profile: AppearanceProfile;
            evidence: NonNullable<ReturnType<typeof scoreProfile>>;
          } => !!item.evidence,
        )
        .sort(
          (a, b) =>
            b.evidence.score - a.evidence.score ||
            a.profile.displayName.localeCompare(b.profile.displayName),
        )
        .slice(0, 5)
        .map(
          ({ profile, evidence }, index): AppearanceCandidate => ({
            partId: profile.id,
            displayName: profile.displayName,
            category,
            rank: index + 1,
            visualMatchBand:
              evidence.marking && evidence.matchedObservationIds.length > 1
                ? "strong"
                : evidence.score >= 3
                  ? "possible"
                  : "weak",
            identityEvidence: evidence.marking ? "visible_marking" : "appearance_only",
            matchedObservationIds: evidence.matchedObservationIds,
            matchedSignals: evidence.matchedSignals,
            observationEvidence: evidence.observationEvidence,
            missingEvidence: ["Photo similarity does not verify exact SKU or dimensions."],
            catalogSpecFields: profile.specFieldCount,
            compatibilityStatus: "not_checked",
            catalogSourceId: profile.catalogSourceId,
            catalogSourceUrl: profile.sourceUrl,
            catalogVerifiedAt: profile.verifiedAt,
          }),
        );
      return {
        category,
        status: candidates.length ? ("candidates" as const) : ("unresolved" as const),
        observationIds: observations.map((item) => item.id),
        candidates,
        explanation: !candidates.length
          ? "The visible details do not support a match in the current local catalog."
          : category === "fan"
            ? "Fans are ranked by visible color and lighting only; a photo cannot tell these models apart. Fans are not one of the eight Build slots, so a chosen fan stays a style note and adds nothing to the Build total."
            : "Catalog alternatives are ranked by stated visual evidence, not verified identity or purchase value.",
      };
    });
}

export interface CandidateReview {
  status: "chosen" | "unknown" | "manual";
  chosenPartId?: string;
  chosenEvidence?: { observationIds: string[]; photoEvidence: string[]; catalogSourceId: string };
  excludedPartIds: string[];
  manualText?: string;
}

export function chooseCandidate(
  set: CandidateSet,
  review: CandidateReview,
  partId: string,
): CandidateReview {
  const candidate = set.candidates.find((item) => item.partId === partId);
  if (!candidate || review.excludedPartIds.includes(partId))
    throw new Error("The candidate is unavailable for this category.");
  return {
    ...review,
    status: "chosen",
    chosenPartId: partId,
    chosenEvidence: {
      observationIds: [...candidate.matchedObservationIds],
      photoEvidence: [...candidate.observationEvidence],
      catalogSourceId: candidate.catalogSourceId,
    },
    manualText: undefined,
  };
}

export function excludeCandidate(review: CandidateReview, partId: string): CandidateReview {
  return {
    ...review,
    status: review.chosenPartId === partId ? "unknown" : review.status,
    chosenPartId: review.chosenPartId === partId ? undefined : review.chosenPartId,
    chosenEvidence: review.chosenPartId === partId ? undefined : review.chosenEvidence,
    excludedPartIds: [...new Set([...review.excludedPartIds, partId])],
  };
}

export function keepCandidateUnknown(review: CandidateReview): CandidateReview {
  return {
    ...review,
    status: "unknown",
    chosenPartId: undefined,
    chosenEvidence: undefined,
    manualText: undefined,
  };
}

export function noteManualModel(review: CandidateReview, text: string): CandidateReview {
  const manualText = text.trim().slice(0, 180);
  if (!manualText) throw new Error("Enter a model note first.");
  return {
    ...review,
    status: "manual",
    chosenPartId: undefined,
    chosenEvidence: undefined,
    manualText,
  };
}

export function emptyCandidateReview(): CandidateReview {
  return { status: "unknown", excludedPartIds: [] };
}
