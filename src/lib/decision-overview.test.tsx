import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildHealthOverview } from "@/components/build-health-overview";
import { BudgetBreakdown } from "@/components/budget-breakdown";
import { getRecommendedBuildData } from "@/lib/build-advisor";

const noop = () => undefined;

describe("decision overview", () => {
  it("keeps budget, compatibility, purchase readiness and provenance visible", () => {
    const markup = renderToStaticMarkup(
      <BuildHealthOverview
        budget={2500}
        total={2250}
        compatibilityStatus="warning"
        compatibilityReviewCount={1}
        compatibilityExpanded={false}
        unresolvedPurchaseCount={3}
        componentCount={8}
        onBudgetAction={noop}
        onCompatibilityAction={noop}
        onShoppingAction={noop}
      />,
    );

    expect(markup).toContain("$250 left");
    expect(markup).toContain("1 to review");
    expect(markup).toContain("3 unresolved");
    expect(markup).toContain("Seed prices · calculated checks");
  });

  it("progressively discloses smaller cost categories without removing compare actions", () => {
    const build = getRecommendedBuildData({ budget: 2500 });
    const markup = renderToStaticMarkup(<BudgetBreakdown build={build} onSelect={noop} />);

    expect(markup).toContain("Cost map");
    expect(markup).toContain("smaller categories");
    expect(markup.match(/aria-label="Compare /g)?.length).toBe(
      build.parts.filter((part) => !part.owned && part.price > 0).length,
    );
  });
});
