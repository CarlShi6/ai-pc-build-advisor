import type { AdvisorSuggestedAction } from "@/lib/ai/types";
import type { CustomerNeeds } from "@/types/api";
import type { Build } from "@/types/build";

export type JourneyOperation = "idle" | "advisor" | "refining" | "saving" | "loading";

export interface BuildChangeSummary {
  totalDelta: number;
  budgetDeltaBefore: number;
  budgetDeltaAfter: number;
  compatibilityBefore: Build["compatibilityStatus"];
  compatibilityAfter: Build["compatibilityStatus"];
  changedCategories: string[];
}

export function mergeCustomerNeeds(current: CustomerNeeds, update: CustomerNeeds): CustomerNeeds {
  return {
    ...current,
    ...update,
    targetUseCase: update.targetUseCase ?? current.targetUseCase,
  };
}

export function needsUpdateFromAdvisorAction(action: AdvisorSuggestedAction): CustomerNeeds | null {
  switch (action.type) {
    case "update_budget":
      return { budget: action.budget };
    case "update_use_case":
      return { targetUseCase: action.targetUseCase };
    case "update_appearance":
      return { appearancePreference: action.appearancePreference };
    case "update_brand_preference":
      return {
        ...(action.cpuBrandPreference ? { cpuBrandPreference: action.cpuBrandPreference } : {}),
        ...(action.gpuBrandPreference ? { gpuBrandPreference: action.gpuBrandPreference } : {}),
      };
    case "update_experience_level":
      return { experienceLevel: action.experienceLevel };
    default:
      return null;
  }
}

export function advisorActionsFromNeeds(needs: CustomerNeeds): AdvisorSuggestedAction[] {
  const actions: AdvisorSuggestedAction[] = [];
  if (needs.budget)
    actions.push({ type: "update_budget", budget: needs.budget, label: "Review budget update" });
  if (needs.targetUseCase?.length)
    actions.push({
      type: "update_use_case",
      targetUseCase: needs.targetUseCase,
      label: "Review workload update",
    });
  if (needs.appearancePreference)
    actions.push({
      type: "update_appearance",
      appearancePreference: needs.appearancePreference,
      label: "Review appearance update",
    });
  if (needs.cpuBrandPreference || needs.gpuBrandPreference)
    actions.push({
      type: "update_brand_preference",
      cpuBrandPreference: needs.cpuBrandPreference,
      gpuBrandPreference: needs.gpuBrandPreference,
      label: "Review brand preference",
    });
  if (needs.experienceLevel)
    actions.push({
      type: "update_experience_level",
      experienceLevel: needs.experienceLevel,
      label: "Review experience update",
    });
  return actions;
}

export function summarizeBuildChange(current: Build, candidate: Build): BuildChangeSummary {
  const currentByCategory = new Map(current.parts.map((part) => [part.category, part.id]));
  return {
    totalDelta: candidate.totalPrice - current.totalPrice,
    budgetDeltaBefore: current.budget - current.totalPrice,
    budgetDeltaAfter: candidate.budget - candidate.totalPrice,
    compatibilityBefore: current.compatibilityStatus,
    compatibilityAfter: candidate.compatibilityStatus,
    changedCategories: candidate.parts
      .filter((part) => currentByCategory.get(part.category) !== part.id)
      .map((part) => part.category),
  };
}

export function createRequestSequence() {
  let latest = 0;
  return {
    begin() {
      latest += 1;
      return latest;
    },
    isLatest(requestId: number) {
      return requestId === latest;
    },
    invalidate() {
      latest += 1;
    },
  };
}

export function createOperationGate() {
  let current: JourneyOperation = "idle";
  return {
    tryBegin(next: Exclude<JourneyOperation, "idle">) {
      if (current !== "idle") return false;
      current = next;
      return true;
    },
    finish(expected: Exclude<JourneyOperation, "idle">) {
      if (current === expected) current = "idle";
    },
    current() {
      return current;
    },
  };
}
