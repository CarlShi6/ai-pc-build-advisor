import { parseCustomerNeeds } from "@/lib/needParser";
import type {
  AdvisorProviderResponse,
  AdvisorRequest,
  AdvisorSuggestedAction,
  AiProvider,
} from "@/lib/ai/types";

function getCategoryFocus(message: string): string | null {
  if (/\bgpu\b|\bgraphics\b|\brtx\b|\bradeon\b/i.test(message)) {
    return "gpu";
  }

  if (/\bcpu\b|\bprocessor\b|\bintel\b|\bryzen\b/i.test(message)) {
    return "cpu";
  }

  if (/\bmotherboard\b|\bmobo\b|\bsocket\b/i.test(message)) {
    return "motherboard";
  }

  if (/\bram\b|\bmemory\b|\bddr/i.test(message)) {
    return "ram";
  }

  if (/\bssd\b|\bstorage\b|\bnvme\b/i.test(message)) {
    return "ssd";
  }

  if (/\bpsu\b|\bpower supply\b|\bwatt/i.test(message)) {
    return "psu";
  }

  if (/\bcase\b|\bclearance\b|\bairflow\b/i.test(message)) {
    return "case";
  }

  if (/\bcooler\b|\bcooling\b|\baio\b|\bthermal/i.test(message)) {
    return "cooler";
  }

  return null;
}

export function createMockAdvisorResponse(request: AdvisorRequest): AdvisorProviderResponse {
  const parsed = parseCustomerNeeds(request.message);
  const build = request.currentBuild;
  const cpu = build?.parts.find((part) => part.category === "cpu");
  const gpu = build?.parts.find((part) => part.category === "gpu");
  const categoryFocus = getCategoryFocus(request.message);
  const suggestedActions: AdvisorSuggestedAction[] = [];

  if (parsed.parsedNeeds.budget) {
    suggestedActions.push({
      type: "update_budget",
      budget: parsed.parsedNeeds.budget,
      reason: "Use this budget to refresh the safe rule-based recommendation.",
    });
  }

  if (parsed.parsedNeeds.targetUseCase?.length) {
    suggestedActions.push({
      type: "update_use_case",
      targetUseCase: parsed.parsedNeeds.targetUseCase,
      reason: "Tune the mock recommendation toward the workload you described.",
    });
  }

  if (categoryFocus) {
    suggestedActions.push({
      type: "open_part_explorer",
      category: categoryFocus,
      reason: "Review same-category alternatives before changing the build.",
    });
  } else {
    suggestedActions.push({
      type: "explain_current_build",
      reason: "Explain the current build without changing parts directly.",
    });
  }

  const extractedBits = [
    parsed.parsedNeeds.budget ? `a budget around $${parsed.parsedNeeds.budget.toLocaleString()}` : null,
    parsed.parsedNeeds.targetUseCase?.length
      ? parsed.parsedNeeds.targetUseCase.join(" + ").toLowerCase()
      : null,
    parsed.parsedNeeds.appearancePreference
      ? `${parsed.parsedNeeds.appearancePreference} styling`
      : null,
    parsed.parsedNeeds.cpuBrandPreference
      ? `${parsed.parsedNeeds.cpuBrandPreference.toUpperCase()} CPU preference`
      : null,
    parsed.parsedNeeds.gpuBrandPreference
      ? `${parsed.parsedNeeds.gpuBrandPreference.toUpperCase()} GPU preference`
      : null,
  ].filter(Boolean);

  const assistantMessage =
    extractedBits.length > 0
      ? `Got it: ${extractedBits.join(", ")}. I can refresh the rule-based build recommendation around ${cpu?.displayName ?? "the selected CPU"} and ${gpu?.displayName ?? "the selected GPU"}. Compatibility stays checked by deterministic rules.`
      : categoryFocus
        ? `Let's focus on the ${categoryFocus.toUpperCase()}. Open the Part Explorer to compare options before swapping anything.`
        : "I can help with budget, games, creator apps, style, or brand preferences. The current build stays safe because compatibility and pricing are still handled by local rules.";

  return {
    assistantMessage,
    extractedNeeds: parsed.parsedNeeds,
    suggestedActions,
    explanation:
      "Mock advisor fallback parsed the request locally and returned safe suggestions instead of directly changing the build.",
    provider: "mock",
  };
}

export const mockAiProvider: AiProvider = {
  name: "mock",
  isConfigured() {
    return true;
  },
  async getAdvisorResponse(request) {
    return createMockAdvisorResponse(request);
  },
};
