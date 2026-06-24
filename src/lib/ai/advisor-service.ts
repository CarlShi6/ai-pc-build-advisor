import { createMockAdvisorResponse } from "@/lib/ai/mock-provider";
import { openAiProvider } from "@/lib/ai/openai-provider";
import type { AdvisorRequest, AdvisorProviderResponse } from "@/lib/ai/types";

export async function getAdvisorResponse(request: AdvisorRequest): Promise<AdvisorProviderResponse> {
  if (!openAiProvider.isConfigured()) {
    return {
      ...createMockAdvisorResponse(request),
      fallbackUsed: true,
    };
  }

  try {
    return {
      ...(await openAiProvider.getAdvisorResponse(request)),
      fallbackUsed: false,
    };
  } catch {
    return {
      ...createMockAdvisorResponse(request),
      fallbackUsed: true,
      warnings: ["The configured AI provider was unavailable, so the mock advisor handled this message."],
    };
  }
}
