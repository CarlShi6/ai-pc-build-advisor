import { describe, expect, it } from "vitest";
import { normalizeAdvisorMessage } from "@/lib/ai/types";

describe("normalizeAdvisorMessage", () => {
  it("preserves text responses", () => {
    expect(normalizeAdvisorMessage("  Direct answer: Keep the current PSU.  ")).toBe(
      "Direct answer: Keep the current PSU.",
    );
  });

  it("converts structured provider sections into render-safe text", () => {
    expect(
      normalizeAdvisorMessage({
        "Next action": "Keep the current unit.",
        Recommendation: "No upgrade is needed.",
        "Compatibility impact": "The local rules pass.",
      }),
    ).toBe(
      "Recommendation: No upgrade is needed.\nCompatibility impact: The local rules pass.\nNext action: Keep the current unit.",
    );
  });

  it("rejects unsupported scalar values", () => {
    expect(normalizeAdvisorMessage(42)).toBe("");
  });
});
