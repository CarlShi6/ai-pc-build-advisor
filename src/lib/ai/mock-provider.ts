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

function formatBudget(value: number | undefined) {
  return typeof value === "number" ? `$${value.toLocaleString()}` : "your current budget";
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

  const assistantMessage = activeCompare
    ? [
        "Recommendation: Compare the top alternatives before replacing the current part.",
        `Fit: You're reviewing ${activeCompare.currentPart.displayName} against ${activeCompare.candidateParts
          .slice(0, 3)
          .map((part) => part.displayName)
          .join(", ") || "same-category options"}.`,
        `Budget impact: Use ${formatBudget(activeCompare.budget)} and the app-estimated ${formatBudget(activeCompare.buildTotal)} build total as the guardrails.`,
        "Compatibility impact: Let the local compatibility checks confirm fit before you swap anything.",
        "Performance tradeoff: Favor the part that improves your main workload without forcing PSU, case, or cooling compromises.",
        "Next action: Open the Part Explorer action or pick a compare row after checking warnings.",
      ].join("\n")
    : extractedBits.length > 0
      ? [
          `Direct answer: Got it: ${extractedBits.join(", ")}.`,
          `Reasoning: That helps tune the CPU, GPU, style, and budget balance around ${cpu?.displayName ?? "the selected CPU"} and ${gpu?.displayName ?? "the selected GPU"}.`,
          "Practical recommendation: Refresh the rule-based recommendation so compatibility stays checked by local rules.",
          "Next step: Apply the suggested update below, then compare any part that still feels uncertain.",
        ].join("\n")
      : categoryFocus
        ? [
            `Direct answer: Let's focus on the ${categoryFocus.toUpperCase()}.`,
            "Reasoning: Same-category comparisons are safer than swapping parts blindly.",
            "Practical recommendation: Review alternatives in Part Explorer before changing the build.",
            "Next step: Open the suggested explorer action and check compatibility warnings.",
          ].join("\n")
        : [
            "Direct answer: I can help tune budget, games, creator apps, style, or brand preferences.",
            "Reasoning: Those inputs decide the CPU/GPU balance and how much room to leave for compatibility-safe supporting parts.",
            "Practical recommendation: Start with budget plus the main apps or games you care about.",
            "Next step: Answer the clarifying question or ask me to explain the current build.",
          ].join("\n");

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
