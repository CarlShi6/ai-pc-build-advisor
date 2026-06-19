import type { CustomerNeeds } from "@/types/api";
import type { Build } from "@/types/build";
import type { PlanType, UsageStatus } from "@/types/monetization";

export type AdvisorSuggestedAction =
  | {
      type: "update_budget";
      budget: number;
      reason?: string;
    }
  | {
      type: "update_use_case";
      targetUseCase: string[];
      reason?: string;
    }
  | {
      type: "suggest_category_focus";
      category: string;
      reason?: string;
    }
  | {
      type: "explain_current_build";
      reason?: string;
    }
  | {
      type: "open_part_explorer";
      category: string;
      reason?: string;
    };

export interface AdvisorRequest {
  message: string;
  currentBuild?: Build | null;
  collectedNeeds?: CustomerNeeds;
  plan: PlanType;
  usageStatus: UsageStatus;
}

export interface AdvisorProviderResponse {
  assistantMessage: string;
  extractedNeeds?: CustomerNeeds;
  suggestedActions?: AdvisorSuggestedAction[];
  explanation?: string;
  provider: "mock" | "openai" | "generic";
}

export interface AdvisorApiRequest {
  message: string;
  currentBuild?: Build | null;
  collectedNeeds?: CustomerNeeds;
  plan?: PlanType;
  usageStatus?: UsageStatus | null;
}

export interface AdvisorApiResponse extends AdvisorProviderResponse {
  usage: UsageStatus;
  usageConsumed: boolean;
  upgradeRequired?: boolean;
}

export interface AiProvider {
  name: AdvisorProviderResponse["provider"];
  isConfigured(): boolean;
  getAdvisorResponse(request: AdvisorRequest): Promise<AdvisorProviderResponse>;
}
