import { seedParts } from "@/data/seedParts";
import type {
  PriceAvailability,
  PriceCondition,
  PriceCurrency,
  PriceHistoryRange,
  PriceObservation,
  PriceSourceConfidence,
  PriceSourceType,
  PriceVerificationMetadata,
} from "@/types/pricing";

const AVAILABILITY_VALUES = new Set<PriceAvailability>([
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
  "unknown",
]);
const CONDITION_VALUES = new Set<PriceCondition>(["new", "refurbished", "used"]);
const SOURCE_TYPE_VALUES = new Set<PriceSourceType>([
  "mock",
  "manual",
  "retailer_feed",
  "affiliate_api",
  "future_collector",
]);
const CONFIDENCE_VALUES = new Set<PriceSourceConfidence>(["low", "medium", "high"]);
const RANGE_VALUES = new Set<PriceHistoryRange>(["7d", "30d", "90d"]);
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const RETAILER_IDENTITIES: Record<string, { id: string; name: string }> = {
  amazon: { id: "amazon", name: "Amazon" },
  "best buy": { id: "best-buy", name: "Best Buy" },
  bestbuy: { id: "best-buy", name: "Best Buy" },
  "micro center": { id: "micro-center", name: "Micro Center" },
  microcenter: { id: "micro-center", name: "Micro Center" },
  newegg: { id: "newegg", name: "Newegg" },
};

export class PriceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, maxLength = 300) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new PriceValidationError(`${field} is required and must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown, field: string, maxLength = 300) {
  if (value === undefined) {
    return undefined;
  }

  return requireString(value, field, maxLength);
}

function requireMinorUnits(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new PriceValidationError(`${field} must be a non-negative integer in minor units.`);
  }

  return Number(value);
}

function normalizeTimestamp(value: unknown, field: string, now: Date) {
  const raw = requireString(value, field);
  const timestamp = new Date(raw);

  if (!Number.isFinite(timestamp.getTime())) {
    throw new PriceValidationError(`${field} must be a valid timestamp.`);
  }

  if (timestamp.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
    throw new PriceValidationError(`${field} is unreasonably far in the future.`);
  }

  return timestamp.toISOString();
}

function normalizeListingUrl(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const raw = requireString(value, "Listing URL", 2_000);
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new PriceValidationError("Listing URL must be a valid HTTP or HTTPS URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new PriceValidationError("Listing URL must be a valid HTTP or HTTPS URL.");
  }

  return url.toString();
}

function normalizeRetailer(value: unknown) {
  const name = requireString(value, "Retailer", 100).replace(/\s+/g, " ");
  const lookupKey = name.toLowerCase();
  const known = RETAILER_IDENTITIES[lookupKey];

  if (known) {
    return known;
  }

  const id = lookupKey.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!id) {
    throw new PriceValidationError("Retailer must contain a usable identity.");
  }

  return { id, name };
}

function normalizeVerification(value: unknown, now: Date): PriceVerificationMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || !CONFIDENCE_VALUES.has(value.confidence as PriceSourceConfidence)) {
    throw new PriceValidationError("Verification confidence is invalid.");
  }

  return {
    confidence: value.confidence as PriceSourceConfidence,
    verifiedAt:
      value.verifiedAt === undefined
        ? undefined
        : normalizeTimestamp(value.verifiedAt, "Verification timestamp", now),
    note: optionalString(value.note, "Verification note", 500),
  };
}

export function isCanonicalPartId(partId: string) {
  return seedParts.some((part) => part.id === partId);
}

export function normalizePriceHistoryRange(value: unknown): PriceHistoryRange {
  if (typeof value !== "string" || !RANGE_VALUES.has(value as PriceHistoryRange)) {
    throw new PriceValidationError("Price history range must be one of 7d, 30d, or 90d.");
  }

  return value as PriceHistoryRange;
}

export function normalizePriceObservation(
  value: unknown,
  options: { now?: Date; hasPart?: (partId: string) => boolean } = {},
): PriceObservation {
  if (!isRecord(value)) {
    throw new PriceValidationError("Price observation must be an object.");
  }

  const now = options.now ?? new Date();
  const partId = requireString(value.partId, "Canonical part ID");
  const hasPart = options.hasPart ?? isCanonicalPartId;

  if (!hasPart(partId)) {
    throw new PriceValidationError(`Unknown canonical part ID: ${partId}.`);
  }

  const currency = requireString(value.currency, "Currency", 3).toUpperCase();
  if (currency !== "USD") {
    throw new PriceValidationError(`Unsupported currency: ${currency}.`);
  }

  if (!AVAILABILITY_VALUES.has(value.availability as PriceAvailability)) {
    throw new PriceValidationError("Availability value is invalid.");
  }

  if (!CONDITION_VALUES.has(value.condition as PriceCondition)) {
    throw new PriceValidationError("Condition value is invalid.");
  }

  if (!SOURCE_TYPE_VALUES.has(value.sourceType as PriceSourceType)) {
    throw new PriceValidationError("Price source type is invalid.");
  }

  const retailer = normalizeRetailer(value.retailer);
  const itemPriceMinor = requireMinorUnits(value.itemPriceMinor, "Item price");
  const shippingPriceMinor =
    value.shippingPriceMinor === undefined || value.shippingPriceMinor === null
      ? null
      : requireMinorUnits(value.shippingPriceMinor, "Shipping price");

  return {
    id: requireString(value.id, "Observation ID"),
    partId,
    retailerId: retailer.id,
    retailerName: retailer.name,
    retailerSku: optionalString(value.retailerSku, "Retailer SKU"),
    sellerName: optionalString(value.sellerName, "Seller name", 100),
    listingUrl: normalizeListingUrl(value.listingUrl),
    currency: currency as PriceCurrency,
    itemPriceMinor,
    shippingPriceMinor,
    effectivePreTaxPriceMinor:
      shippingPriceMinor === null ? null : itemPriceMinor + shippingPriceMinor,
    availability: value.availability as PriceAvailability,
    condition: value.condition as PriceCondition,
    sourceType: value.sourceType as PriceSourceType,
    observedAt: normalizeTimestamp(value.observedAt, "Observation timestamp", now),
    verification: normalizeVerification(value.verification, now),
  };
}
