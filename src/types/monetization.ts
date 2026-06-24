export type PlanType = "free" | "build_pro";

export type FeatureKey =
  | "advanced_compare"
  | "ai_reasoning"
  | "purchase_checklist"
  | "build_export"
  | "unlimited_swaps";

export interface UsageLimit {
  aiQuestionsPerDay?: number;
  aiQuestionsPerBuild?: number;
  replacementLimit?: number;
  maxCompareParts?: number;
  canUseAdvancedCompare: boolean;
}

export interface Entitlement {
  userId: string;
  plan: PlanType;
  buildId?: string;
  active: boolean;
  startedAt: string;
  expiresAt?: string;
  paymentProvider?: "mock" | "stripe";
  checkoutSessionId?: string;
  activatedAt?: string;
}

export interface UsageStatus {
  userId: string;
  plan: PlanType;
  aiQuestionsUsedToday: number;
  aiQuestionsLimitToday?: number;
  aiQuestionsUsedForBuild?: number;
  aiQuestionsLimitForBuild?: number;
  remainingAiQuestions: number;
  canAskAiQuestion: boolean;
  replacementLimit: number;
  replacementsUsed: number;
  remainingReplacements: number;
  canReplacePart: boolean;
}

export type AffiliateMerchant =
  | "amazon"
  | "newegg"
  | "microcenter"
  | "bestbuy"
  | "bhphoto"
  | "other";

export interface AffiliateLink {
  merchant: AffiliateMerchant;
  url: string;
  price?: number;
  inStock?: boolean;
  label?: string;
}

export interface CheckoutResult {
  success: boolean;
  plan: PlanType;
  entitlement?: Entitlement;
  message?: string;
}

export interface CreateCheckoutSessionRequest {
  plan: "build_pro";
  buildId?: string;
  userId?: string;
}

export interface CreateCheckoutSessionResponse {
  checkoutUrl?: string;
  fallbackUsed: boolean;
  message: string;
}

export interface AffiliateClickEvent {
  userId?: string;
  buildId?: string;
  partId: string;
  merchant: AffiliateMerchant;
  url: string;
  clickedAt: string;
}
