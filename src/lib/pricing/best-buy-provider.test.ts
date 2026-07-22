import { handleInternalApiRequest } from "@/lib/api-router";
import {
  BEST_BUY_MAX_RETENTION_MS,
  createBestBuyProvider,
  dollarsToMinorUnits,
  normalizeBestBuyAvailability,
} from "@/lib/pricing/best-buy-provider.server";
import { getPriceRepository } from "@/lib/pricing/repository";
import type { RetailPriceProvider } from "@/types/current-offer";
import { describe, expect, it, vi } from "vitest";

const PART_ID = "cpu-i7-14700k";
const SKU = "fixture-sku-14700k";

function bestBuyResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      products: [
        {
          sku: SKU,
          name: "Intel Core i7-14700K",
          salePrice: 389.99,
          url: "https://www.bestbuy.com/site/example/fixture-sku-14700k.p",
          onlineAvailability: true,
          condition: "New",
          currency: "USD",
          ...overrides,
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function provider(fetcher: typeof fetch = vi.fn<typeof fetch>(async () => bestBuyResponse())) {
  return createBestBuyProvider({
    apiKey: "test-secret-key",
    mappings: { [PART_ID]: SKU },
    fetcher,
    now: () => new Date("2026-07-22T20:00:00.000Z"),
  });
}

describe("Best Buy current-offer normalization", () => {
  it("returns a typed disabled state when the server key is missing", async () => {
    await expect(
      createBestBuyProvider({ mappings: { [PART_ID]: SKU } }).getCurrentOffer(PART_ID),
    ).resolves.toMatchObject({ status: "disabled", reason: "PROVIDER_DISABLED", offer: null });
  });

  it("returns a typed unavailable state for an unmapped canonical part", async () => {
    await expect(
      createBestBuyProvider({ apiKey: "key", mappings: {} }).getCurrentOffer(PART_ID),
    ).resolves.toMatchObject({ status: "unavailable", reason: "UNMAPPED_PART" });
  });

  it("queries only the exact mapped SKU and requested fields", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => bestBuyResponse());
    await provider(fetcher).getCurrentOffer(PART_ID);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toContain(`products(sku=${SKU})`);
    expect(url.searchParams.get("show")).toContain("salePrice");
  });

  it("isolates similar canonical variants by their explicit SKU mappings", async () => {
    const secondPartId = "gpu-rtx-4070-ti-super";
    const secondSku = "fixture-sku-4070-ti-super";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const requestedSku = String(input).includes(secondSku) ? secondSku : SKU;
      return bestBuyResponse({ sku: requestedSku });
    });
    const currentProvider = createBestBuyProvider({
      apiKey: "key",
      mappings: { [PART_ID]: SKU, [secondPartId]: secondSku },
      fetcher,
    });

    const first = await currentProvider.getCurrentOffer(PART_ID);
    const second = await currentProvider.getCurrentOffer(secondPartId);
    expect(first.offer?.retailerSku).toBe(SKU);
    expect(second.offer?.retailerSku).toBe(secondSku);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normalizes a successful live response without inventing shipping", async () => {
    await expect(provider().getCurrentOffer(PART_ID)).resolves.toMatchObject({
      status: "success",
      cached: false,
      reason: null,
      offer: {
        partId: PART_ID,
        retailerSku: SKU,
        itemPriceMinor: 38_999,
        shippingPriceMinor: null,
        effectivePriceMinor: null,
        availability: "in_stock",
        isLive: true,
      },
    });
  });

  it("converts dollar numbers safely to integer minor units", () => {
    expect(dollarsToMinorUnits(19.99)).toBe(1_999);
    expect(dollarsToMinorUnits(-1)).toBeNull();
    expect(dollarsToMinorUnits(Number.NaN)).toBeNull();
  });

  it.each([
    [true, "in_stock"],
    [false, "out_of_stock"],
    ["Available Online", "in_stock"],
    ["unexpected", "unknown"],
  ] as const)("normalizes availability %s conservatively", (input, expected) => {
    expect(normalizeBestBuyAvailability(input)).toBe(expected);
  });

  it("rejects unsupported currency and missing price", async () => {
    const currencyProvider = provider(vi.fn(async () => bestBuyResponse({ currency: "CAD" })));
    const priceProvider = provider(vi.fn(async () => bestBuyResponse({ salePrice: null })));
    await expect(currencyProvider.getCurrentOffer(PART_ID)).resolves.toMatchObject({
      reason: "UNSUPPORTED_CURRENCY",
    });
    await expect(priceProvider.getCurrentOffer(PART_ID)).resolves.toMatchObject({
      reason: "MISSING_PRICE",
    });
  });

  it("handles product-not-found and malformed payloads", async () => {
    const notFound = provider(vi.fn(async () => Response.json({ products: [] })));
    const malformed = provider(vi.fn(async () => new Response("not-json")));
    await expect(notFound.getCurrentOffer(PART_ID)).resolves.toMatchObject({
      reason: "PRODUCT_NOT_FOUND",
    });
    await expect(malformed.getCurrentOffer(PART_ID)).resolves.toMatchObject({
      reason: "INVALID_PAYLOAD",
    });
  });

  it.each([
    [401, "UNAUTHORIZED"],
    [403, "UNAUTHORIZED"],
    [429, "RATE_LIMITED"],
    [503, "UPSTREAM_ERROR"],
  ] as const)("maps upstream status %i", async (status, reason) => {
    const result = await provider(
      vi.fn(async () => new Response(null, { status })),
    ).getCurrentOffer(PART_ID);
    expect(result.reason).toBe(reason);
  });

  it("times out an upstream request", async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const result = await createBestBuyProvider({
      apiKey: "key",
      mappings: { [PART_ID]: SKU },
      fetcher,
      timeoutMs: 1,
    }).getCurrentOffer(PART_ID);
    expect(result.reason).toBe("TIMEOUT");
  });
});

describe("Best Buy short-lived cache", () => {
  it("reuses cached results and deduplicates concurrent requests", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => bestBuyResponse());
    const currentProvider = provider(fetcher);
    const [first, second] = await Promise.all([
      currentProvider.getCurrentOffer(PART_ID),
      currentProvider.getCurrentOffer(PART_ID),
    ]);
    const cached = await currentProvider.getCurrentOffer(PART_ID);
    expect(first.offer).toEqual(second.offer);
    expect(cached.cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("expires cache entries and clamps retention below 72 hours", async () => {
    let nowMs = Date.parse("2026-07-22T20:00:00.000Z");
    const fetcher = vi.fn<typeof fetch>(async () => bestBuyResponse());
    const currentProvider = createBestBuyProvider({
      apiKey: "key",
      mappings: { [PART_ID]: SKU },
      fetcher,
      now: () => new Date(nowMs),
      cacheTtlMs: BEST_BUY_MAX_RETENTION_MS * 2,
    });
    const first = await currentProvider.getCurrentOffer(PART_ID);
    expect(Date.parse(first.expiresAt!) - Date.parse(first.fetchedAt!)).toBeLessThan(
      BEST_BUY_MAX_RETENTION_MS,
    );
    nowMs = Date.parse(first.expiresAt!) + 1;
    await currentProvider.getCurrentOffer(PART_ID);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("current-offer API separation", () => {
  const result = {
    partId: PART_ID,
    providerId: "best_buy" as const,
    status: "unavailable" as const,
    offer: null,
    disclosure: {
      providerId: "best_buy" as const,
      retailerName: "Best Buy" as const,
      isLive: true,
      attribution: "Price data provided by Best Buy.",
      retentionNotice: "Short-lived only.",
    },
    fetchedAt: null,
    expiresAt: null,
    cached: false,
    reason: "UNMAPPED_PART" as const,
  };
  const apiProvider: RetailPriceProvider = { getCurrentOffer: vi.fn(async () => result) };

  it("returns a normalized successful current-offer response", async () => {
    const liveProvider = provider();
    const response = await handleInternalApiRequest(
      new Request(`http://localhost/api/parts/${PART_ID}/current-offer`),
      { retailPriceProvider: liveProvider },
    );
    await expect(response?.json()).resolves.toMatchObject({
      status: "success",
      offer: { partId: PART_ID, retailerSku: SKU, itemPriceMinor: 38_999, isLive: true },
      disclosure: { attribution: "Price data provided by Best Buy." },
    });
  });

  it("returns typed current-offer API results without secret leakage", async () => {
    const response = await handleInternalApiRequest(
      new Request(`http://localhost/api/parts/${PART_ID}/current-offer`),
      { retailPriceProvider: apiProvider },
    );
    const body = await response!.text();
    expect(response?.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ reason: "UNMAPPED_PART", offer: null });
    expect(body).not.toContain("test-secret-key");
  });

  it("returns a typed unavailable response for an unknown canonical part", async () => {
    const response = await handleInternalApiRequest(
      new Request("http://localhost/api/parts/not-a-part/current-offer"),
      { retailPriceProvider: apiProvider },
    );
    await expect(response?.json()).resolves.toMatchObject({ reason: "UNKNOWN_PART", offer: null });
  });

  it("does not mutate deterministic historical observations", async () => {
    const repository = getPriceRepository();
    const before = repository.getObservations(PART_ID);
    await handleInternalApiRequest(
      new Request(`http://localhost/api/parts/${PART_ID}/current-offer`),
      {
        retailPriceProvider: apiProvider,
      },
    );
    expect(repository.getObservations(PART_ID)).toEqual(before);
  });
});
