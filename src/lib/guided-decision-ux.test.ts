import { getRecommendedBuildData } from "@/lib/build-advisor";
import { PRICE_HISTORY_DEMO_STARTER } from "@/lib/demo-starters";
import { parseCustomerNeeds } from "@/lib/needParser";
import { mockPriceObservationInputs } from "@/lib/pricing/mock-data";
import { describe, expect, it } from "vitest";

describe("guided decision demo readiness", () => {
  it("keeps a Demo Starter aligned to an exact part with deterministic price history", () => {
    const { parsedNeeds } = parseCustomerNeeds(PRICE_HISTORY_DEMO_STARTER);
    const build = getRecommendedBuildData(parsedNeeds);
    const supportedPartIds = new Set(mockPriceObservationInputs.map((item) => item.partId));

    expect(build.parts.map((part) => part.id)).toContain("cpu-i7-14700k");
    expect(supportedPartIds.has("cpu-i7-14700k")).toBe(true);
  });
});
