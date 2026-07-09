import { seedParts } from "@/data/seedParts";
import type { ProductSearchProvider, ProductSearchQuery, ProductSearchResult } from "@/lib/product-search/types";
import type { Part } from "@/types/parts";

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getHaystack(part: Part) {
  return [
    part.brand,
    part.model,
    part.displayName,
    part.retailer,
    ...part.compatibilityTags,
    ...Object.entries(part.specs).flatMap(([key, value]) => [key, String(value)]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scorePart(part: Part, query: string) {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return 0.76;
  }

  const haystack = getHaystack(part);
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  const nameMatch = tokens.some((token) => part.displayName.toLowerCase().includes(token));
  const brandMatch = tokens.some((token) => part.brand.toLowerCase().includes(token));

  if (matches === 0) {
    return 0;
  }

  return Math.min(0.98, 0.5 + matches / tokens.length * 0.32 + (nameMatch ? 0.08 : 0) + (brandMatch ? 0.06 : 0));
}

function partToResult(part: Part, confidence: number): ProductSearchResult {
  const affiliateUrl = part.affiliateLinks?.[0]?.url;

  return {
    id: part.id,
    category: part.category,
    brand: part.brand,
    model: part.model,
    displayName: part.displayName,
    imageUrl: part.imageUrl,
    retailer: "newegg",
    price: part.price,
    priceStatus: "known_mock",
    stockStatus: part.stockStatus ?? part.availability ?? "unknown",
    productUrl: part.purchaseUrl ?? part.productUrl ?? part.searchUrl ?? affiliateUrl ?? "#",
    affiliateUrl,
    lastUpdated: part.lastUpdated,
    source: "local",
    confidence,
    specs: part.specs,
    compatibilityTags: part.compatibilityTags,
    recommendationReason: part.recommendationReason,
  };
}

export const localProductSearchProvider: ProductSearchProvider = {
  id: "local",
  label: "Local seed catalog",
  async search(query: ProductSearchQuery) {
    return seedParts
      .filter((part) => !query.category || part.category === query.category)
      .map((part) => ({ part, confidence: scorePart(part, query.query) }))
      .filter(({ confidence }) => confidence > 0)
      .sort((left, right) => right.confidence - left.confidence || left.part.price - right.part.price)
      .slice(0, 12)
      .map(({ part, confidence }) => partToResult(part, confidence));
  },
};
