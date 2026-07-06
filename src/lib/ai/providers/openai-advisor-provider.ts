import OpenAI from "openai";
import { createCandidateBuild } from "@/lib/build-advisor";
import { getServerConfig } from "@/lib/config.server";
import {
  buildAdvisorSystemPrompt,
  buildResponseQualityContext,
} from "@/lib/ai/response-quality";
import {
  normalizeAdvisorActions,
  type AdvisorProviderResponse,
  type AdvisorRequest,
  type AiProvider,
} from "@/lib/ai/types";
import type { Part } from "@/types/parts";

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

function summarizePart(part: Part) {
  return {
    id: part.id,
    category: part.category,
    displayName: part.displayName,
    price: part.price,
    owned: part.owned,
    availability: part.availability,
    recommendationReason: part.recommendationReason,
    specs: part.specs,
  };
}

function getCandidateCompareDetails(request: AdvisorRequest) {
  if (!request.activeCompare || !request.currentBuild) {
    return [];
  }

  const { currentPart, candidateParts } = request.activeCompare;

  return candidateParts.slice(0, 6).map((candidate) => {
    const candidateBuild = createCandidateBuild(request.currentBuild!, candidate);

    return {
      part: summarizePart(candidate),
      priceDifference: candidate.price - currentPart.price,
      totalBuildPrice: candidateBuild.totalPrice,
      compatibilityImpact: {
        status: candidateBuild.compatibilityStatus,
        warnings: candidateBuild.compatibilityWarnings.map((warning) => warning.message),
        confidenceScore: candidateBuild.confidenceScore.score,
      },
    };
  });
}

function buildAdvisorContext(request: AdvisorRequest) {
  const buildParts = request.currentBuild?.parts.map(summarizePart);
  const activeCompare = request.activeCompare
    ? {
        category: request.activeCompare.category,
        budget: request.activeCompare.budget,
        buildTotal: request.activeCompare.buildTotal,
        currentPart: summarizePart(request.activeCompare.currentPart),
        candidateParts: getCandidateCompareDetails(request),
      }
    : null;

  return {
    responseQuality: buildResponseQualityContext(request),
    userMessage: request.message,
    conversationHistory: request.conversationHistory ?? [],
    collectedNeeds: request.collectedNeeds ?? {},
    plan: request.plan,
    usageStatus: {
      canAskAiQuestion: request.usageStatus.canAskAiQuestion,
      remainingAiQuestions: request.usageStatus.remainingAiQuestions,
      plan: request.usageStatus.plan,
    },
    currentBuild: request.currentBuild
      ? {
          name: request.currentBuild.name,
          budget: request.currentBuild.budget,
          targetUseCase: request.currentBuild.targetUseCase,
          totalPrice: request.currentBuild.totalPrice,
          compatibilityStatus: request.currentBuild.compatibilityStatus,
          compatibilityWarnings: request.currentBuild.compatibilityWarnings.map(
            (warning) => warning.message,
          ),
          confidenceScore: request.currentBuild.confidenceScore,
          parts: buildParts,
        }
      : null,
    activeCompareContext: activeCompare,
  };
}

function getResponseText(response: Awaited<ReturnType<OpenAI["responses"]["create"]>>) {
  if ("output_text" in response && typeof response.output_text === "string") {
    return response.output_text;
  }

  return response.output
    .flatMap((item) => ("content" in item ? item.content : []))
    .map((content) => ("text" in content ? content.text : ""))
    .filter(Boolean)
    .join("\n");
}

export const openAiAdvisorProvider: AiProvider = {
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

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: config.aiProviderModel,
      input: [
        {
          role: "system",
          content: buildAdvisorSystemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(buildAdvisorContext(request)),
        },
      ],
      temperature: 0.2,
    });
    const parsed = extractJsonObject(getResponseText(response));

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
