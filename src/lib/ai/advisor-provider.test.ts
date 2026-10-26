import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdvisorProvider } from "@/lib/ai/advisor-provider";

describe("advisor provider selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays on mock when only image recognition is switched to OpenAI", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    vi.stubEnv("ADVISOR_AI_PROVIDER", "");
    expect(getAdvisorProvider().name).toBe("mock");
  });

  it("uses OpenAI only when ADVISOR_AI_PROVIDER asks for it and a key exists", () => {
    vi.stubEnv("ADVISOR_AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    expect(getAdvisorProvider().name).toBe("openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getAdvisorProvider().name).toBe("mock");
    warn.mockRestore();
  });
});
