import { seedParts } from "@/data/seedParts";
import { mockPriceObservationInputs, MOCK_PRICE_DATA_AS_OF } from "@/lib/pricing/mock-data";
import { normalizePriceObservation } from "@/lib/pricing/validation";
import type {
  PriceHistoryRange,
  PriceHistoryResponse,
  PriceObservation,
  PriceObservationInput,
} from "@/types/pricing";

const RANGE_DAYS: Record<PriceHistoryRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface PriceRepository {
  hasCanonicalPart(partId: string): boolean;
  storeObservation(input: PriceObservationInput, now?: Date): PriceObservation;
  getObservations(partId: string): PriceObservation[];
  getObservationsInRange(partId: string, range: PriceHistoryRange, asOf?: Date): PriceObservation[];
  getLatestPerListing(partId: string, range: PriceHistoryRange, asOf?: Date): PriceObservation[];
  getCurrentPriceSummary(
    partId: string,
    range: PriceHistoryRange,
    asOf?: Date,
  ): PriceHistoryResponse | null;
}

export interface PriceObservationProvider {
  readonly id: string;
  collectForPart(partId: string): Promise<PriceObservationInput[]>;
}

function logicalObservationKey(observation: PriceObservation) {
  const listingIdentity =
    observation.retailerSku ?? observation.listingUrl ?? `observation:${observation.id}`;
  const sellerIdentity = observation.sellerName?.toLowerCase() ?? "retailer-direct";
  return [
    observation.partId,
    observation.retailerId,
    sellerIdentity,
    listingIdentity,
    observation.observedAt,
  ].join("|");
}

function listingKey(observation: PriceObservation) {
  const listingIdentity =
    observation.retailerSku ?? observation.listingUrl ?? `observation:${observation.id}`;
  return [
    observation.retailerId,
    observation.sellerName?.toLowerCase() ?? "retailer-direct",
    listingIdentity,
  ].join("|");
}

function chronological(left: PriceObservation, right: PriceObservation) {
  return left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id);
}

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

export class InMemoryPriceRepository implements PriceRepository {
  private readonly canonicalPartIds: Set<string>;
  private observations: PriceObservation[] = [];

  constructor(
    canonicalPartIds: Iterable<string>,
    initialObservations: PriceObservationInput[] = [],
    normalizationNow: Date = new Date(),
  ) {
    this.canonicalPartIds = new Set(canonicalPartIds);
    for (const observation of initialObservations) {
      this.storeObservation(observation, normalizationNow);
    }
  }

  hasCanonicalPart(partId: string) {
    return this.canonicalPartIds.has(partId);
  }

  storeObservation(input: PriceObservationInput, now = new Date()) {
    const normalized = normalizePriceObservation(input, {
      now,
      hasPart: (partId) => this.hasCanonicalPart(partId),
    });
    const logicalKey = logicalObservationKey(normalized);
    const duplicateIndex = this.observations.findIndex(
      (existing) => existing.id === normalized.id || logicalObservationKey(existing) === logicalKey,
    );

    if (duplicateIndex >= 0) {
      this.observations[duplicateIndex] = normalized;
    } else {
      this.observations.push(normalized);
    }

    return normalized;
  }

  getObservations(partId: string) {
    return this.observations.filter((item) => item.partId === partId).sort(chronological);
  }

  getObservationsInRange(partId: string, range: PriceHistoryRange, asOf = new Date()) {
    const endTime = asOf.getTime();
    const startTime = endTime - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

    return this.getObservations(partId).filter((item) => {
      const timestamp = new Date(item.observedAt).getTime();
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  getLatestPerListing(partId: string, range: PriceHistoryRange, asOf = new Date()) {
    const latest = new Map<string, PriceObservation>();

    for (const observation of this.getObservationsInRange(partId, range, asOf)) {
      const key = listingKey(observation);
      const existing = latest.get(key);
      if (!existing || chronological(existing, observation) < 0) {
        latest.set(key, observation);
      }
    }

    return Array.from(latest.values()).sort(chronological);
  }

  getCurrentPriceSummary(
    partId: string,
    range: PriceHistoryRange,
    asOf = new Date(),
  ): PriceHistoryResponse | null {
    const history = this.getObservationsInRange(partId, range, asOf);
    if (history.length === 0) {
      return null;
    }

    const latestPerListing = this.getLatestPerListing(partId, range, asOf);
    const currentBestObservation = latestPerListing
      .filter((item) => item.availability === "in_stock" && item.effectivePreTaxPriceMinor !== null)
      .sort((left, right) => {
        const priceDelta = left.effectivePreTaxPriceMinor! - right.effectivePreTaxPriceMinor!;
        return (
          priceDelta ||
          chronological(right, left) ||
          listingKey(left).localeCompare(listingKey(right))
        );
      })[0];

    const comparableHistory = history.filter(
      (item) => item.availability === "in_stock" && item.effectivePreTaxPriceMinor !== null,
    );
    let previousComparable: PriceObservation | undefined;

    if (currentBestObservation) {
      previousComparable = comparableHistory
        .filter(
          (item) =>
            listingKey(item) === listingKey(currentBestObservation) &&
            item.id !== currentBestObservation.id &&
            chronological(item, currentBestObservation) < 0,
        )
        .sort((left, right) => chronological(right, left))[0];
    }

    const currentPrice = currentBestObservation?.effectivePreTaxPriceMinor ?? null;
    const previousPrice = previousComparable?.effectivePreTaxPriceMinor ?? null;
    const absoluteChange =
      currentPrice !== null && previousPrice !== null ? currentPrice - previousPrice : null;
    const comparablePrices = comparableHistory.map((item) => item.effectivePreTaxPriceMinor!);
    const sourceTypes = Array.from(new Set(history.map((item) => item.sourceType))).sort();

    return {
      partId,
      currency: "USD",
      range,
      observations: history,
      currentBest: currentBestObservation
        ? {
            observationId: currentBestObservation.id,
            retailerId: currentBestObservation.retailerId,
            retailerName: currentBestObservation.retailerName,
            retailerSku: currentBestObservation.retailerSku,
            sellerName: currentBestObservation.sellerName,
            listingUrl: currentBestObservation.listingUrl,
            itemPriceMinor: currentBestObservation.itemPriceMinor,
            shippingPriceMinor: currentBestObservation.shippingPriceMinor!,
            effectivePreTaxPriceMinor: currentBestObservation.effectivePreTaxPriceMinor!,
            observedAt: currentBestObservation.observedAt,
          }
        : null,
      previousComparablePriceMinor: previousPrice,
      absolutePriceChangeMinor: absoluteChange,
      percentagePriceChange:
        absoluteChange !== null && previousPrice !== null && previousPrice !== 0
          ? roundPercentage((absoluteChange / previousPrice) * 100)
          : null,
      rangeLowMinor: comparablePrices.length > 0 ? Math.min(...comparablePrices) : null,
      rangeHighMinor: comparablePrices.length > 0 ? Math.max(...comparablePrices) : null,
      observationCount: history.length,
      lastObservationAt: history[history.length - 1].observedAt,
      disclosure: {
        containsMockData: sourceTypes.includes("mock"),
        isLive: false,
        sourceTypes,
        message: sourceTypes.includes("mock")
          ? "Deterministic mock price observations for development and testing; not live market data."
          : "Stored price observations; not guaranteed to be live market data.",
      },
    };
  }
}

let priceRepository: PriceRepository | null = null;

export function getPriceRepository(): PriceRepository {
  if (!priceRepository) {
    priceRepository = new InMemoryPriceRepository(
      seedParts.map((part) => part.id),
      mockPriceObservationInputs,
      MOCK_PRICE_DATA_AS_OF,
    );
  }

  return priceRepository;
}
