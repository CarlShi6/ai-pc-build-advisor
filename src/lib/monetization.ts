import type {
  Entitlement,
  FeatureKey,
  PlanType,
  UsageLimit,
  UsageStatus,
} from "@/types/monetization";

export const FREE_PLAN: UsageLimit = {
  aiQuestionsPerDay: 5,
  replacementLimit: 3,
  maxCompareParts: 4,
  canUseAdvancedCompare: false,
};

export const BUILD_PRO_PLAN: UsageLimit = {
  aiQuestionsPerBuild: 50,
  replacementLimit: 25,
  maxCompareParts: 4,
  canUseAdvancedCompare: true,
};

const FEATURE_ACCESS: Record<PlanType, Record<FeatureKey, boolean>> = {
  free: {
    advanced_compare: false,
    ai_reasoning: false,
    purchase_checklist: false,
    build_export: false,
    unlimited_swaps: false,
  },
  build_pro: {
    advanced_compare: true,
    ai_reasoning: true,
    purchase_checklist: true,
    build_export: true,
    unlimited_swaps: true,
  },
};

export function canUseFeature(plan: PlanType, featureKey: FeatureKey) {
  return FEATURE_ACCESS[plan][featureKey];
}

export function getRemainingAiQuestions(usageStatus: UsageStatus) {
  return Math.max(0, usageStatus.remainingAiQuestions);
}

export function getRemainingReplacements(usageStatus: UsageStatus) {
  return Math.max(0, usageStatus.remainingReplacements);
}

export function formatUpgradeMessage(featureKey: FeatureKey) {
  const messages: Record<FeatureKey, string> = {
    advanced_compare:
      "Build Pro adds advanced reasoning, value analysis, and compatibility impact before you choose.",
    ai_reasoning: "Build Pro adds AI reasoning for every recommendation in this build.",
    purchase_checklist: "Build Pro unlocks the full purchase checklist before you buy.",
    build_export: "Build Pro unlocks saved builds, copy, JSON, and Markdown export.",
    unlimited_swaps: "Build Pro includes 25 hardware replacements for this build.",
  };

  return messages[featureKey];
}

export function getPlanForEntitlement(entitlement?: Entitlement | null): PlanType {
  if (!entitlement?.active) {
    return "free";
  }

  return entitlement.plan;
}
