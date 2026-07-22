export const PRICE_HISTORY_RANGES = ["7d", "30d", "90d"] as const;

export type PriceHistoryRange = (typeof PRICE_HISTORY_RANGES)[number];
export type PriceCurrency = "USD";
export type PriceAvailability = "in_stock" | "out_of_stock" | "preorder" | "backorder" | "unknown";
export type PriceCondition = "new" | "refurbished" | "used";
export type PriceSourceType =
  | "mock"
  | "manual"
  | "retailer_feed"
  | "affiliate_api"
  | "future_collector";
export type PriceSourceConfidence = "low" | "medium" | "high";

export interface PriceVerificationMetadata {
  confidence: PriceSourceConfidence;
  verifiedAt?: string;
  note?: string;
}

export interface PriceObservationInput {
  id: string;
  partId: string;
  retailer: string;
  retailerSku?: string;
  sellerName?: string;
  listingUrl?: string;
  currency: string;
  itemPriceMinor: number;
  shippingPriceMinor?: number | null;
  availability: string;
  condition: string;
  sourceType: string;
  observedAt: string;
  verification?: PriceVerificationMetadata;
}

export interface PriceObservation {
  id: string;
  partId: string;
  retailerId: string;
  retailerName: string;
  retailerSku?: string;
  sellerName?: string;
  listingUrl?: string;
  currency: PriceCurrency;
  itemPriceMinor: number;
  shippingPriceMinor: number | null;
  effectivePreTaxPriceMinor: number | null;
  availability: PriceAvailability;
  condition: PriceCondition;
  sourceType: PriceSourceType;
  observedAt: string;
  verification?: PriceVerificationMetadata;
}

export interface CurrentPriceSelection {
  observationId: string;
  retailerId: string;
  retailerName: string;
  retailerSku?: string;
  sellerName?: string;
  listingUrl?: string;
  itemPriceMinor: number;
  shippingPriceMinor: number;
  effectivePreTaxPriceMinor: number;
  observedAt: string;
}

export interface PriceDataDisclosure {
  containsMockData: boolean;
  isLive: false;
  sourceTypes: PriceSourceType[];
  message: string;
}

export interface PriceHistoryResponse {
  partId: string;
  currency: PriceCurrency;
  range: PriceHistoryRange;
  observations: PriceObservation[];
  currentBest: CurrentPriceSelection | null;
  previousComparablePriceMinor: number | null;
  absolutePriceChangeMinor: number | null;
  percentagePriceChange: number | null;
  rangeLowMinor: number | null;
  rangeHighMinor: number | null;
  observationCount: number;
  lastObservationAt: string;
  disclosure: PriceDataDisclosure;
}

export type PriceApiErrorCode = "INVALID_RANGE" | "UNKNOWN_PART" | "NO_PRICE_DATA";

export interface PriceApiErrorResponse {
  error: {
    code: PriceApiErrorCode;
    message: string;
  };
}
