import type { AffiliateLink } from "@/types/monetization";
import type { Part } from "@/types/parts";
import type { CustomerNeeds } from "@/types/api";

export interface CompatibilityWarning {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  affectedPartIds: string[];
  suggestedFix?: string;
}

export interface Build {
  id: string;
  name: string;
  targetUseCase: string[];
  budget: number;
  totalPrice: number;
  parts: Part[];
  compatibilityStatus: "pass" | "warning" | "fail";
  compatibilityWarnings: CompatibilityWarning[];
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
}
