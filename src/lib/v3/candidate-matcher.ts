import {
  appearanceProfiles,
  visibleCatalogCategories,
  type AppearanceProfile,
  type VisibleCatalogCategory,
} from "@/lib/v3/appearance-catalog";
import type { AppearanceParams, ParamColor } from "@/lib/v3/appearance-params";
import type { ImageAnalysisResult, VisualObservation } from "@/lib/v3/image-contract";

export interface AppearanceCandidate {
  partId: string;
  displayName: string;
  category: VisibleCatalogCategory;
  rank: number;
  /** Summed observation weight behind the rank; equal scores mean the photo cannot tell them apart. */
  evidenceScore: number;
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
  status: "candidates" | "unresolved" | "no_catalog_coverage" | "not_in_photo";
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

/** Front-panel material named in an observation; "solid" and other words are not compared. */
function frontMaterial(value: string): "glass" | "mesh" | "perforated" | null {
  const text = value.toLowerCase();
  if (/\bglass\b/.test(text)) return "glass";
  if (/\bperforat/.test(text)) return "perforated";
  if (/\bmesh\b/.test(text)) return "mesh";
  return null;
}

/** GPU length band as the photo reads it: short is about two fan widths or less, long about three. */
function lengthBand(mm: number): AppearanceParams["gpu"]["length"] {
  return mm <= 240 ? "short" : mm < 300 ? "medium" : "long";
}

/**
 * The photo's appearance parameters against a profile's recorded look, by the observations'
 * rule: a known value the manufacturer data contradicts rules the part out, a match counts 1, and
 * unknown on either side counts neither way. `scored` holds the kinds of fact the observations
 * already counted, so the same fact is never counted twice.
 */
function scoreLook(profile: AppearanceProfile, look: AppearanceParams, scored: Set<string>) {
  const signals: string[] = [];
  let ruledOut = false;
  const add = (kind: string, signal: string) => {
    if (scored.has(kind)) return;
    scored.add(kind);
    signals.push(signal);
  };
  const page = profile.appearanceVerifiedAt
    ? `manufacturer page, verified ${profile.appearanceVerifiedAt}`
    : "manufacturer page";
  const color = (value: ParamColor) => {
    const expected = profile.color ? colorWords(profile.color) : [];
    if (value === "unknown" || !expected.length) return;
    if (!colorWords(value).some((item) => expected.includes(item))) ruledOut = true;
    else add("color", `Color: ${value} (photo look)`);
  };
  const mesh = profile.frontPanel === "mesh" || profile.frontPanel === "perforated";
  switch (profile.category) {
    case "case": {
      color(look.case.color);
      if (look.case.type === "dual-chamber") {
        if (mesh) ruledOut = true;
        else if (profile.caseLayout === "dual-chamber")
          add("layout", `Layout: dual-chamber (photo look; ${page})`);
      } else if (look.case.type === "mesh-front-mid-tower") {
        if (profile.frontPanel === "glass" || profile.caseLayout === "dual-chamber")
          ruledOut = true;
        else if (mesh) add("front", `Front panel: ${profile.frontPanel} (photo look; ${page})`);
      }
      if (look.case.glass === "front" || look.case.glass === "both") {
        if (mesh) ruledOut = true;
        else if (profile.frontPanel === "glass")
          add("front", `Front panel: glass (photo look; ${page})`);
      } else if (look.case.glass === "none" && profile.frontPanel === "glass") ruledOut = true;
      break;
    }
    case "gpu": {
      color(look.gpu.color);
      if (look.gpu.length !== "unknown" && profile.gpuLengthMm !== null) {
        const band = lengthBand(profile.gpuLengthMm);
        if (band === look.gpu.length)
          add("length", `Length: ${band} (photo look; ${page}: ${profile.gpuLengthMm} mm)`);
        else if (band !== "medium" && look.gpu.length !== "medium") ruledOut = true;
      }
      if (look.gpu.fanCount !== "unknown" && profile.gpuFanCount !== null) {
        if (Number(look.gpu.fanCount) !== profile.gpuFanCount) ruledOut = true;
        else add("fanCount", `Fans: ${profile.gpuFanCount} (photo look; ${page})`);
      }
      break;
    }
    case "cooler": {
      color(look.cooler.color);
      const air = profile.coolerType === "air";
      const aio = profile.coolerType === "aio";
      if (look.cooler.type !== "unknown" && (air || aio)) {
        if ((look.cooler.type === "aio") !== aio) ruledOut = true;
        else add("coolerType", `Cooler type: ${profile.coolerType} (photo look)`);
      }
      // A radiator or a pump seen in the photo rules out an air cooler.
      if (look.cooler.radiatorSize !== "unknown") {
        if (air) ruledOut = true;
        else if (profile.radiatorMm !== null) {
          if (Number(look.cooler.radiatorSize) !== profile.radiatorMm) ruledOut = true;
          else add("radiator", `Radiator: ${profile.radiatorMm} mm (photo look; ${page})`);
        }
      }
      if (look.cooler.pumpStyle !== "unknown") {
        if (air) ruledOut = true;
        else if (profile.pumpScreen) {
          if (look.cooler.pumpStyle !== "screen") ruledOut = true;
          else add("pump", `Pump screen (photo look; ${page})`);
        }
      }
      break;
    }
    case "fan": {
      const ring = look.fans.ringColor;
      if (ring !== "unknown" && ring !== "none" && profile.lighting)
        add("lighting", `Lighting: ${ring} rings (photo look; catalog: ${profile.lighting})`);
      break;
    }
    case "motherboard":
      color(look.motherboard.color);
      break;
  }
  return ruledOut ? null : signals;
}

/** True when the appearance parameters show something the matcher compares for this category. */
export function seenInLook(
  analysis: Pick<ImageAnalysisResult, "appearance">,
  category: VisibleCatalogCategory,
): boolean {
  const look = analysis.appearance;
  if (!look) return false;
  switch (category) {
    case "case":
      return [look.case.type, look.case.color, look.case.glass].some((v) => v !== "unknown");
    case "gpu":
      return [look.gpu.fanCount, look.gpu.length, look.gpu.color].some((v) => v !== "unknown");
    case "cooler":
      return [
        look.cooler.type,
        look.cooler.radiatorSize,
        look.cooler.pumpStyle,
        look.cooler.color,
      ].some((v) => v !== "unknown");
    case "fan":
      return (
        (look.fans.ringColor !== "unknown" && look.fans.ringColor !== "none") ||
        [look.fans.front, look.fans.top, look.fans.side, look.fans.bottom, look.fans.rear].some(
          (v) => v !== "unknown" && v !== "0",
        )
      );
    case "motherboard":
      return look.motherboard.color !== "unknown";
    case "memory":
      return !!memoryLook(analysis);
  }
}

function scoreProfile(
  profile: AppearanceProfile,
  observations: VisualObservation[],
  look?: AppearanceParams,
) {
  const matchedObservationIds: string[] = [];
  const matchedSignals: string[] = [];
  const observationEvidence: string[] = [];
  const scored = new Set<string>();
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
        scored.add("color");
        observationEvidence.push(item.evidence);
      }
    } else if (/front/.test(attribute) && frontMaterial(item.value)) {
      // Unknown on the manufacturer page counts neither for nor against the candidate.
      if (!profile.frontPanel) continue;
      if (frontMaterial(item.value) !== profile.frontPanel) {
        if (item.origin === "observed" && item.confidenceBand !== "low") return null;
        continue;
      }
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(
        `Front panel: ${profile.frontPanel} (manufacturer page, verified ${profile.appearanceVerifiedAt})`,
      );
      scored.add("front");
      observationEvidence.push(item.evidence);
    } else if (
      /layout|chamber/.test(attribute) &&
      /dual.?chamber/i.test(item.value) &&
      profile.caseLayout === "dual-chamber"
    ) {
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(
        `Layout: dual-chamber (manufacturer page, verified ${profile.appearanceVerifiedAt})`,
      );
      scored.add("layout");
      observationEvidence.push(item.evidence);
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
      scored.add("coolerType");
      observationEvidence.push(item.evidence);
    } else if (
      /lighting|led|rgb|glow/.test(attribute) &&
      profile.lighting &&
      describesLighting(item.value)
    ) {
      score += weight;
      matchedObservationIds.push(item.id);
      matchedSignals.push(`Lighting: ${item.value} (catalog: ${profile.lighting})`);
      scored.add("lighting");
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
  if (look) {
    const signals = scoreLook(profile, look, scored);
    if (!signals) return null;
    score += signals.length;
    matchedSignals.push(...signals);
  }
  if (!score) return null;
  return { score, marking, matchedObservationIds, matchedSignals, observationEvidence };
}

/**
 * Memory is read only in the appearance parameters (Step A), never as observations: its colour
 * and whether the sticks have a light bar. Null when neither is known.
 */
export function memoryLook(analysis: Pick<ImageAnalysisResult, "appearance">) {
  const memory = analysis.appearance?.memory;
  if (!memory || (memory.color === "unknown" && memory.lightBar === "unknown")) return null;
  return memory;
}

type MemoryLook = NonNullable<ReturnType<typeof memoryLook>>;

/**
 * A memory kit against the photo's memory look: a colour the kit does not come in rules it out;
 * a matching colour and a light bar on an RGB kit count for it. A missing light bar on an RGB kit
 * counts neither way (the read has no confidence to rule a kit out on).
 */
function scoreMemory(profile: AppearanceProfile, memory: MemoryLook) {
  const matchedSignals: string[] = [];
  let score = 0;
  const seen = colorWords(memory.color);
  const expected = profile.color ? colorWords(profile.color) : [];
  if (seen.length && expected.length) {
    if (!seen.some((color) => expected.includes(color))) return null;
    score += 1;
    matchedSignals.push(`Color: ${memory.color} (photo look)`);
  }
  if (memory.lightBar === "yes" && profile.lighting) {
    score += 1;
    matchedSignals.push(`Light bar: yes (catalog: ${profile.lighting})`);
  }
  if (!score) return null;
  return {
    score,
    marking: false,
    matchedObservationIds: [] as string[],
    matchedSignals,
    observationEvidence: [] as string[],
  };
}

const absentLabels: Record<string, string> = {
  gpu: "graphics card",
  cooler: "CPU cooler",
  fan: "fans",
  motherboard: "motherboard",
};

export function matchVisualCandidates(analysis: ImageAnalysisResult): CandidateSet[] {
  // Older saved analyses predate `absentParts`.
  const absent = new Set<string>(analysis.absentParts ?? []);
  const memory = memoryLook(analysis);
  return visibleCatalogCategories
    .filter((category) =>
      category === "memory"
        ? !!memory
        : absent.has(category) ||
          analysis.observations.some((item) => item.category === category) ||
          seenInLook(analysis, category),
    )
    .map((category) => {
      const observations = analysis.observations.filter((item) => item.category === category);
      if (absent.has(category))
        return {
          category,
          status: "not_in_photo" as const,
          observationIds: observations.map((item) => item.id),
          candidates: [],
          explanation:
            `The photo shows no ${absentLabels[category]} installed, so there is nothing to match.` +
            (category === "fan" ? "" : " The Build slot stays open for you to choose."),
        };
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
        .map((profile) => ({
          profile,
          evidence:
            category === "memory" && memory
              ? scoreMemory(profile, memory)
              : scoreProfile(profile, observations, analysis.appearance),
        }))
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
            evidenceScore: evidence.score,
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
          : category === "memory"
            ? "Memory is ranked by the color and light bar read from the photo; a photo cannot tell capacity or speed. Memory is only a candidate until you pick it."
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
  /** The user said "keep unknown": nothing is suggested for this category. */
  kept?: true;
}

/**
 * The candidates still in play that share the best score, when two or more do: the photo cannot
 * tell them apart, so the user picks. Empty when one candidate leads.
 */
export function equallyLikelyCandidates(
  set: CandidateSet,
  review: CandidateReview,
): AppearanceCandidate[] {
  const open = set.candidates.filter((item) => !review.excludedPartIds.includes(item.partId));
  const tied = open.filter((item) => item.evidenceScore === open[0]?.evidenceScore);
  return tied.length > 1 ? tied : [];
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
    kept: undefined,
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
    kept: true,
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
    kept: undefined,
    chosenPartId: undefined,
    chosenEvidence: undefined,
    manualText,
  };
}

export function emptyCandidateReview(): CandidateReview {
  return { status: "unknown", excludedPartIds: [] };
}
