import type { AffiliateLink } from "@/types/monetization";
import type { Part } from "@/types/parts";
import type { CustomerNeeds } from "@/types/api";
import type { PartCategory } from "@/types/parts";

export interface CompatibilityWarning {
  id: string;
  severity: "warning" | "fail";
  message: string;
  affectedPartIds: string[];
  suggestedFix?: string;
}

export type CompatibilitySeverity = "pass" | "warning" | "fail";

export interface CompatibilityRuleResult {
  id: string;
  label: string;
  severity: CompatibilitySeverity;
  message: string;
  affectedPartIds: string[];
  suggestedFix?: string;
  checkedPartCategories: string[];
}

export interface BuildConfidenceScore {
  score: number;
  label: "High" | "Medium" | "Low";
  summary: string;
  passCount: number;
  warningCount: number;
  failCount: number;
}

export interface PartDecisionMetadata {
  partId: string;
  bestValue: boolean;
  bestPerformance: boolean;
  bestBudgetFit: boolean;
  beginnerFriendly: boolean;
  compatibilityImpact: {
    status: Build["compatibilityStatus"];
    confidenceScore: number;
    warningCount: number;
    failCount: number;
    summary: string;
  };
  totalPriceAfterSwap: number;
  recommendationReason: string;
  tradeOffSummary: string;
  valueScore: number;
  performanceScore: number | null;
}

export type SubstitutionType =
  | "budgetAlternative"
  | "performanceUpgrade"
  | "sameTierSubstitute"
  | "beginnerSafeSubstitute"
  | "compatibilitySafeSubstitute";

export interface SubstitutionSuggestion {
  originalPartId: string;
  substitutePartId: string;
  category: PartCategory;
  substitutionType: SubstitutionType;
  priceDelta: number;
  totalAfterSwap: number;
  confidenceScoreAfterSwap: number;
  compatibilityImpact: {
    statusBefore: Build["compatibilityStatus"];
    statusAfter: Build["compatibilityStatus"];
    confidenceDelta: number;
    warningDelta: number;
    failDelta: number;
    summary: string;
  };
  performanceImpact: {
    scoreBefore: number | null;
    scoreAfter: number | null;
    scoreDelta: number | null;
    summary: string;
  };
  budgetImpact: {
    budget: number;
    overBudgetBefore: number;
    overBudgetAfter: number;
    savings: number;
    summary: string;
  };
  beginnerRiskImpact: {
    riskBefore: number;
    riskAfter: number;
    riskDelta: number;
    summary: string;
  };
  recommendationReason: string;
  tradeOffSummary: string;
}

export interface Build {
  id: string;
  name: string;
  targetUseCase: string[];
  budget: number;
  totalPrice: number;
  parts: Part[];
  compatibilityStatus: "pass" | "warning" | "fail";
  compatibilityChecks: CompatibilityRuleResult[];
  compatibilityWarnings: CompatibilityWarning[];
  confidenceScore: BuildConfidenceScore;
  recommendationSummary?: string;
}

export interface CartPreviewItem {
  partId: string;
  displayName: string;
  retailer: string;
  estimatedPrice: number;
  quantity: number;
  productUrl?: string;
  searchUrl?: string;
  affiliateLinks?: AffiliateLink[];
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  note?: string;
}

export type PurchaseListItem = CartPreviewItem;

export interface BuyerSummary {
  customerGoal: string;
  recommendedBuildLogic: string;
  keySellingPoints: string[];
  cheaperAlternative: string;
  upsellOption: string;
  compatibilityStatus: string;
  preCartStatus: string;
}

export type StoreEmployeeSummary = BuyerSummary;
export type BuyerRecommendationSummary = BuyerSummary;

export interface SavedBuild {
  id: string;
  name: string;
  build: Build;
  buildNeeds: CustomerNeeds;
  feedback: PostBuildFeedback[];
  feedbackSummary?: PostBuildFeedbackSummary;
  createdAt: string;
  updatedAt: string;
  totalPrice: number;
  compatibilityStatus: Build["compatibilityStatus"];
  ownedParts: number;
  targetUseCase: string[];
}

export interface SavedBuildSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalPrice: number;
  compatibilityStatus: Build["compatibilityStatus"];
  ownedParts: number;
  targetUseCase: string[];
  cpuName?: string;
  gpuName?: string;
  feedbackSummary?: PostBuildFeedbackSummary;
}

export type BuildFeedbackIssueLevel = "no_issue" | "minor_issue" | "major_issue" | "not_sure";
export type BuildFeedbackDifficulty = "easy" | "manageable" | "hard" | "not_sure";
export type BuildFeedbackBoolean = "yes" | "no" | "not_sure";

export interface PostBuildFeedback {
  id: string;
  buildId: string;
  userId?: string;
  sessionId: string;
  completedAt: string;
  bootSuccess: BuildFeedbackBoolean;
  installationDifficulty: BuildFeedbackDifficulty;
  compatibilityIssues: BuildFeedbackIssueLevel;
  thermalExperience: BuildFeedbackIssueLevel;
  noiseExperience: BuildFeedbackIssueLevel;
  cableManagementExperience: BuildFeedbackIssueLevel;
  gpuClearanceIssue: BuildFeedbackIssueLevel;
  coolerFitIssue: BuildFeedbackIssueLevel;
  biosUpdateNeeded: BuildFeedbackBoolean;
  driverIssue: BuildFeedbackIssueLevel;
  overallSatisfaction: number;
  wouldRecommend: BuildFeedbackBoolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostBuildFeedbackInput {
  buildId: string;
  completedAt?: string;
  bootSuccess: BuildFeedbackBoolean;
  installationDifficulty: BuildFeedbackDifficulty;
  compatibilityIssues: BuildFeedbackIssueLevel;
  thermalExperience: BuildFeedbackIssueLevel;
  noiseExperience: BuildFeedbackIssueLevel;
  cableManagementExperience: BuildFeedbackIssueLevel;
  gpuClearanceIssue: BuildFeedbackIssueLevel;
  coolerFitIssue: BuildFeedbackIssueLevel;
  biosUpdateNeeded: BuildFeedbackBoolean;
  driverIssue: BuildFeedbackIssueLevel;
  overallSatisfaction: number;
  wouldRecommend: BuildFeedbackBoolean;
  notes?: string;
}

export interface PostBuildFeedbackSummary {
  completedAt: string;
  reportCount: number;
  issuesReported: number;
  satisfactionScore: number;
  beginnerDifficulty: BuildFeedbackDifficulty;
  latestFeedbackId: string;
}
