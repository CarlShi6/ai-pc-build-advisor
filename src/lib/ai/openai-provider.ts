import { getServerConfig } from "@/lib/config.server";
import {
  normalizeAdvisorActions,
  type AdvisorProviderResponse,
  type AdvisorRequest,
  type AiProvider,
} from "@/lib/ai/types";

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as Partial<AdvisorProviderResponse>;
  } catch {
    return null;
  }
}

function buildPrompt(request: AdvisorRequest) {
  const buildParts = request.currentBuild?.parts.map((part) => ({
    category: part.category,
    displayName: part.displayName,
    price: part.price,
    specs: part.specs,
  }));

  return [
    "You are a PC build advisor for individual consumers.",
    "Return only JSON with assistantMessage, extractedNeeds, suggestedActions, warnings, and explanation.",
    "Never directly replace parts. Only suggest safe actions.",
    "Suggested actions must use only these types: update_budget, update_use_case, update_appearance, update_brand_preference, update_experience_level, add_owned_part, open_part_explorer, explain_current_build, ask_clarifying_question.",
    "Use add_owned_part when the user says they already own or want to reuse hardware.",
    "Use open_part_explorer when the user asks whether to upgrade CPU, GPU, or another category.",
    "Compatibility, pricing, replacement, and purchase references are handled by rule-based app code.",
    `Plan: ${request.plan}`,
    `User message: ${request.message}`,
    `Collected needs: ${JSON.stringify(request.collectedNeeds ?? {})}`,
    `Current build summary: ${JSON.stringify({
      name: request.currentBuild?.name,
      totalPrice: request.currentBuild?.totalPrice,
      compatibilityStatus: request.currentBuild?.compatibilityStatus,
      parts: buildParts,
    })}`,
  ].join("\n");
}

export const openAiProvider: AiProvider = {
  name: "openai",
  isConfigured() {
    const config = getServerConfig();
    return Boolean(config.openAiApiKey || config.aiProviderApiKey);
  },
  async getAdvisorResponse(request) {
    const config = getServerConfig();
    const apiKey = config.openAiApiKey || config.aiProviderApiKey;

    if (!apiKey) {
      throw new Error("AI provider is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.aiProviderModel,
        input: buildPrompt(request),
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error("AI provider request failed.");
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string }>;
      }>;
    };
    const text =
      payload.output_text ??
      payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ??
      "";
    const parsed = extractJsonObject(text);

    if (!parsed?.assistantMessage) {
      throw new Error("AI provider returned an unsupported response shape.");
    }

    return {
      assistantMessage: parsed.assistantMessage,
      extractedNeeds: parsed.extractedNeeds,
      suggestedActions: normalizeAdvisorActions(parsed.suggestedActions),
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((warning): warning is string => typeof warning === "string")
        : [],
      explanation: parsed.explanation,
      fallbackUsed: false,
      provider: "openai",
    };
  },
};
