import type { Build } from "@/types/build";
import type { PartCategory } from "@/types/parts";

export type RetailerSource =
  | "amazon"
  | "newegg"
  | "microcenter"
  | "bestbuy"
  | "bhphoto"
  | "partner_mock"
  | "other";

export type ProductPriceStatus = "known_mock" | "estimated" | "unknown";

export type ProductStockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export interface ProductSearchQuery {
  query: string;
  category?: PartCategory;
  onlyCompatible?: boolean;
  includeExternal?: boolean;
  currentBuild?: Build | null;
}

export interface ProductSearchResult {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  imageUrl?: string;
  retailer: RetailerSource;
  price: number | null;
  priceStatus: ProductPriceStatus;
  stockStatus: ProductStockStatus;
  productUrl: string;
  affiliateUrl?: string;
  lastUpdated?: string;
  source: "local" | "mock_retailer" | "external_placeholder";
  confidence: number;
  specs?: Record<string, string | number | boolean>;
  compatibilityTags?: string[];
  recommendationReason?: string;
}

export interface ProductSearchProvider {
  readonly id: string;
  readonly label: string;
  search(query: ProductSearchQuery): Promise<ProductSearchResult[]>;
}

export interface ProductSearchResponse {
  localResults: ProductSearchResult[];
  mockRetailerResults: ProductSearchResult[];
  externalSearchAvailable: false;
  disclaimer: string;
}
