import type { CustomerNeeds } from "@/types/api";
import type { Build } from "@/types/build";
import type { PlanType, UsageStatus } from "@/types/monetization";
import type { Part, PartCategory } from "@/types/parts";

export type AdvisorSuggestedAction =
  | {
      type: "update_budget";
      label?: string;
      budget: number;
      reason?: string;
    }
  | {
      type: "update_use_case";
      label?: string;
      targetUseCase: string[];
      reason?: string;
    }
  | {
      type: "update_appearance";
      label?: string;
      appearancePreference: NonNullable<CustomerNeeds["appearancePreference"]>;
      reason?: string;
    }
  | {
      type: "update_brand_preference";
      label?: string;
      cpuBrandPreference?: CustomerNeeds["cpuBrandPreference"];
      gpuBrandPreference?: CustomerNeeds["gpuBrandPreference"];
      reason?: string;
    }
  | {
      type: "update_experience_level";
      label?: string;
      experienceLevel: NonNullable<CustomerNeeds["experienceLevel"]>;
      reason?: string;
    }
  | {
      type: "add_owned_part";
      label?: string;
      category?: PartCategory;
      partHint?: string;
      reason?: string;
    }
  | {
      type: "explain_current_build";
      label?: string;
      reason?: string;
    }
  | {
      type: "open_part_explorer";
      label?: string;
      category: PartCategory;
      reason?: string;
    }
  | {
      type: "ask_clarifying_question";
      label?: string;
      question: string;
      reason?: string;
    };

export interface AdvisorRequest {
  message: string;
  conversationHistory?: AdvisorConversationMessage[];
  currentBuild?: Build | null;
  collectedNeeds?: CustomerNeeds;
  activeCompare?: ActiveCompareContext | null;
  plan: PlanType;
  usageStatus: UsageStatus;
}

export interface AdvisorConversationMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ActiveCompareContext {
  category: PartCategory;
  currentPart: Part;
  candidateParts: Part[];
  budget?: number;
  buildTotal?: number;
}

export interface AdvisorProviderResponse {
  assistantMessage: string;
  extractedNeeds?: CustomerNeeds;
  suggestedActions?: AdvisorSuggestedAction[];
  warnings?: string[];
  fallbackUsed?: boolean;
  explanation?: string;
  provider: "mock" | "openai" | "generic";
}

export interface AdvisorApiRequest {
  message: string;
  conversationHistory?: AdvisorConversationMessage[];
  currentBuild?: Build | null;
  collectedNeeds?: CustomerNeeds;
  activeCompare?: ActiveCompareContext | null;
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

const VALID_CATEGORIES = new Set<PartCategory>([
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "ssd",
  "psu",
  "case",
  "cooler",
  "os",
  "fan",
  "accessory",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asCategory(value: unknown) {
  const category = asString(value)?.toLowerCase() as PartCategory | undefined;
  return category && VALID_CATEGORIES.has(category) ? category : undefined;
}

export function normalizeAdvisorActions(value: unknown): AdvisorSuggestedAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): AdvisorSuggestedAction[] => {
    if (!isRecord(entry) || typeof entry.type !== "string") {
      return [];
    }

    const label = asString(entry.label);
    const reason = asString(entry.reason);

    switch (entry.type) {
      case "update_budget": {
        const budget = typeof entry.budget === "number" ? entry.budget : Number(entry.budget);
        return Number.isFinite(budget) && budget > 0
          ? [{ type: "update_budget", label, budget: Math.round(budget), reason }]
          : [];
      }
      case "update_use_case": {
        const targetUseCase = asStringArray(entry.targetUseCase);
        return targetUseCase.length > 0
          ? [{ type: "update_use_case", label, targetUseCase, reason }]
          : [];
      }
      case "update_appearance": {
        const appearancePreference = asString(entry.appearancePreference);
        return appearancePreference === "black" ||
          appearancePreference === "white" ||
          appearancePreference === "rgb"
          ? [{ type: "update_appearance", label, appearancePreference, reason }]
          : [];
      }
      case "update_brand_preference": {
        const cpuBrandPreference = asString(entry.cpuBrandPreference);
        const gpuBrandPreference = asString(entry.gpuBrandPreference);
        return cpuBrandPreference === "amd" ||
          cpuBrandPreference === "intel" ||
          gpuBrandPreference === "amd" ||
          gpuBrandPreference === "nvidia"
          ? [
              {
                type: "update_brand_preference",
                label,
                cpuBrandPreference:
                  cpuBrandPreference === "amd" || cpuBrandPreference === "intel"
                    ? cpuBrandPreference
                    : undefined,
                gpuBrandPreference:
                  gpuBrandPreference === "amd" || gpuBrandPreference === "nvidia"
                    ? gpuBrandPreference
                    : undefined,
                reason,
              },
            ]
          : [];
      }
      case "update_experience_level": {
        const experienceLevel = asString(entry.experienceLevel);
        return experienceLevel === "beginner" ||
          experienceLevel === "intermediate" ||
          experienceLevel === "expert"
          ? [{ type: "update_experience_level", label, experienceLevel, reason }]
          : [];
      }
      case "add_owned_part":
        return [
          {
            type: "add_owned_part",
            label,
            category: asCategory(entry.category),
            partHint: asString(entry.partHint),
            reason,
          },
        ];
      case "open_part_explorer": {
        const category = asCategory(entry.category);
        return category ? [{ type: "open_part_explorer", label, category, reason }] : [];
      }
      case "explain_current_build":
        return [{ type: "explain_current_build", label, reason }];
      case "ask_clarifying_question": {
        const question = asString(entry.question);
        return question ? [{ type: "ask_clarifying_question", label, question, reason }] : [];
      }
      default:
        return [];
    }
  });
}
