import { VERIFIED_BEST_BUY_SKUS, type BestBuySkuMapping } from "@/lib/pricing/best-buy-mappings";
import type {
  CurrentRetailOffer,
  ProviderDisclosure,
  ProviderErrorCode,
  RetailPriceProvider,
  RetailProviderResult,
} from "@/types/current-offer";
import type { PartAvailability } from "@/types/parts";

export const BEST_BUY_CACHE_TTL_MS = 20 * 60 * 1000;
export const BEST_BUY_MAX_RETENTION_MS = 72 * 60 * 60 * 1000;
export const BEST_BUY_TIMEOUT_MS = 5_000;

export const BEST_BUY_DISCLOSURE: ProviderDisclosure = {
  providerId: "best_buy",
  retailerName: "Best Buy",
  isLive: true,
  attribution: "Price data provided by Best Buy.",
  retentionNotice: "Live provider content expires from the in-memory cache within 20 minutes.",
};

type BestBuyProduct = {
  sku?: unknown;
  name?: unknown;
  salePrice?: unknown;
  url?: unknown;
  onlineAvailability?: unknown;
  condition?: unknown;
  currency?: unknown;
};

type CacheEntry = { expiresAtMs: number; result: RetailProviderResult };

export type BestBuyProviderOptions = {
  apiKey?: string;
  mappings?: BestBuySkuMapping;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

function unavailable(
  partId: string,
  status: RetailProviderResult["status"],
  reason: ProviderErrorCode,
) {
  return {
    partId,
    providerId: "best_buy" as const,
    status,
    offer: null,
    disclosure: BEST_BUY_DISCLOSURE,
    fetchedAt: null,
    expiresAt: null,
    cached: false,
    reason,
  };
}

export function dollarsToMinorUnits(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const minor = Math.round((value + Number.EPSILON) * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function normalizeBestBuyAvailability(value: unknown): PartAvailability {
  if (value === true) return "in_stock";
  if (value === false) return "out_of_stock";
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (["in stock", "available", "available online"].includes(normalized)) return "in_stock";
  if (["out of stock", "sold out", "unavailable"].includes(normalized)) return "out_of_stock";
  return "unknown";
}

function normalizeCondition(value: unknown): CurrentRetailOffer["condition"] {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "new") return "new";
  if (normalized.includes("refurb")) return "refurbished";
  if (normalized === "used" || normalized.includes("open box")) return "used";
  return "unknown";
}

function normalizeProductUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["bestbuy.com", "www.bestbuy.com"].includes(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function errorForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  return "UPSTREAM_ERROR";
}

export function createBestBuyProvider(options: BestBuyProviderOptions = {}): RetailPriceProvider {
  const apiKey = options.apiKey?.trim();
  const mappings = options.mappings ?? VERIFIED_BEST_BUY_SKUS;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? BEST_BUY_TIMEOUT_MS;
  const cacheTtlMs = Math.min(
    options.cacheTtlMs ?? BEST_BUY_CACHE_TTL_MS,
    BEST_BUY_MAX_RETENTION_MS - 1,
  );
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<RetailProviderResult>>();

  async function request(partId: string, sku: string): Promise<RetailProviderResult> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    const fetchedAtDate = now();
    const fetchedAt = fetchedAtDate.toISOString();
    const expiresAt = new Date(fetchedAtDate.getTime() + cacheTtlMs).toISOString();
    const url = new URL(`https://api.bestbuy.com/v1/products(sku=${encodeURIComponent(sku)})`);
    url.searchParams.set("apiKey", apiKey!);
    url.searchParams.set("format", "json");
    url.searchParams.set("show", "sku,name,salePrice,url,onlineAvailability,condition,currency");

    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) return unavailable(partId, "error", errorForStatus(response.status));

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return unavailable(partId, "error", "INVALID_PAYLOAD");
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray((payload as { products?: unknown }).products)
      ) {
        return unavailable(partId, "error", "INVALID_PAYLOAD");
      }
      const products = (payload as { products: BestBuyProduct[] }).products;
      if (products.length === 0) return unavailable(partId, "unavailable", "PRODUCT_NOT_FOUND");
      const product = products[0];
      if (String(product.sku) !== sku) return unavailable(partId, "error", "INVALID_PAYLOAD");
      if (product.currency !== undefined && String(product.currency).toUpperCase() !== "USD") {
        return unavailable(partId, "error", "UNSUPPORTED_CURRENCY");
      }
      const itemPriceMinor = dollarsToMinorUnits(product.salePrice);
      if (itemPriceMinor === null) return unavailable(partId, "error", "MISSING_PRICE");
      const productUrl = normalizeProductUrl(product.url);
      if (!productUrl) return unavailable(partId, "error", "INVALID_PAYLOAD");

      const offer: CurrentRetailOffer = {
        partId,
        providerId: "best_buy",
        retailerName: "Best Buy",
        retailerSku: sku,
        currency: "USD",
        itemPriceMinor,
        shippingPriceMinor: null,
        effectivePriceMinor: null,
        availability: normalizeBestBuyAvailability(product.onlineAvailability),
        condition: normalizeCondition(product.condition),
        productUrl,
        providerProductName: typeof product.name === "string" ? product.name : null,
        fetchedAt,
        expiresAt,
        isLive: true,
        attribution: BEST_BUY_DISCLOSURE.attribution,
        freshnessMetadata: { cacheTtlSeconds: Math.floor(cacheTtlMs / 1000) },
      };
      return {
        partId,
        providerId: "best_buy",
        status: "success",
        offer,
        disclosure: BEST_BUY_DISCLOSURE,
        fetchedAt,
        expiresAt,
        cached: false,
        reason: null,
      };
    } catch (error) {
      return unavailable(
        partId,
        "error",
        error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "UPSTREAM_ERROR",
      );
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  return {
    async getCurrentOffer(partId) {
      if (!apiKey) return unavailable(partId, "disabled", "PROVIDER_DISABLED");
      const sku = mappings[partId];
      if (!sku) return unavailable(partId, "unavailable", "UNMAPPED_PART");
      const key = `best_buy:${partId}:${sku}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAtMs > now().getTime()) return { ...cached.result, cached: true };
      const pending = inflight.get(key);
      if (pending) return pending;
      const promise = request(partId, sku)
        .then((result) => {
          if (result.status === "success")
            cache.set(key, { expiresAtMs: Date.parse(result.expiresAt!), result });
          return result;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
  };
}
