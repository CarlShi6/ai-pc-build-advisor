import { createMockAdvisorResponse } from "@/lib/ai/mock-provider";
import type { AiProvider } from "@/lib/ai/providers/types";

export const mockAdvisorProvider: AiProvider = {
  name: "mock",
  isConfigured() {
    return true;
  },
  async getAdvisorResponse(request) {
    return createMockAdvisorResponse(request);
  },
};
