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
}

export interface CartPreviewItem {
  partId: string;
  displayName: string;
  retailer: string;
  estimatedPrice: number;
  quantity: number;
  productUrl?: string;
  searchUrl?: string;
  note?: string;
}

export interface StoreEmployeeSummary {
  customerGoal: string;
  recommendedBuildLogic: string;
  keySellingPoints: string[];
  cheaperAlternative: string;
  upsellOption: string;
  compatibilityStatus: string;
  preCartStatus: string;
}
