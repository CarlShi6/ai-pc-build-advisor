import type { Part } from "@/types/parts";

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
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  note?: string;
}

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
