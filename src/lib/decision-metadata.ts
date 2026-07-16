import {
  calculateBuildConfidenceScore,
  calculateBuildTotal,
  deriveCompatibilityStatus,
  evaluateCompatibilityRules,
  getCompatibilityWarnings,
} from "@/lib/compatibility";
import type { Build, PartDecisionMetadata } from "@/types/build";
import type { Part } from "@/types/parts";

type CandidateDecision = PartDecisionMetadata & {
  valueRankScore: number;
  performanceRankScore: number;
  budgetRankScore: number;
  beginnerRiskScore: number;
  priceDifference: number;
  performanceDifference: number | null;
  powerDifference: number | null;
};

function buildCandidate(build: Build, replacement: Part) {
  const parts = build.parts.map((part) =>
    part.category === replacement.category ? replacement : part,
  );
  const candidate: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityWarnings: [],
    compatibilityChecks: [],
    compatibilityStatus: "pass",
    confidenceScore: {
      score: 0,
      label: "Low",
      summary: "Compatibility rules have not run yet.",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
    },
  };
  const compatibilityChecks = evaluateCompatibilityRules(candidate);

  return {
    ...candidate,
    compatibilityChecks,
    compatibilityWarnings: getCompatibilityWarnings(compatibilityChecks),
    compatibilityStatus: deriveCompatibilityStatus(compatibilityChecks),
    confidenceScore: calculateBuildConfidenceScore(compatibilityChecks),
  };
}

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

function getValueScore(part: Part) {
  if (typeof part.valueScore === "number") {
    return part.valueScore;
  }

  if (typeof part.valueRating === "number") {
    return part.valueRating;
  }

  const performanceScore = getPerformanceScore(part);
  const displayPrice = Math.max(getDisplayPrice(part), 1);

  if (performanceScore !== null) {
    return Math.max(1, Math.min(100, Math.round((performanceScore / displayPrice) * 700)));
  }

  return Math.max(1, Math.min(100, Math.round((250 / displayPrice) * 40)));
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function getCompatibilitySummary(candidateBuild: Build, currentBuild: Build) {
  if (candidateBuild.compatibilityStatus === "fail") {
    return `${candidateBuild.confidenceScore.score}/100 confidence with ${candidateBuild.confidenceScore.failCount} blocking issue${candidateBuild.confidenceScore.failCount === 1 ? "" : "s"}.`;
  }

  if (candidateBuild.compatibilityStatus === "warning") {
    return `${candidateBuild.confidenceScore.score}/100 confidence with ${candidateBuild.confidenceScore.warningCount} item${candidateBuild.confidenceScore.warningCount === 1 ? "" : "s"} to review.`;
  }

  if (candidateBuild.confidenceScore.score > currentBuild.confidenceScore.score) {
    return `${candidateBuild.confidenceScore.score}/100 confidence, improving compatibility confidence.`;
  }

  return `${candidateBuild.confidenceScore.score}/100 confidence with all checked rules passing.`;
}

function getRecommendationReason(decision: CandidateDecision, part: Part, selectedPart: Part) {
  if (part.id === selectedPart.id) {
    return "Current baseline. Use it as the point of comparison before changing the build.";
  }

  if (decision.compatibilityImpact.status === "fail") {
    return "Not recommended yet because at least one compatibility check fails.";
  }

  if (decision.bestBudgetFit) {
    return "Best budget fit because it keeps the total closest to your budget with fewer beginner risks.";
  }

  if (decision.bestValue) {
    return "Best value because it gives the strongest score for the money in this comparison.";
  }

  if (decision.bestPerformance) {
    return "Best performance because it has the highest workload score in this comparison.";
  }

  if (decision.beginnerFriendly) {
    return "Beginner friendly because compatibility stays clean and the swap avoids major power or budget pressure.";
  }

  return part.recommendationReason ?? "Reasonable option, but another selected part is a clearer fit.";
}

function getTradeOffSummary(decision: CandidateDecision) {
  if (decision.compatibilityImpact.status === "fail") {
    return "Compatibility needs to be fixed before this is a safe choice.";
  }

  if (decision.priceDifference > 0 && (decision.performanceDifference ?? 0) > 0) {
    return `Costs ${formatMoney(decision.priceDifference)} more for stronger performance.`;
  }

  if (decision.priceDifference < 0 && (decision.performanceDifference ?? 0) < 0) {
    return `Saves ${formatMoney(Math.abs(decision.priceDifference))}, but gives up some performance.`;
  }

  if (decision.priceDifference < 0) {
    return `Saves ${formatMoney(Math.abs(decision.priceDifference))} while keeping the compatibility result.`;
  }

  if ((decision.powerDifference ?? 0) > 40) {
    return "Uses noticeably more power, so PSU headroom matters more.";
  }

  if (decision.compatibilityImpact.warningCount > 0) {
    return "Works, but review the compatibility warning before buying.";
  }

  return "No major trade-off compared with the current selected part.";
}

export function getPartDecisionMetadata(
  build: Build,
  parts: Part[],
  selectedPart: Part,
): PartDecisionMetadata[] {
  const selectedPrice = getDisplayPrice(selectedPart);
  const selectedPerformance = getPerformanceScore(selectedPart);
  const selectedPower = getNumberSpec(selectedPart, ["powerDrawW", "tdpW", "wattageW"]);
  const evaluated: CandidateDecision[] = parts.map((part) => {
    const candidateBuild = buildCandidate(build, part);
    const totalPriceAfterSwap = candidateBuild.totalPrice;
    const priceDifference = getDisplayPrice(part) - selectedPrice;
    const performanceScore = getPerformanceScore(part);
    const performanceDifference =
      performanceScore !== null && selectedPerformance !== null
        ? performanceScore - selectedPerformance
        : null;
    const power = getNumberSpec(part, ["powerDrawW", "tdpW", "wattageW"]);
    const powerDifference = power !== null && selectedPower !== null ? power - selectedPower : null;
    const valueScore = getValueScore(part);
    const compatibilityPenalty =
      candidateBuild.confidenceScore.failCount * 60 +
      candidateBuild.confidenceScore.warningCount * 18 +
      Math.max(0, 100 - candidateBuild.confidenceScore.score);
    const overBudget = Math.max(0, totalPriceAfterSwap - build.budget);
    const underBudget = Math.max(0, build.budget - totalPriceAfterSwap);
    const budgetPressure = build.budget > 0 ? (overBudget / build.budget) * 100 : overBudget;
    const powerPressure = Math.max(0, powerDifference ?? 0) / 3;

    return {
      partId: part.id,
      bestValue: false,
      bestPerformance: false,
      bestBudgetFit: false,
      beginnerFriendly: false,
      compatibilityImpact: {
        status: candidateBuild.compatibilityStatus,
        confidenceScore: candidateBuild.confidenceScore.score,
        warningCount: candidateBuild.confidenceScore.warningCount,
        failCount: candidateBuild.confidenceScore.failCount,
        summary: getCompatibilitySummary(candidateBuild, build),
      },
      totalPriceAfterSwap,
      recommendationReason: "",
      tradeOffSummary: "",
      valueScore,
      performanceScore,
      valueRankScore: valueScore - compatibilityPenalty,
      performanceRankScore: (performanceScore ?? 0) - compatibilityPenalty,
      budgetRankScore:
        totalPriceAfterSwap <= build.budget
          ? 1000 - underBudget / 10 - compatibilityPenalty
          : 1000 - overBudget - compatibilityPenalty,
      beginnerRiskScore: compatibilityPenalty + budgetPressure + powerPressure,
      priceDifference,
      performanceDifference,
      powerDifference,
    };
  });

  const bestBy = (selector: (decision: CandidateDecision) => number, direction: "max" | "min") =>
    evaluated.reduce<CandidateDecision | null>((best, decision) => {
      if (!best) {
        return decision;
      }

      const value = selector(decision);
      const bestValue = selector(best);

      if (direction === "max") {
        return value > bestValue ? decision : best;
      }

      return value < bestValue ? decision : best;
    }, null);

  const bestValue = bestBy((decision) => decision.valueRankScore, "max");
  const bestPerformance = bestBy((decision) => decision.performanceRankScore, "max");
  const bestBudgetFit = bestBy((decision) => decision.budgetRankScore, "max");
  const beginnerFriendly = bestBy((decision) => decision.beginnerRiskScore, "min");

  return evaluated.map((decision) => {
    const withWinners: CandidateDecision = {
      ...decision,
      bestValue: decision.partId === bestValue?.partId,
      bestPerformance: decision.partId === bestPerformance?.partId,
      bestBudgetFit: decision.partId === bestBudgetFit?.partId,
      beginnerFriendly: decision.partId === beginnerFriendly?.partId,
    };

    return {
      partId: withWinners.partId,
      bestValue: withWinners.bestValue,
      bestPerformance: withWinners.bestPerformance,
      bestBudgetFit: withWinners.bestBudgetFit,
      beginnerFriendly: withWinners.beginnerFriendly,
      compatibilityImpact: withWinners.compatibilityImpact,
      totalPriceAfterSwap: withWinners.totalPriceAfterSwap,
      recommendationReason: getRecommendationReason(withWinners, parts.find((part) => part.id === withWinners.partId) ?? selectedPart, selectedPart),
      tradeOffSummary: getTradeOffSummary(withWinners),
      valueScore: withWinners.valueScore,
      performanceScore: withWinners.performanceScore,
    };
  });
}
