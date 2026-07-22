import type { CustomerNeeds, RecommendedBuildInput } from "@/types/api";
import type { Build } from "@/types/build";
import type { Part, PartCategory } from "@/types/parts";

const PART_CATEGORIES = new Set<PartCategory>([
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "ssd",
  "psu",
  "case",
  "cooler",
  "os",
  "fan",
  "accessory",
]);

const APPEARANCE_PREFERENCES = new Set(["black", "white", "rgb"]);
const EXPERIENCE_LEVELS = new Set(["beginner", "intermediate", "expert"]);
const CPU_BRANDS = new Set(["amd", "intel"]);
const GPU_BRANDS = new Set(["amd", "nvidia"]);

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPart(value: unknown): value is Part {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    typeof value.category === "string" &&
    PART_CATEGORIES.has(value.category as PartCategory) &&
    isNonEmptyString(value.brand) &&
    isNonEmptyString(value.model) &&
    isNonEmptyString(value.displayName) &&
    isFiniteNonNegative(value.price) &&
    isRecord(value.specs) &&
    Array.isArray(value.compatibilityTags) &&
    value.compatibilityTags.every((tag) => typeof tag === "string")
  );
}

export function validateBuild(value: unknown): Build {
  if (!isRecord(value)) {
    throw new ValidationError("Build payload must be an object.");
  }

  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    throw new ValidationError("Build payload is missing its id or name.");
  }

  if (!isFiniteNonNegative(value.budget) || !isFiniteNonNegative(value.totalPrice)) {
    throw new ValidationError("Build budget and total must be finite, non-negative numbers.");
  }

  if (!Array.isArray(value.parts) || value.parts.length === 0 || !value.parts.every(isPart)) {
    throw new ValidationError("Build payload must include valid parts.");
  }

  const partIds = value.parts.map((part) => part.id);
  if (new Set(partIds).size !== partIds.length) {
    throw new ValidationError("Build payload contains duplicate part ids.");
  }

  const selectedCategories = value.parts
    .filter((part) => !["fan", "accessory"].includes(part.category))
    .map((part) => part.category);
  if (new Set(selectedCategories).size !== selectedCategories.length) {
    throw new ValidationError("Build payload contains duplicate primary part categories.");
  }

  const calculatedTotal = value.parts.reduce(
    (total, part) => total + (part.owned ? 0 : part.price),
    0,
  );
  if (Math.abs(calculatedTotal - value.totalPrice) > 0.05) {
    throw new ValidationError("Build total does not match the selected parts.");
  }

  if (
    !Array.isArray(value.targetUseCase) ||
    !value.targetUseCase.every((item) => isNonEmptyString(item, 100)) ||
    !["pass", "warning", "fail"].includes(String(value.compatibilityStatus)) ||
    !Array.isArray(value.compatibilityChecks) ||
    !Array.isArray(value.compatibilityWarnings) ||
    !isRecord(value.confidenceScore) ||
    typeof value.confidenceScore.score !== "number" ||
    !Number.isFinite(value.confidenceScore.score) ||
    value.confidenceScore.score < 0 ||
    value.confidenceScore.score > 100
  ) {
    throw new ValidationError("Build payload contains invalid recommendation metadata.");
  }

  return value as unknown as Build;
}

function optionalEnum(value: unknown, allowed: Set<string>, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ValidationError(`${field} is not supported.`);
  }

  return value;
}

export function normalizeRecommendedBuildInput(value: unknown): RecommendedBuildInput {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    throw new ValidationError("Recommendation input must be an object.");
  }

  const result: RecommendedBuildInput = {};

  if (value.budget !== undefined) {
    if (
      typeof value.budget !== "number" ||
      !Number.isFinite(value.budget) ||
      value.budget < 300 ||
      value.budget > 20_000
    ) {
      throw new ValidationError("Budget must be between $300 and $20,000.");
    }
    result.budget = Math.round(value.budget);
  }

  if (value.targetUseCase !== undefined) {
    if (!Array.isArray(value.targetUseCase) || value.targetUseCase.length > 8) {
      throw new ValidationError("Target use cases must be a list of up to 8 items.");
    }

    const targetUseCase = value.targetUseCase.map((item) =>
      typeof item === "string" ? item.trim() : "",
    );
    if (targetUseCase.some((item) => item.length === 0 || item.length > 100)) {
      throw new ValidationError("Each target use case must be between 1 and 100 characters.");
    }
    result.targetUseCase = Array.from(new Set(targetUseCase));
  }

  result.appearancePreference = optionalEnum(
    value.appearancePreference,
    APPEARANCE_PREFERENCES,
    "Appearance preference",
  ) as CustomerNeeds["appearancePreference"];
  result.experienceLevel = optionalEnum(
    value.experienceLevel,
    EXPERIENCE_LEVELS,
    "Experience level",
  ) as CustomerNeeds["experienceLevel"];
  result.cpuBrandPreference = optionalEnum(
    value.cpuBrandPreference,
    CPU_BRANDS,
    "CPU brand preference",
  ) as CustomerNeeds["cpuBrandPreference"];
  result.gpuBrandPreference = optionalEnum(
    value.gpuBrandPreference,
    GPU_BRANDS,
    "GPU brand preference",
  ) as CustomerNeeds["gpuBrandPreference"];

  return Object.fromEntries(
    Object.entries(result).filter(([, item]) => item !== undefined),
  ) as RecommendedBuildInput;
}

export function validateSafeExternalUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("Purchase link must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("Purchase link must use HTTP or HTTPS.");
  }

  return url.toString();
}
