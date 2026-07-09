import type { AffiliateLink } from "@/types/monetization";

export type PartCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "ssd"
  | "psu"
  | "case"
  | "cooler"
  | "os"
  | "fan"
  | "accessory";

export type PartAvailability = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export interface Part {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  price: number;
  source?: "catalog" | "user_owned" | "manual" | "mock_retailer" | "external_placeholder";
  owned?: boolean;
  userProvided?: boolean;
  retailer?: string;
  purchaseUrl?: string;
  productUrl?: string;
  searchUrl?: string;
  imageUrl?: string;
  stockStatus?: PartAvailability;
  lastUpdated?: string;
  partNumber?: string;
  sku?: string;
  specSummary?: string;
  color?: string;
  affiliateLinks?: AffiliateLink[];
  availability?: PartAvailability;
  specs: Record<string, string | number | boolean>;
  compatibilityTags: string[];
  recommendationReason?: string;
  pros?: string[];
  cons?: string[];
  valueScore?: number;
  valueRating?: number;
  performanceScore?: number;
}
