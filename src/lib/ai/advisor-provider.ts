import { getServerConfig } from "@/lib/config.server";
import { mockAdvisorProvider } from "@/lib/ai/providers/mock-advisor-provider";
import { openAiAdvisorProvider } from "@/lib/ai/providers/openai-advisor-provider";
import type { AdvisorRequest, AdvisorProviderResponse, AiProvider } from "@/lib/ai/providers/types";

function getRequestedProviderName() {
  const configuredProvider = getServerConfig().aiProvider?.trim().toLowerCase();

  if (!configuredProvider || configuredProvider === "mock") {
    return "mock";
  }

  return configuredProvider;
}

export function getAdvisorProvider(): AiProvider {
  const providerName = getRequestedProviderName();

  if (providerName !== "openai") {
    if (providerName !== "mock") {
      console.warn(
        `[ai-advisor] Unsupported AI_PROVIDER "${providerName}" configured. Falling back to mock provider.`,
      );
    }

    return mockAdvisorProvider;
  }

  if (!openAiAdvisorProvider.isConfigured()) {
    console.warn(
      "[ai-advisor] AI_PROVIDER=openai but no OpenAI API key was configured. Falling back to mock provider.",
    );
    return mockAdvisorProvider;
  }

  return openAiAdvisorProvider;
}

export async function getAdvisorResponse(
  request: AdvisorRequest,
): Promise<AdvisorProviderResponse> {
  const provider = getAdvisorProvider();

  if (provider.name === "mock") {
    return {
      ...(await mockAdvisorProvider.getAdvisorResponse(request)),
      fallbackUsed: true,
    };
  }

  try {
    return {
      ...(await provider.getAdvisorResponse(request)),
      fallbackUsed: false,
    };
  } catch (error) {
    console.error("[ai-advisor] OpenAI provider failed. Falling back to mock provider.", {
      message: error instanceof Error ? error.message : "Unknown provider error",
    });

    return {
      ...(await mockAdvisorProvider.getAdvisorResponse(request)),
      fallbackUsed: true,
      warnings: [
        "The configured AI provider was unavailable, so the mock advisor handled this message.",
      ],
    };
  }
}
