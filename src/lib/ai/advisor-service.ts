import { createMockAdvisorResponse } from "@/lib/ai/mock-provider";
import { openAiProvider } from "@/lib/ai/openai-provider";
import type { AdvisorRequest, AdvisorProviderResponse } from "@/lib/ai/types";

export async function getAdvisorResponse(request: AdvisorRequest): Promise<AdvisorProviderResponse> {
  if (!openAiProvider.isConfigured()) {
    return createMockAdvisorResponse(request);
  }

  try {
    return await openAiProvider.getAdvisorResponse(request);
  } catch {
    return createMockAdvisorResponse(request);
  }
}
