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
      "Unlock Build Pro to see advanced reasoning, value analysis, and compatibility impact.",
    ai_reasoning: "Unlock Build Pro to see AI reasoning for every recommendation.",
    purchase_checklist: "Unlock Build Pro to use the full purchase-ready checklist.",
    build_export: "Unlock Build Pro to save an export-ready build.",
    unlimited_swaps: "Unlock Build Pro for better upgrade and downgrade decisions.",
  };

  return messages[featureKey];
}

export function getPlanForEntitlement(entitlement?: Entitlement | null): PlanType {
  if (!entitlement?.active) {
    return "free";
  }

  return entitlement.plan;
}
