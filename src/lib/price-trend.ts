import { ApiClientError, getPartPriceHistory } from "@/lib/apiClient";
import type {
  PriceApiErrorCode,
  PriceHistoryRange,
  PriceHistoryResponse,
  PriceObservation,
} from "@/types/pricing";

export const PRICE_HISTORY_RANGE_OPTIONS = [
  { value: "7d", shortLabel: "7D", accessibleLabel: "7 day price history" },
  { value: "30d", shortLabel: "30D", accessibleLabel: "30 day price history" },
  { value: "90d", shortLabel: "90D", accessibleLabel: "90 day price history" },
] as const satisfies ReadonlyArray<{
  value: PriceHistoryRange;
  shortLabel: string;
  accessibleLabel: string;
}>;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const observationDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function formatUsdMinorUnits(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : usdFormatter.format(value / 100);
}

export function formatObservationDate(value: string) {
  return observationDateFormatter.format(new Date(value));
}

export type PriceChangePresentation = {
  label: string;
  direction: "increase" | "decrease" | "unchanged" | "neutral";
};

export function formatPriceChange(
  absolutePriceChangeMinor: number | null,
  percentagePriceChange: number | null,
  previousComparablePriceMinor: number | null,
): PriceChangePresentation {
  if (
    previousComparablePriceMinor === null ||
    absolutePriceChangeMinor === null ||
    percentagePriceChange === null
  ) {
    return { label: "No previous comparable price", direction: "neutral" };
  }

  if (absolutePriceChangeMinor === 0) {
    return { label: "Unchanged (0.00%)", direction: "unchanged" };
  }

  const amount = formatUsdMinorUnits(Math.abs(absolutePriceChangeMinor));
  const percentage = `${Math.abs(percentagePriceChange).toFixed(2)}%`;

  return absolutePriceChangeMinor < 0
    ? { label: `Decreased ${amount} (${percentage})`, direction: "decrease" }
    : { label: `Increased ${amount} (${percentage})`, direction: "increase" };
}

export function isComparableObservation(observation: PriceObservation) {
  return observation.availability === "in_stock" && observation.effectivePreTaxPriceMinor !== null;
}

export function formatShipping(observation: PriceObservation) {
  if (observation.shippingPriceMinor === null) {
    return "Unknown — excluded from comparable total";
  }

  return observation.shippingPriceMinor === 0
    ? "Included / $0.00"
    : formatUsdMinorUnits(observation.shippingPriceMinor);
}

export function formatAvailability(observation: PriceObservation) {
  const labels: Record<PriceObservation["availability"], string> = {
    in_stock: "In stock",
    out_of_stock: "Out of stock",
    preorder: "Preorder",
    backorder: "Backorder",
    unknown: "Availability unknown",
  };

  return labels[observation.availability];
}

export function formatCondition(observation: PriceObservation) {
  return observation.condition[0].toUpperCase() + observation.condition.slice(1);
}

export type PriceChartPoint = {
  id: string;
  x: number;
  y: number;
  value: number | null;
  kind: "comparable" | "unavailable" | "unknown_shipping";
};

export type PriceChartPresentation = {
  comparablePoints: PriceChartPoint[];
  unavailablePoints: PriceChartPoint[];
  polylinePoints: string;
};

export function createPriceChartPresentation(
  observations: PriceObservation[],
  width = 100,
  height = 48,
  padding = 6,
): PriceChartPresentation {
  const sorted = [...observations].sort(
    (left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt),
  );
  const timestamps = sorted.map((observation) => Date.parse(observation.observedAt));
  const firstTimestamp = timestamps[0] ?? 0;
  const lastTimestamp = timestamps.at(-1) ?? firstTimestamp;
  const timestampSpan = lastTimestamp - firstTimestamp;
  const comparableValues = sorted
    .filter(isComparableObservation)
    .map((observation) => observation.effectivePreTaxPriceMinor as number);
  const minimum = comparableValues.length > 0 ? Math.min(...comparableValues) : 0;
  const maximum = comparableValues.length > 0 ? Math.max(...comparableValues) : minimum;
  const valueSpan = maximum - minimum;
  const xFor = (timestamp: number) =>
    timestampSpan === 0
      ? width / 2
      : padding + ((timestamp - firstTimestamp) / timestampSpan) * (width - padding * 2);
  const yFor = (value: number) =>
    valueSpan === 0
      ? height / 2
      : height - padding - ((value - minimum) / valueSpan) * (height - padding * 2);

  const comparablePoints: PriceChartPoint[] = [];
  const unavailablePoints: PriceChartPoint[] = [];

  sorted.forEach((observation) => {
    const comparable = isComparableObservation(observation);
    const point: PriceChartPoint = {
      id: observation.id,
      x: xFor(Date.parse(observation.observedAt)),
      y: comparable ? yFor(observation.effectivePreTaxPriceMinor as number) : height - padding,
      value: observation.effectivePreTaxPriceMinor,
      kind: comparable
        ? "comparable"
        : observation.shippingPriceMinor === null && observation.availability === "in_stock"
          ? "unknown_shipping"
          : "unavailable",
    };

    if (comparable) {
      comparablePoints.push(point);
    } else {
      unavailablePoints.push(point);
    }
  });

  return {
    comparablePoints,
    unavailablePoints,
    polylinePoints: comparablePoints.map((point) => `${point.x},${point.y}`).join(" "),
  };
}

export function getAccessibleTrendSummary(observations: PriceObservation[]) {
  const comparable = observations
    .filter(isComparableObservation)
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const unavailableCount = observations.length - comparable.length;
  const unavailableSuffix =
    unavailableCount > 0
      ? ` ${unavailableCount} additional observation${unavailableCount === 1 ? " is" : "s are"} not comparable.`
      : "";

  if (comparable.length === 0) {
    return `No comparable price points are available.${unavailableSuffix}`;
  }

  const first = comparable[0].effectivePreTaxPriceMinor as number;
  const last = comparable.at(-1)?.effectivePreTaxPriceMinor as number;

  if (comparable.length === 1) {
    return `One comparable observation at ${formatUsdMinorUnits(first)}.${unavailableSuffix}`;
  }

  const movement = last > first ? "increased" : last < first ? "decreased" : "was unchanged";
  return `${comparable.length} comparable observations. Price ${movement} from ${formatUsdMinorUnits(first)} to ${formatUsdMinorUnits(last)}.${unavailableSuffix}`;
}

export type PriceHistoryErrorPresentation = {
  title: string;
  message: string;
  code?: PriceApiErrorCode;
};

export function getPriceHistoryErrorPresentation(error: unknown): PriceHistoryErrorPresentation {
  if (error instanceof ApiClientError && error.code === "UNKNOWN_PART") {
    return {
      title: "Price history unavailable",
      message: "Price history is not available for this exact catalog item.",
      code: "UNKNOWN_PART",
    };
  }

  if (error instanceof ApiClientError && error.code === "NO_PRICE_DATA") {
    return {
      title: "No price observations",
      message: "No price observations exist for this item in the selected range.",
      code: "NO_PRICE_DATA",
    };
  }

  return {
    title: "Price history could not be loaded",
    message:
      error instanceof ApiClientError
        ? error.message
        : "The sample price service is unavailable. Please try again.",
  };
}

export type PriceHistoryRequestToken = {
  id: number;
  key: string;
};

export function getPriceHistoryRequestKey(partId: string, range: PriceHistoryRange) {
  return `${partId}:${range}`;
}

export function createLatestPriceRequestGuard() {
  let latestId = 0;

  return {
    begin(partId: string, range: PriceHistoryRange): PriceHistoryRequestToken {
      latestId += 1;
      return { id: latestId, key: getPriceHistoryRequestKey(partId, range) };
    },
    isCurrent(token: PriceHistoryRequestToken) {
      return token.id === latestId;
    },
    invalidate() {
      latestId += 1;
    },
  };
}

export function createPriceHistoryLoader(
  fetcher: (partId: string, range: PriceHistoryRange) => Promise<PriceHistoryResponse>,
) {
  const cache = new Map<string, Promise<PriceHistoryResponse>>();

  return {
    load(partId: string, range: PriceHistoryRange, refresh = false) {
      const key = getPriceHistoryRequestKey(partId, range);

      if (refresh) {
        cache.delete(key);
      }

      const cached = cache.get(key);
      if (cached) {
        return cached;
      }

      const request = fetcher(partId, range).catch((error: unknown) => {
        if (cache.get(key) === request) {
          cache.delete(key);
        }
        throw error;
      });
      cache.set(key, request);
      return request;
    },
    clear() {
      cache.clear();
    },
  };
}

export const priceHistoryLoader = createPriceHistoryLoader(getPartPriceHistory);
