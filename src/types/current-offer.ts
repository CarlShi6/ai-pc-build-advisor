import type { PartAvailability } from "@/types/parts";

export type ProviderErrorCode =
  | "UNKNOWN_PART"
  | "PROVIDER_DISABLED"
  | "UNMAPPED_PART"
  | "PRODUCT_NOT_FOUND"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INVALID_PAYLOAD"
  | "UNSUPPORTED_CURRENCY"
  | "MISSING_PRICE";

export type ProviderDisclosure = {
  providerId: "best_buy";
  retailerName: "Best Buy";
  isLive: boolean;
  attribution: string;
  retentionNotice: string;
};

export type CurrentRetailOffer = {
  partId: string;
  providerId: "best_buy";
  retailerName: "Best Buy";
  retailerSku: string;
  currency: "USD";
  itemPriceMinor: number;
  shippingPriceMinor: number | null;
  effectivePriceMinor: number | null;
  availability: PartAvailability;
  condition: "new" | "used" | "refurbished" | "unknown";
  productUrl: string;
  providerProductName: string | null;
  fetchedAt: string;
  expiresAt: string;
  isLive: true;
  attribution: string;
  freshnessMetadata?: { cacheTtlSeconds: number };
};

export type RetailProviderResult = {
  partId: string;
  providerId: "best_buy";
  status: "success" | "disabled" | "unavailable" | "error";
  offer: CurrentRetailOffer | null;
  disclosure: ProviderDisclosure;
  fetchedAt: string | null;
  expiresAt: string | null;
  cached: boolean;
  reason: ProviderErrorCode | null;
};

export interface RetailPriceProvider {
  getCurrentOffer(partId: string): Promise<RetailProviderResult>;
}

export type CurrentOfferApiResponse = RetailProviderResult;
