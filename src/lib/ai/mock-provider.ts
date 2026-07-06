import { parseCustomerNeeds } from "@/lib/needParser";
import { categoryLabels } from "@/data/seedParts";
import type {
  AdvisorProviderResponse,
  AdvisorRequest,
  AdvisorSuggestedAction,
  AiProvider,
} from "@/lib/ai/types";
import type { PartCategory } from "@/types/parts";

function getCategoryFocus(message: string): PartCategory | null {
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

function getOwnedPartHint(message: string) {
  if (!/\balready have\b|\bi have\b|\bi own\b|\bowned\b|\breuse\b|\bkeep my\b/i.test(message)) {
    return null;
  }

  const category = getCategoryFocus(message);

  return {
    category,
    partHint: category ? categoryLabels[category] : "owned part",
  };
}

function isUpgradeQuestion(message: string) {
  return /\bupgrade\b|\bupgrade\b.*\b(cpu|gpu)\b|\b(cpu|gpu)\b.*\bupgrade\b|\bwhich.*\b(cpu|gpu)\b/i.test(
    message,
  );
}

export function createMockAdvisorResponse(request: AdvisorRequest): AdvisorProviderResponse {
  const parsed = parseCustomerNeeds(request.message);
  const build = request.currentBuild;
  const cpu = build?.parts.find((part) => part.category === "cpu");
  const gpu = build?.parts.find((part) => part.category === "gpu");
  const activeCompare = request.activeCompare;
  const categoryFocus = getCategoryFocus(request.message);
  const ownedPartHint = getOwnedPartHint(request.message);
  const suggestedActions: AdvisorSuggestedAction[] = [];

  if (parsed.parsedNeeds.budget) {
    suggestedActions.push({
      type: "update_budget",
      label: `Update budget to $${parsed.parsedNeeds.budget.toLocaleString()}`,
      budget: parsed.parsedNeeds.budget,
      reason: "Use this budget to refresh the safe rule-based recommendation.",
    });
  }

  if (parsed.parsedNeeds.targetUseCase?.length) {
    suggestedActions.push({
      type: "update_use_case",
      label: `Use ${parsed.parsedNeeds.targetUseCase.join(" + ")}`,
      targetUseCase: parsed.parsedNeeds.targetUseCase,
      reason: "Tune the mock recommendation toward the workload you described.",
    });
  }

  if (parsed.parsedNeeds.appearancePreference) {
    suggestedActions.push({
      type: "update_appearance",
      label:
        parsed.parsedNeeds.appearancePreference === "rgb"
          ? "Use RGB style"
          : `Use ${parsed.parsedNeeds.appearancePreference} style`,
      appearancePreference: parsed.parsedNeeds.appearancePreference,
      reason: "Reflect the look you want in the build needs.",
    });
  }

  if (parsed.parsedNeeds.cpuBrandPreference || parsed.parsedNeeds.gpuBrandPreference) {
    suggestedActions.push({
      type: "update_brand_preference",
      label: `Use ${[
        parsed.parsedNeeds.cpuBrandPreference?.toUpperCase(),
        parsed.parsedNeeds.gpuBrandPreference?.toUpperCase(),
      ]
        .filter(Boolean)
        .join(" / ")} preference`,
      cpuBrandPreference: parsed.parsedNeeds.cpuBrandPreference,
      gpuBrandPreference: parsed.parsedNeeds.gpuBrandPreference,
      reason: "Keep the recommendation aligned with your preferred chip brand.",
    });
  }

  if (parsed.parsedNeeds.experienceLevel) {
    suggestedActions.push({
      type: "update_experience_level",
      label: `Set ${parsed.parsedNeeds.experienceLevel} experience`,
      experienceLevel: parsed.parsedNeeds.experienceLevel,
      reason: "Adjust guidance and tradeoffs for your comfort level.",
    });
  }

  if (ownedPartHint) {
    suggestedActions.push({
      type: "add_owned_part",
      label: ownedPartHint.category
        ? `Add owned ${categoryLabels[ownedPartHint.category]}`
        : "Add owned part",
      category: ownedPartHint.category ?? undefined,
      partHint: ownedPartHint.partHint,
      reason: "Owned parts count as $0 while still going through compatibility checks.",
    });
  }

  if (categoryFocus || isUpgradeQuestion(request.message)) {
    const categories: PartCategory[] =
      isUpgradeQuestion(request.message) &&
      /\bcpu\b/i.test(request.message) &&
      /\bgpu\b/i.test(request.message)
        ? ["gpu", "cpu"]
        : [categoryFocus ?? "gpu"];

    categories.forEach((category) => {
      suggestedActions.push({
        type: "open_part_explorer",
        label: `Open ${categoryLabels[category]} Explorer`,
        category,
        reason: "Review same-category alternatives before changing the build.",
      });
    });
  }

  if (suggestedActions.length === 0) {
    suggestedActions.push({
      type: "ask_clarifying_question",
      label: "Ask what matters most",
      question: "What budget, main games or apps, and preferred look should I tune for?",
      reason: "A few details make the recommendation more useful.",
    });
    suggestedActions.push({
      type: "explain_current_build",
      label: "Explain current build",
      reason: "Explain the current build without changing parts directly.",
    });
  }

  const extractedBits = [
    parsed.parsedNeeds.budget
      ? `a budget around $${parsed.parsedNeeds.budget.toLocaleString()}`
      : null,
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
      : activeCompare
        ? `You're comparing ${activeCompare.currentPart.displayName} against ${activeCompare.candidateParts
            .slice(0, 3)
            .map((part) => part.displayName)
            .join(
              ", ",
            )}. I can talk through the tradeoffs while the inline compare panel stays open, using your ${activeCompare.budget ? `$${activeCompare.budget.toLocaleString()} budget` : "current budget"} and ${activeCompare.buildTotal ? `$${activeCompare.buildTotal.toLocaleString()} build total` : "current build total"} as context.`
        : categoryFocus
          ? `Let's focus on the ${categoryFocus.toUpperCase()}. Open the Part Explorer to compare options before swapping anything.`
          : "I can help with budget, games, creator apps, style, or brand preferences. The current build stays safe because compatibility and pricing are still handled by local rules.";

  return {
    assistantMessage,
    extractedNeeds: parsed.parsedNeeds,
    suggestedActions,
    warnings: [],
    fallbackUsed: true,
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
