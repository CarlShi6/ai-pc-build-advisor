import { describe, expect, it } from "vitest";
import { getRecommendedBuildData } from "@/lib/build-advisor";
import {
  normalizeRecommendedBuildInput,
  validateBuild,
  validateSafeExternalUrl,
  ValidationError,
} from "@/lib/validation";

describe("normalizeRecommendedBuildInput", () => {
  it("trims, deduplicates, and preserves supported preferences", () => {
    expect(
      normalizeRecommendedBuildInput({
        budget: 1499.6,
        targetUseCase: [" 1440p gaming ", "1440p gaming", "video editing"],
        appearancePreference: "white",
        experienceLevel: "intermediate",
        cpuBrandPreference: "amd",
        gpuBrandPreference: "nvidia",
      }),
    ).toEqual({
      budget: 1500,
      targetUseCase: ["1440p gaming", "video editing"],
      appearancePreference: "white",
      experienceLevel: "intermediate",
      cpuBrandPreference: "amd",
      gpuBrandPreference: "nvidia",
    });
  });

  it.each([299, 20_001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an unsafe budget of %s",
    (budget) => {
      expect(() => normalizeRecommendedBuildInput({ budget })).toThrow(ValidationError);
    },
  );
});

describe("validateBuild", () => {
  it("accepts a generated recommendation", () => {
    const build = getRecommendedBuildData({ budget: 2_500 });

    expect(validateBuild(build)).toBe(build);
  });

  it("rejects a total that is inconsistent with selected parts", () => {
    const build = getRecommendedBuildData({ budget: 2_500 });

    expect(() => validateBuild({ ...build, totalPrice: build.totalPrice + 10 })).toThrow(
      "Build total does not match the selected parts.",
    );
  });
});

describe("validateSafeExternalUrl", () => {
  it("allows HTTP purchase links", () => {
    expect(validateSafeExternalUrl("https://example.com/part?id=1")).toBe(
      "https://example.com/part?id=1",
    );
  });

  it("blocks executable URL schemes", () => {
    expect(() => validateSafeExternalUrl("javascript:alert(1)")).toThrow(ValidationError);
  });
});
