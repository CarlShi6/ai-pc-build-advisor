import { seedParts } from "@/data/seedParts";
import { createCandidateBuild } from "@/lib/build-advisor";
import { estimateSystemPower } from "@/lib/compatibility";
import type { Build, SubstitutionSuggestion, SubstitutionType } from "@/types/build";
import type { Part } from "@/types/parts";

type EvaluatedSwap = SubstitutionSuggestion & {
  candidate: Part;
  score: number;
};

const substitutionPriority: Record<SubstitutionType, number> = {
  compatibilitySafeSubstitute: 100,
  budgetAlternative: 90,
  beginnerSafeSubstitute: 80,
  sameTierSubstitute: 70,
  performanceUpgrade: 60,
};

function getDisplayPrice(part: Part) {
  return part.owned ? 0 : part.price;
}

function getNumberSpec(part: Part, keys: string[]) {
  for (const key of keys) {
    const value = part.specs[key];

    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

function getPerformanceScore(part: Part) {
  if (typeof part.performanceScore === "number") {
    return part.performanceScore;
  }

  return getNumberSpec(part, [
    "gaming4kScore",
    "gaming1440pScore",
    "productivityScore",
    "gamingScore",
    "readMb",
    "wattageW",
    "tdpSupportW",
    "gpuClearanceMm",
  ]);
}

function getPowerDraw(part: Part) {
  return getNumberSpec(part, ["powerDrawW", "tdpW"]);
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function hasUseCase(build: Build, tokens: string[]) {
  const useCase = build.targetUseCase.join(" ").toLowerCase();
  return tokens.some((token) => useCase.includes(token));
}

function isCreatorOrHeavyBuild(build: Build) {
  return hasUseCase(build, ["4k", "video", "editing", "ai", "render", "3d", "stream"]);
}

function isMainstreamGamingBuild(build: Build) {
  return hasUseCase(build, ["2k", "1440p", "gaming", "esports"]) && !isCreatorOrHeavyBuild(build);
}

function riskScore(build: Build, part: Part) {
  const power = getPowerDraw(part) ?? 0;
  const price = getDisplayPrice(part);
  const partRisk =
    (part.availability === "low_stock" ? 8 : 0) +
    (part.compatibilityTags.includes("upsell") ? 10 : 0) +
    (part.compatibilityTags.includes("premium") ? 4 : 0) +
    (part.specs.coolerType === "aio" ? 10 : 0) +
    (power > 320 ? 12 : power > 250 ? 6 : 0) +
    (price > 1000 ? 14 : price > 500 ? 5 : 0);

  return (
    build.confidenceScore.failCount * 35 +
    build.confidenceScore.warningCount * 12 +
    Math.max(0, build.totalPrice - build.budget) / 30 +
    partRisk
  );
}

function getCompatibilitySummary(build: Build, candidateBuild: Build) {
  const confidenceDelta = candidateBuild.confidenceScore.score - build.confidenceScore.score;
  const warningDelta = candidateBuild.confidenceScore.warningCount - build.confidenceScore.warningCount;
  const failDelta = candidateBuild.confidenceScore.failCount - build.confidenceScore.failCount;

  if (failDelta < 0) {
    return "Removes a blocking compatibility issue in the current build.";
  }

  if (warningDelta < 0) {
    return "Reduces compatibility warnings in the current build.";
  }

  if (confidenceDelta > 0) {
    return `Improves build confidence by ${confidenceDelta} points.`;
  }

  if (candidateBuild.compatibilityStatus === "pass") {
    return "Keeps all deterministic compatibility checks passing.";
  }

  return "Keeps the same compatibility status after the swap.";
}

function getPerformanceSummary(scoreDelta: number | null) {
  if (scoreDelta === null) {
    return "Performance impact is category-specific and not directly scored.";
  }

  if (scoreDelta > 4) {
    return `Raises the category performance score by ${scoreDelta}.`;
  }

  if (scoreDelta < -4) {
    return `Gives up ${Math.abs(scoreDelta)} performance points.`;
  }

  return "Keeps performance in the same practical tier.";
}

function getBudgetSummary(build: Build, candidateBuild: Build, priceDelta: number) {
  const overBudgetBefore = Math.max(0, build.totalPrice - build.budget);
  const overBudgetAfter = Math.max(0, candidateBuild.totalPrice - build.budget);

  if (overBudgetBefore > 0 && overBudgetAfter < overBudgetBefore) {
    return `Cuts the over-budget gap by ${formatMoney(overBudgetBefore - overBudgetAfter)}.`;
  }

  if (candidateBuild.totalPrice <= build.budget && build.totalPrice > build.budget) {
    return "Brings the build back within budget.";
  }

  if (priceDelta < 0) {
    return `Saves ${formatMoney(Math.abs(priceDelta))} versus the current part.`;
  }

  return `Adds ${formatMoney(priceDelta)} while improving the build fit.`;
}

function getBeginnerSummary(riskDelta: number) {
  if (riskDelta < -12) {
    return "Meaningfully lowers beginner risk through cleaner power, price, or compatibility fit.";
  }

  if (riskDelta < 0) {
    return "Slightly lowers beginner risk.";
  }

  if (riskDelta > 8) {
    return "Adds some beginner risk, mainly from cost, power, or availability.";
  }

  return "Keeps beginner risk about the same.";
}

function classifySubstitution({
  build,
  currentPart,
  candidate,
  candidateBuild,
  priceDelta,
  performanceDelta,
  riskDelta,
}: {
  build: Build;
  currentPart: Part;
  candidate: Part;
  candidateBuild: Build;
  priceDelta: number;
  performanceDelta: number | null;
  riskDelta: number;
}): SubstitutionType | null {
  const improvesCompatibility =
    candidateBuild.confidenceScore.failCount < build.confidenceScore.failCount ||
    candidateBuild.confidenceScore.warningCount < build.confidenceScore.warningCount ||
    candidateBuild.confidenceScore.score >= build.confidenceScore.score + 8;
  const overBudgetBefore = build.totalPrice > build.budget;
  const overBudgetAfter = candidateBuild.totalPrice > build.budget;
  const similarPerformance = performanceDelta === null || performanceDelta >= -6;

  if (improvesCompatibility && candidateBuild.confidenceScore.failCount <= build.confidenceScore.failCount) {
    return "compatibilitySafeSubstitute";
  }

  if ((overBudgetBefore || priceDelta < -75) && priceDelta < 0 && similarPerformance) {
    return "budgetAlternative";
  }

  if (riskDelta < -8 && candidateBuild.compatibilityStatus !== "fail") {
    return "beginnerSafeSubstitute";
  }

  if (priceDelta < 0 && similarPerformance && !overBudgetAfter) {
    return "sameTierSubstitute";
  }

  if (
    !overBudgetBefore &&
    priceDelta > 0 &&
    (performanceDelta ?? 0) >= 7 &&
    candidateBuild.confidenceScore.score >= build.confidenceScore.score - 8
  ) {
    return "performanceUpgrade";
  }

  if (
    isMainstreamGamingBuild(build) &&
    currentPart.compatibilityTags.includes("upsell") &&
    priceDelta < 0 &&
    similarPerformance
  ) {
    return "budgetAlternative";
  }

  return null;
}

function getRecommendationReason(type: SubstitutionType, candidate: Part) {
  if (type === "compatibilitySafeSubstitute") {
    return `${candidate.displayName} is a safer compatibility fit after deterministic checks.`;
  }

  if (type === "budgetAlternative") {
    return `${candidate.displayName} lowers the build cost while keeping the same practical tier.`;
  }

  if (type === "beginnerSafeSubstitute") {
    return `${candidate.displayName} reduces beginner risk around power, fit, stock, or price.`;
  }

  if (type === "performanceUpgrade") {
    return `${candidate.displayName} is the clearest rule-based performance upgrade in this category.`;
  }

  return `${candidate.displayName} is a close same-tier substitute with a cleaner overall fit.`;
}

function getTradeOffSummary(type: SubstitutionType, priceDelta: number, performanceDelta: number | null) {
  if (type === "performanceUpgrade") {
    return `Costs ${formatMoney(priceDelta)} more for a stronger scored part.`;
  }

  if (performanceDelta !== null && performanceDelta < -4) {
    return `Saves money but gives up ${Math.abs(performanceDelta)} scored performance points.`;
  }

  if (priceDelta < 0) {
    return `Saves ${formatMoney(Math.abs(priceDelta))}; performance remains close enough for this use case.`;
  }

  return "The main trade-off is changing the part choice without a major budget swing.";
}

function shouldConsiderCategory(build: Build, part: Part) {
  if (build.totalPrice > build.budget) {
    return true;
  }

  if (build.compatibilityWarnings.some((warning) => warning.affectedPartIds.includes(part.id))) {
    return true;
  }

  if (part.category === "psu") {
    const wattage = getNumberSpec(part, ["wattageW"]) ?? 0;
    return wattage > 0 && wattage - estimateSystemPower(build) < 100;
  }

  if (isMainstreamGamingBuild(build)) {
    return (
      part.compatibilityTags.includes("upsell") ||
      (part.category === "gpu" && (getPerformanceScore(part) ?? 0) >= 88) ||
      (part.category === "cpu" && (getNumberSpec(part, ["productivityScore"]) ?? 0) >= 92)
    );
  }

  return riskScore(build, part) >= 18;
}

export function getDynamicSubstitutionSuggestions(
  build: Build,
  catalog: Part[] = seedParts,
): SubstitutionSuggestion[] {
  const suggestions = new Map<string, EvaluatedSwap>();

  for (const currentPart of build.parts) {
    if (!shouldConsiderCategory(build, currentPart)) {
      continue;
    }

    const currentPerformance = getPerformanceScore(currentPart);
    const currentRisk = riskScore(build, currentPart);
    const candidates = catalog.filter(
      (part) => part.category === currentPart.category && part.id !== currentPart.id,
    );

    for (const candidate of candidates) {
      const candidateBuild = createCandidateBuild(build, candidate);

      if (candidateBuild.confidenceScore.failCount > build.confidenceScore.failCount) {
        continue;
      }

      const candidatePerformance = getPerformanceScore(candidate);
      const performanceDelta =
        currentPerformance !== null && candidatePerformance !== null
          ? candidatePerformance - currentPerformance
          : null;
      const priceDelta = getDisplayPrice(candidate) - getDisplayPrice(currentPart);
      const candidateRisk = riskScore(candidateBuild, candidate);
      const riskDelta = Math.round(candidateRisk - currentRisk);
      const substitutionType = classifySubstitution({
        build,
        currentPart,
        candidate,
        candidateBuild,
        priceDelta,
        performanceDelta,
        riskDelta,
      });

      if (!substitutionType) {
        continue;
      }

      const overBudgetBefore = Math.max(0, build.totalPrice - build.budget);
      const overBudgetAfter = Math.max(0, candidateBuild.totalPrice - build.budget);
      const score =
        substitutionPriority[substitutionType] +
        (build.confidenceScore.failCount - candidateBuild.confidenceScore.failCount) * 40 +
        (build.confidenceScore.warningCount - candidateBuild.confidenceScore.warningCount) * 12 +
        Math.max(0, build.confidenceScore.score - candidateBuild.confidenceScore.score) * -0.5 +
        Math.max(0, -priceDelta) / 20 +
        Math.max(0, performanceDelta ?? 0) * 1.2 +
        Math.max(0, -riskDelta) * 1.5 +
        Math.max(0, overBudgetBefore - overBudgetAfter) / 20;

      suggestions.set(`${currentPart.id}-${candidate.id}`, {
        originalPartId: currentPart.id,
        substitutePartId: candidate.id,
        category: currentPart.category,
        substitutionType,
        priceDelta,
        totalAfterSwap: candidateBuild.totalPrice,
        confidenceScoreAfterSwap: candidateBuild.confidenceScore.score,
        compatibilityImpact: {
          statusBefore: build.compatibilityStatus,
          statusAfter: candidateBuild.compatibilityStatus,
          confidenceDelta: candidateBuild.confidenceScore.score - build.confidenceScore.score,
          warningDelta: candidateBuild.confidenceScore.warningCount - build.confidenceScore.warningCount,
          failDelta: candidateBuild.confidenceScore.failCount - build.confidenceScore.failCount,
          summary: getCompatibilitySummary(build, candidateBuild),
        },
        performanceImpact: {
          scoreBefore: currentPerformance,
          scoreAfter: candidatePerformance,
          scoreDelta: performanceDelta,
          summary: getPerformanceSummary(performanceDelta),
        },
        budgetImpact: {
          budget: build.budget,
          overBudgetBefore,
          overBudgetAfter,
          savings: Math.max(0, -priceDelta),
          summary: getBudgetSummary(build, candidateBuild, priceDelta),
        },
        beginnerRiskImpact: {
          riskBefore: Math.round(currentRisk),
          riskAfter: Math.round(candidateRisk),
          riskDelta,
          summary: getBeginnerSummary(riskDelta),
        },
        recommendationReason: getRecommendationReason(substitutionType, candidate),
        tradeOffSummary: getTradeOffSummary(substitutionType, priceDelta, performanceDelta),
        candidate,
        score,
      });
    }
  }

  return Array.from(suggestions.values())
    .sort((left, right) => right.score - left.score)
    .filter((suggestion, index, all) => {
      const firstForCategory = all.findIndex(
        (item) =>
          item.category === suggestion.category &&
          item.substitutionType === suggestion.substitutionType,
      );

      return firstForCategory === index;
    })
    .slice(0, 5)
    .map(({ candidate, score, ...suggestion }) => suggestion);
}
