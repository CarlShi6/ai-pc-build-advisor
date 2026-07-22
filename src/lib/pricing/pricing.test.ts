import { describe, expect, it } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import { InMemoryPriceRepository } from "@/lib/pricing/repository";
import {
  normalizePriceHistoryRange,
  normalizePriceObservation,
  PriceValidationError,
} from "@/lib/pricing/validation";
import type { PriceObservationInput } from "@/types/pricing";

const NOW = new Date("2026-07-22T00:00:00.000Z");

function observation(overrides: Partial<PriceObservationInput> = {}): PriceObservationInput {
  return {
    id: "price-1",
    partId: "part-a",
    retailer: " Newegg ",
    retailerSku: "sku-a",
    listingUrl: "https://example.com/listing-a",
    currency: "usd",
    itemPriceMinor: 10_000,
    shippingPriceMinor: 500,
    availability: "in_stock",
    condition: "new",
    sourceType: "mock",
    observedAt: "2026-07-21T16:00:00-04:00",
    ...overrides,
  };
}

function repository(inputs: PriceObservationInput[] = []) {
  return new InMemoryPriceRepository(["part-a", "part-b"], inputs, NOW);
}

describe("price observation normalization", () => {
  it("normalizes retailer, currency, timestamp, and effective price", () => {
    expect(
      normalizePriceObservation(observation(), {
        now: NOW,
        hasPart: (partId) => partId === "part-a",
      }),
    ).toMatchObject({
      retailerId: "newegg",
      retailerName: "Newegg",
      currency: "USD",
      itemPriceMinor: 10_000,
      shippingPriceMinor: 500,
      effectivePreTaxPriceMinor: 10_500,
      observedAt: "2026-07-21T20:00:00.000Z",
    });
  });

  it("preserves unknown shipping instead of assuming zero", () => {
    const normalized = normalizePriceObservation(observation({ shippingPriceMinor: undefined }), {
      now: NOW,
      hasPart: () => true,
    });

    expect(normalized.shippingPriceMinor).toBeNull();
    expect(normalized.effectivePreTaxPriceMinor).toBeNull();
  });

  it("rejects negative prices", () => {
    expect(() =>
      normalizePriceObservation(observation({ itemPriceMinor: -1 }), {
        now: NOW,
        hasPart: () => true,
      }),
    ).toThrow("Item price must be a non-negative integer in minor units.");
  });

  it("rejects unsupported currencies", () => {
    expect(() =>
      normalizePriceObservation(observation({ currency: "EUR" }), {
        now: NOW,
        hasPart: () => true,
      }),
    ).toThrow("Unsupported currency: EUR.");
  });

  it("rejects unknown canonical part IDs", () => {
    expect(() =>
      normalizePriceObservation(observation(), {
        now: NOW,
        hasPart: () => false,
      }),
    ).toThrow("Unknown canonical part ID: part-a.");
  });

  it("rejects invalid availability, timestamps, and listing URLs", () => {
    const options = { now: NOW, hasPart: () => true };
    expect(() =>
      normalizePriceObservation(observation({ availability: "maybe" }), options),
    ).toThrow("Availability value is invalid.");
    expect(() =>
      normalizePriceObservation(observation({ observedAt: "not-a-date" }), options),
    ).toThrow("Observation timestamp must be a valid timestamp.");
    expect(() =>
      normalizePriceObservation(observation({ listingUrl: "javascript:alert(1)" }), options),
    ).toThrow("Listing URL must be a valid HTTP or HTTPS URL.");
  });
});

describe("in-memory price repository", () => {
  it("isolates exact canonical part variants", () => {
    const store = repository([
      observation({ id: "part-a-price", partId: "part-a", itemPriceMinor: 10_000 }),
      observation({ id: "part-b-price", partId: "part-b", itemPriceMinor: 20_000 }),
    ]);

    expect(store.getObservations("part-a").map((item) => item.id)).toEqual(["part-a-price"]);
    expect(store.getObservations("part-b").map((item) => item.id)).toEqual(["part-b-price"]);
  });

  it("orders history chronologically", () => {
    const store = repository([
      observation({ id: "later", observedAt: "2026-07-21T20:00:00.000Z" }),
      observation({ id: "earlier", observedAt: "2026-07-18T20:00:00.000Z" }),
    ]);

    expect(store.getObservations("part-a").map((item) => item.id)).toEqual(["earlier", "later"]);
  });

  it("filters supported history ranges inclusively", () => {
    const store = repository([
      observation({ id: "inside", observedAt: "2026-07-16T00:00:00.000Z" }),
      observation({ id: "outside", observedAt: "2026-07-14T23:59:59.000Z" }),
    ]);

    expect(store.getObservationsInRange("part-a", "7d", NOW).map((item) => item.id)).toEqual([
      "inside",
    ]);
  });

  it("replaces duplicate logical observations deterministically", () => {
    const store = repository();
    store.storeObservation(observation({ id: "original", itemPriceMinor: 10_000 }), NOW);
    store.storeObservation(observation({ id: "replacement", itemPriceMinor: 9_500 }), NOW);

    expect(store.getObservations("part-a")).toHaveLength(1);
    expect(store.getObservations("part-a")[0]).toMatchObject({
      id: "replacement",
      itemPriceMinor: 9_500,
    });
  });

  it("selects the best latest in-stock price and excludes out-of-stock listings", () => {
    const store = repository([
      observation({ id: "available", retailerSku: "available", itemPriceMinor: 9_500 }),
      observation({
        id: "unavailable",
        retailer: "Best Buy",
        retailerSku: "unavailable",
        itemPriceMinor: 8_000,
        availability: "out_of_stock",
      }),
    ]);
    const summary = store.getCurrentPriceSummary("part-a", "30d", NOW);

    expect(summary?.currentBest).toMatchObject({ observationId: "available" });
  });

  it("calculates previous comparable price and price change for the winning listing", () => {
    const store = repository([
      observation({
        id: "previous",
        observedAt: "2026-07-18T20:00:00.000Z",
        itemPriceMinor: 10_000,
        shippingPriceMinor: 0,
      }),
      observation({
        id: "current",
        observedAt: "2026-07-21T20:00:00.000Z",
        itemPriceMinor: 9_000,
        shippingPriceMinor: 0,
      }),
    ]);
    const summary = store.getCurrentPriceSummary("part-a", "30d", NOW);

    expect(summary).toMatchObject({
      previousComparablePriceMinor: 10_000,
      absolutePriceChangeMinor: -1_000,
      percentagePriceChange: -10,
    });
  });

  it("calculates comparable range low and high", () => {
    const store = repository([
      observation({ id: "low", retailerSku: "low", itemPriceMinor: 8_500, shippingPriceMinor: 0 }),
      observation({
        id: "high",
        retailerSku: "high",
        itemPriceMinor: 11_000,
        shippingPriceMinor: 0,
      }),
      observation({
        id: "ignored-out-of-stock",
        retailerSku: "ignored",
        itemPriceMinor: 5_000,
        shippingPriceMinor: 0,
        availability: "out_of_stock",
      }),
    ]);

    expect(store.getCurrentPriceSummary("part-a", "30d", NOW)).toMatchObject({
      rangeLowMinor: 8_500,
      rangeHighMinor: 11_000,
    });
  });

  it("returns no summary when the part has no observations in range", () => {
    expect(repository().getCurrentPriceSummary("part-a", "30d", NOW)).toBeNull();
  });

  it("discloses deterministic mock sources as non-live", () => {
    const summary = repository([observation()]).getCurrentPriceSummary("part-a", "30d", NOW);

    expect(summary?.disclosure).toEqual({
      containsMockData: true,
      isLive: false,
      sourceTypes: ["mock"],
      message:
        "Deterministic mock price observations for development and testing; not live market data.",
    });
  });
});

describe("price history range and internal API", () => {
  it("rejects arbitrary public ranges", () => {
    expect(() => normalizePriceHistoryRange("365d")).toThrow(PriceValidationError);
  });

  it("returns a typed mock price summary for an exact catalog part", async () => {
    const response = await handleInternalApiRequest(
      new Request("http://localhost/api/parts/cpu-i7-14700k/prices?range=30d"),
    );
    const payload = await response?.json();

    expect(response?.status).toBe(200);
    expect(payload).toMatchObject({
      partId: "cpu-i7-14700k",
      currency: "USD",
      range: "30d",
      currentBest: {
        retailerId: "newegg",
        effectivePreTaxPriceMinor: 38_999,
      },
      disclosure: { containsMockData: true, isLive: false },
    });
    expect(payload.observations).toHaveLength(5);
  });

  it.each([
    ["http://localhost/api/parts/cpu-i7-14700k/prices?range=365d", 400, "INVALID_RANGE"],
    ["http://localhost/api/parts/not-a-part/prices?range=30d", 404, "UNKNOWN_PART"],
    ["http://localhost/api/parts/gpu-rtx-4090/prices?range=30d", 404, "NO_PRICE_DATA"],
  ])("returns structured errors for %s", async (url, status, code) => {
    const response = await handleInternalApiRequest(new Request(url));

    expect(response?.status).toBe(status);
    await expect(response?.json()).resolves.toMatchObject({ error: { code } });
  });
});
