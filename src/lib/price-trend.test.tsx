import { PriceTrendView } from "@/components/price-trend-panel";
import { ApiClientError, getPartPriceHistory } from "@/lib/apiClient";
import {
  PRICE_HISTORY_RANGE_OPTIONS,
  createLatestPriceRequestGuard,
  createPriceChartPresentation,
  createPriceHistoryLoader,
  formatPriceChange,
  formatShipping,
  formatUsdMinorUnits,
  getAccessibleTrendSummary,
  getPriceHistoryErrorPresentation,
} from "@/lib/price-trend";
import type { PriceHistoryResponse, PriceObservation } from "@/types/pricing";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function observation(overrides: Partial<PriceObservation> = {}): PriceObservation {
  return {
    id: "observation-1",
    partId: "cpu-i7-14700k",
    retailerId: "newegg",
    retailerName: "Newegg",
    retailerSku: "sku-1",
    currency: "USD",
    itemPriceMinor: 38_999,
    shippingPriceMinor: 0,
    effectivePreTaxPriceMinor: 38_999,
    availability: "in_stock",
    condition: "new",
    sourceType: "mock",
    observedAt: "2026-07-21T20:00:00.000Z",
    ...overrides,
  };
}

function response(overrides: Partial<PriceHistoryResponse> = {}): PriceHistoryResponse {
  const observations = overrides.observations ?? [observation()];
  return {
    partId: "cpu-i7-14700k",
    currency: "USD",
    range: "30d",
    observations,
    currentBest: {
      observationId: "observation-1",
      retailerId: "newegg",
      retailerName: "Newegg",
      retailerSku: "sku-1",
      itemPriceMinor: 38_999,
      shippingPriceMinor: 0,
      effectivePreTaxPriceMinor: 38_999,
      observedAt: "2026-07-21T20:00:00.000Z",
    },
    previousComparablePriceMinor: null,
    absolutePriceChangeMinor: null,
    percentagePriceChange: null,
    rangeLowMinor: 38_999,
    rangeHighMinor: 38_999,
    observationCount: observations.length,
    lastObservationAt: "2026-07-21T20:00:00.000Z",
    disclosure: {
      containsMockData: true,
      isLive: false,
      sourceTypes: ["mock"],
      message: "Deterministic sample observations; not live market data.",
    },
    ...overrides,
  };
}

function renderView(
  state:
    | { key: string; status: "loading" }
    | { key: string; status: "error"; error: unknown }
    | { key: string; status: "success"; response: PriceHistoryResponse },
  range: PriceHistoryResponse["range"] = "30d",
) {
  return renderToStaticMarkup(
    <PriceTrendView
      partName="Intel Core i7-14700K"
      range={range}
      state={state}
      onRangeChange={() => undefined}
      onRetry={() => undefined}
    />,
  );
}

describe("price trend formatting", () => {
  it("formats integer minor units as USD without floating-point price inputs", () => {
    expect(formatUsdMinorUnits(38_999)).toBe("$389.99");
    expect(formatUsdMinorUnits(1_000_099)).toBe("$10,000.99");
  });

  it("does not turn missing price data into zero", () => {
    expect(formatUsdMinorUnits(null)).toBe("Unavailable");
  });

  it("formats positive price changes with explicit direction", () => {
    expect(formatPriceChange(1_000, 2.5, 40_000)).toEqual({
      label: "Increased $10.00 (2.50%)",
      direction: "increase",
    });
  });

  it("formats negative price changes with explicit direction", () => {
    expect(formatPriceChange(-1_000, -2.5, 40_000)).toEqual({
      label: "Decreased $10.00 (2.50%)",
      direction: "decrease",
    });
  });

  it("uses a neutral message when no previous comparable price exists", () => {
    expect(formatPriceChange(null, null, null)).toEqual({
      label: "No previous comparable price",
      direction: "neutral",
    });
  });

  it("distinguishes a real unchanged comparison from missing data", () => {
    expect(formatPriceChange(0, 0, 38_999)).toEqual({
      label: "Unchanged (0.00%)",
      direction: "unchanged",
    });
  });
});

describe("price trend request lifecycle", () => {
  it("offers exactly the supported range selections with 30 days as a usable option", () => {
    expect(PRICE_HISTORY_RANGE_OPTIONS.map((option) => option.value)).toEqual(["7d", "30d", "90d"]);
  });

  it("deduplicates simultaneous requests for the same exact part and range", async () => {
    const fetcher = vi.fn(async () => response());
    const loader = createPriceHistoryLoader(fetcher);
    const first = loader.load("cpu-i7-14700k", "30d");
    const second = loader.load("cpu-i7-14700k", "30d");

    expect(first).toBe(second);
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps exact canonical part variants and ranges in separate cache keys", async () => {
    const fetcher = vi.fn(async (partId: string) => response({ partId }));
    const loader = createPriceHistoryLoader(fetcher);

    await loader.load("gpu-rtx-4070-super", "30d");
    await loader.load("gpu-rtx-4070-ti-super", "30d");
    await loader.load("gpu-rtx-4070-ti-super", "90d");

    expect(fetcher.mock.calls).toEqual([
      ["gpu-rtx-4070-super", "30d"],
      ["gpu-rtx-4070-ti-super", "30d"],
      ["gpu-rtx-4070-ti-super", "90d"],
    ]);
  });

  it("removes failed requests so retry performs a new fetch", async () => {
    const fetcher = vi
      .fn<() => Promise<PriceHistoryResponse>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(response());
    const loader = createPriceHistoryLoader(fetcher);

    await expect(loader.load("cpu-i7-14700k", "30d")).rejects.toThrow("temporary");
    await expect(loader.load("cpu-i7-14700k", "30d", true)).resolves.toMatchObject({
      partId: "cpu-i7-14700k",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("prevents stale part or range responses from becoming current", () => {
    const guard = createLatestPriceRequestGuard();
    const oldRequest = guard.begin("gpu-rtx-4070-super", "30d");
    const currentRequest = guard.begin("gpu-rtx-4070-ti-super", "7d");

    expect(guard.isCurrent(oldRequest)).toBe(false);
    expect(guard.isCurrent(currentRequest)).toBe(true);
  });
});

describe("price trend chart presentation", () => {
  it("places a one-point history safely in the center", () => {
    const chart = createPriceChartPresentation([observation()]);

    expect(chart.comparablePoints).toHaveLength(1);
    expect(chart.comparablePoints[0]).toMatchObject({ x: 50, y: 24 });
  });

  it("centers equal-price observations without dividing by zero", () => {
    const chart = createPriceChartPresentation([
      observation({ id: "first", observedAt: "2026-07-20T20:00:00.000Z" }),
      observation({ id: "second", observedAt: "2026-07-21T20:00:00.000Z" }),
    ]);

    expect(chart.comparablePoints.map((point) => point.y)).toEqual([24, 24]);
  });

  it("provides an accessible text summary independent of the SVG", () => {
    expect(
      getAccessibleTrendSummary([
        observation({ id: "first", effectivePreTaxPriceMinor: 40_000 }),
        observation({
          id: "second",
          observedAt: "2026-07-22T20:00:00.000Z",
          effectivePreTaxPriceMinor: 38_999,
        }),
      ]),
    ).toContain("Price decreased from $400.00 to $389.99");
  });

  it("marks unknown-shipping observations as non-comparable", () => {
    const unknownShipping = observation({
      shippingPriceMinor: null,
      effectivePreTaxPriceMinor: null,
    });
    const chart = createPriceChartPresentation([unknownShipping]);

    expect(chart.comparablePoints).toHaveLength(0);
    expect(chart.unavailablePoints[0].kind).toBe("unknown_shipping");
    expect(formatShipping(unknownShipping)).toContain("excluded from comparable total");
  });

  it("marks out-of-stock observations separately from comparable points", () => {
    const chart = createPriceChartPresentation([observation({ availability: "out_of_stock" })]);

    expect(chart.comparablePoints).toHaveLength(0);
    expect(chart.unavailablePoints[0].kind).toBe("unavailable");
  });
});

describe("price trend UI states and accessibility", () => {
  it("announces a compact loading state without removing the focused part", () => {
    const markup = renderView({ key: "cpu-i7-14700k:30d", status: "loading" });

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Loading price history");
    expect(markup).toContain("Intel Core i7-14700K");
  });

  it("renders a successful sample summary and neutral previous-price state", () => {
    const markup = renderView({
      key: "cpu-i7-14700k:30d",
      status: "success",
      response: response(),
    });

    expect(markup).toContain("Best comparable sample price");
    expect(markup).toContain("$389.99");
    expect(markup).toContain("No previous comparable price");
  });

  it("shows the non-live development disclosure visibly", () => {
    const markup = renderView({
      key: "cpu-i7-14700k:30d",
      status: "success",
      response: response(),
    });

    expect(markup).toContain("Development sample data — not live retailer pricing.");
  });

  it("renders a truthful no-observations state", () => {
    const markup = renderView({
      key: "cpu-i7-14700k:30d",
      status: "success",
      response: response({ observations: [], observationCount: 0, currentBest: null }),
    });

    expect(markup).toContain("No price observations");
    expect(markup).not.toContain("$0.00");
    expect(markup).not.toContain("min-h-[17rem]");
  });

  it("maps typed unknown-part API errors to catalog language", () => {
    const presentation = getPriceHistoryErrorPresentation(
      new ApiClientError("Unknown canonical part ID", 404, false, "UNKNOWN_PART"),
    );

    expect(presentation).toMatchObject({
      code: "UNKNOWN_PART",
      title: "Price history unavailable",
    });
  });

  it("preserves structured price error codes from the API client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "UNKNOWN_PART", message: "Unknown canonical part ID." },
            }),
            { status: 404, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    try {
      await expect(getPartPriceHistory("not-a-part", "30d")).rejects.toMatchObject({
        name: "ApiClientError",
        status: 404,
        code: "UNKNOWN_PART",
        message: "Unknown canonical part ID.",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps typed no-data API errors and renders an accessible retry action", () => {
    const markup = renderView({
      key: "gpu-rtx-4090:30d",
      status: "error",
      error: new ApiClientError("No observations", 404, false, "NO_PRICE_DATA"),
    });

    expect(markup).toContain("No price observations");
    expect(markup).toContain("Retry price history");
    expect(markup).toContain('role="alert"');
  });

  it("gives every range control an accessible label and selected state", () => {
    const markup = renderView({ key: "cpu-i7-14700k:30d", status: "loading" });

    expect(markup).toContain('aria-label="7 day price history"');
    expect(markup).toContain('aria-label="30 day price history" aria-pressed="true"');
    expect(markup).toContain('aria-label="90 day price history"');
  });

  it("renders unknown shipping and out-of-stock states as text, not color alone", () => {
    const markup = renderView({
      key: "cpu-i7-14700k:30d",
      status: "success",
      response: response({
        currentBest: null,
        rangeLowMinor: null,
        rangeHighMinor: null,
        observations: [
          observation({
            id: "unknown-shipping",
            shippingPriceMinor: null,
            effectivePreTaxPriceMinor: null,
          }),
          observation({ id: "out-of-stock", availability: "out_of_stock" }),
        ],
      }),
    });

    expect(markup).toContain("shipping unknown");
    expect(markup).toContain("Unavailable / not rankable");
    expect(markup).toContain("No comparable price can be ranked");
  });

  it("keeps successful chart analysis collapsed behind an accessible disclosure", () => {
    const markup = renderView({
      key: "cpu-i7-14700k:30d",
      status: "success",
      response: response(),
    });

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("Show price chart and trend explanation");
    expect(markup).toContain("Observation details (1)");
  });
});
