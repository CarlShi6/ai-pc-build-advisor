import {
  calculateBuildConfidenceScore,
  calculateBuildTotal,
  deriveCompatibilityStatus,
  evaluateCompatibilityRules,
  getCompatibilityWarnings,
} from "@/lib/compatibility";
import type { Build } from "@/types/build";
import type { Part, PartAvailability } from "@/types/parts";

export type DataSourceType =
  | "seed"
  | "mock"
  | "provider"
  | "retailer"
  | "manufacturer"
  | "estimated"
  | "derived"
  | "unknown";

export type DataFreshness = "fresh" | "stale" | "unknown";
export type DataConfidence = "verified" | "calculated" | "estimated" | "incomplete" | "unknown";

export interface DataTrust {
  source: DataSourceType;
  freshness: DataFreshness;
  confidence: DataConfidence;
  fetchedAt?: string;
  expiresAt?: string;
  disclosure?: string;
}

export interface TrustedValue<T> {
  value: T | null;
  trust: DataTrust;
}

const emptyConfidence = {
  score: 0,
  label: "Low" as const,
  summary: "Compatibility rules have not run yet.",
  passCount: 0,
  warningCount: 0,
  failCount: 0,
};

export function isSafeExternalUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function trustForPart(part: Part): DataTrust {
  const source: DataSourceType = part.source === "mock_retailer" || part.source === "external_placeholder"
    ? "mock"
    : "seed";
  const parsed = part.lastUpdated ? Date.parse(part.lastUpdated) : Number.NaN;
  const stale = Number.isFinite(parsed) && Date.now() - parsed > 1000 * 60 * 60 * 24;
  return {
    source,
    freshness: Number.isFinite(parsed) ? (stale ? "stale" : "fresh") : "unknown",
    confidence: source === "seed" ? "incomplete" : "unknown",
    fetchedAt: part.lastUpdated,
    disclosure: source === "seed" ? "Seed catalog data, not a live retailer quote." : "Mock catalog data.",
  };
}

export function trustedPartPrice(part: Part): TrustedValue<number> {
  const value = Number.isFinite(part.price) ? part.price : null;
  return { value, trust: { ...trustForPart(part), confidence: value === null ? "unknown" : "incomplete" } };
}

export function trustedAvailability(part: Part): TrustedValue<PartAvailability> {
  const value = part.stockStatus ?? part.availability ?? "unknown";
  return { value, trust: trustForPart(part) };
}

export function recalculateBuild(build: Build, parts: Part[] = build.parts): Build {
  const draft: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityStatus: "pass",
    compatibilityChecks: [],
    compatibilityWarnings: [],
    confidenceScore: emptyConfidence,
  };
  const compatibilityChecks = evaluateCompatibilityRules(draft);
  return {
    ...draft,
    compatibilityChecks,
    compatibilityWarnings: getCompatibilityWarnings(compatibilityChecks),
    compatibilityStatus: deriveCompatibilityStatus(compatibilityChecks),
    confidenceScore: calculateBuildConfidenceScore(compatibilityChecks),
  };
}

export function createSeedBuild(parts: Part[], budget = 2500): Build {
  return recalculateBuild({
    id: "decision-workspace-seed",
    name: "Creator Studio Build",
    targetUseCase: ["4K video editing", "casual gaming"],
    budget,
    totalPrice: 0,
    parts,
    compatibilityStatus: "pass",
    compatibilityChecks: [],
    compatibilityWarnings: [],
    confidenceScore: emptyConfidence,
    recommendationSummary: "Seed build for evaluating the decision workspace without live providers.",
  });
}

export function replaceBuildPartLocally(build: Build, currentId: string, replacement: Part): Build {
  const current = build.parts.find((part) => part.id === currentId);
  if (!current) throw new Error("The current part is no longer in this build.");
  if (current.category !== replacement.category) throw new Error("Replacement category does not match the selected component.");
  const nextParts = build.parts.map((part) => part.id === currentId ? replacement : part);
  return recalculateBuild(build, nextParts);
}

export function estimateBuildPower(build: Build): TrustedValue<number> {
  const cpu = build.parts.find((part) => part.category === "cpu")?.specs.tdpW;
  const gpu = build.parts.find((part) => part.category === "gpu")?.specs.powerDrawW;
  if (typeof cpu !== "number" || typeof gpu !== "number") {
    return { value: null, trust: { source: "derived", freshness: "unknown", confidence: "incomplete", disclosure: "CPU or GPU power data is missing." } };
  }
  return { value: cpu + gpu + 120, trust: { source: "estimated", freshness: "unknown", confidence: "estimated", disclosure: "CPU and GPU draw plus a 120W system allowance." } };
}

export function getValidatedPurchaseUrl(part: Part) {
  const candidate = part.purchaseUrl ?? part.affiliateLinks?.find((link) => isSafeExternalUrl(link.url))?.url;
  return isSafeExternalUrl(candidate) ? candidate : null;
}

export function getValidatedOfficialUrl(part: Part) {
  return isSafeExternalUrl(part.productUrl) && !part.productUrl?.includes("example.com") ? part.productUrl! : null;
}
