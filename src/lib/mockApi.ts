import {
  createCandidateBuild,
  getCartPreviewItems,
  getComparePartsData,
  getCompatibilityNotesForPart,
  getOffersForPart,
  getPartPowerRequirement,
  getPartSummarySpecs,
  getPartsByCategoryData,
  getRecommendedBuildData,
  getRecommendedReplacementForWarning,
  getStoreEmployeeSummary,
  recalculateBuild,
} from "@/lib/build-advisor";
import { evaluateCompatibility } from "@/lib/compatibility";
import type { PartOffer, RecommendedBuildInput } from "@/types/api";
import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part } from "@/types/parts";

function simulateLatency<T>(data: T, delayMs = 80) {
  return new Promise<T>((resolve) => {
    globalThis.setTimeout(() => resolve(data), delayMs);
  });
}

export async function getRecommendedBuild(input?: RecommendedBuildInput): Promise<Build> {
  return simulateLatency(getRecommendedBuildData(input));
}

export async function getPartsByCategory(category: string): Promise<Part[]> {
  return simulateLatency(getPartsByCategoryData(category));
}

export async function getCompareParts(ids: string[]): Promise<Part[]> {
  return simulateLatency(getComparePartsData(ids));
}

export async function checkCompatibility(build: Build): Promise<CompatibilityWarning[]> {
  return simulateLatency(evaluateCompatibility(build));
}

export async function getCartPreview(build: Build): Promise<CartPreviewItem[]> {
  return simulateLatency(getCartPreviewItems(build));
}

export async function replaceBuildPart(build: Build, replacement: Part): Promise<Build> {
  return simulateLatency(createCandidateBuild(build, replacement));
}

export async function getOffers(partId: string): Promise<PartOffer[]> {
  return simulateLatency(getOffersForPart(partId));
}

export { createCandidateBuild, getCompatibilityNotesForPart, getPartPowerRequirement, getPartSummarySpecs, getRecommendedReplacementForWarning, getStoreEmployeeSummary, recalculateBuild };
