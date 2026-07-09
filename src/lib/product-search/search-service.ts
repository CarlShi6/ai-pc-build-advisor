import { localProductSearchProvider } from "@/lib/product-search/local-provider";
import { mockRetailerProductSearchProvider } from "@/lib/product-search/mock-retailer-provider";
import type { ProductSearchQuery, ProductSearchResponse, ProductSearchResult } from "@/lib/product-search/types";
import {
  calculateBuildConfidenceScore,
  calculateBuildTotal,
  deriveCompatibilityStatus,
  evaluateCompatibilityRules,
  getCompatibilityWarnings,
} from "@/lib/compatibility";
import type { Build } from "@/types/build";
import type { AffiliateMerchant } from "@/types/monetization";
import type { Part, PartAvailability } from "@/types/parts";

const disclaimer =
  "Retailer results are mock data in this preview. Prices and stock may change. External live search coming later.";

function toAvailability(status: ProductSearchResult["stockStatus"]): PartAvailability {
  return status;
}

function toMerchant(retailer: ProductSearchResult["retailer"]): AffiliateMerchant {
  if (retailer === "amazon" || retailer === "newegg" || retailer === "microcenter" || retailer === "bestbuy" || retailer === "bhphoto") {
    return retailer;
  }

  return "other";
}

export function productSearchResultToPart(result: ProductSearchResult): Part {
  const price = result.price ?? 0;
  const productUrl = result.productUrl;
  const affiliateUrl = result.affiliateUrl ?? productUrl;

  return {
    id: result.id,
    category: result.category,
    brand: result.brand,
    model: result.model,
    displayName: result.displayName,
    price,
    source: result.source === "local" ? "catalog" : result.source,
    retailer: result.retailer,
    purchaseUrl: productUrl,
    productUrl,
    searchUrl: productUrl,
    imageUrl: result.imageUrl,
    stockStatus: toAvailability(result.stockStatus),
    lastUpdated: result.lastUpdated,
    specSummary: result.specs
      ? Object.entries(result.specs)
          .slice(0, 3)
          .map(([, value]) => String(value))
          .join(", ")
      : undefined,
    affiliateLinks: [
      {
        merchant: toMerchant(result.retailer),
        url: affiliateUrl,
        price,
        inStock: result.stockStatus === "in_stock" || result.stockStatus === "low_stock",
        label: "View product",
      },
    ],
    availability: toAvailability(result.stockStatus),
    specs: result.specs ?? {},
    compatibilityTags: result.compatibilityTags ?? [result.source],
    recommendationReason:
      result.recommendationReason ??
      (result.source === "mock_retailer"
        ? "Mock retailer preview. Verify current price, stock, and exact model before buying."
        : "Local catalog result."),
  };
}

function createCandidateBuild(build: Build, replacement: Part): Build {
  const parts = build.parts.map((part) =>
    part.category === replacement.category ? replacement : part,
  );
  const candidate: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityStatus: "pass",
    compatibilityChecks: [],
    compatibilityWarnings: [],
    confidenceScore: {
      score: 0,
      label: "Low",
      summary: "Compatibility rules have not run yet.",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
    },
  };
  const compatibilityChecks = evaluateCompatibilityRules(candidate);
  const compatibilityWarnings = getCompatibilityWarnings(compatibilityChecks);

  return {
    ...candidate,
    compatibilityChecks,
    compatibilityWarnings,
    compatibilityStatus: deriveCompatibilityStatus(compatibilityChecks),
    confidenceScore: calculateBuildConfidenceScore(compatibilityChecks),
  };
}

function filterCompatible(results: ProductSearchResult[], currentBuild?: Build | null) {
  if (!currentBuild) {
    return results;
  }

  return results.filter((result) => {
    const candidate = createCandidateBuild(currentBuild, productSearchResultToPart(result));
    return candidate.compatibilityStatus !== "fail";
  });
}

export async function searchProducts(query: ProductSearchQuery): Promise<ProductSearchResponse> {
  const safeQuery: ProductSearchQuery = {
    ...query,
    query: query.query?.trim() ?? "",
    includeExternal: Boolean(query.includeExternal),
    onlyCompatible: Boolean(query.onlyCompatible),
    currentBuild: query.currentBuild ?? null,
  };

  const [localResults, mockRetailerResults] = await Promise.all([
    localProductSearchProvider.search(safeQuery),
    safeQuery.includeExternal ? mockRetailerProductSearchProvider.search(safeQuery) : Promise.resolve([]),
  ]);

  return {
    localResults: safeQuery.onlyCompatible
      ? filterCompatible(localResults, safeQuery.currentBuild)
      : localResults,
    mockRetailerResults: safeQuery.onlyCompatible
      ? filterCompatible(mockRetailerResults, safeQuery.currentBuild)
      : mockRetailerResults,
    externalSearchAvailable: false,
    disclaimer,
  };
}
