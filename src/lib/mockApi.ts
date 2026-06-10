import { categoryLabels, recommendedBuildPartIds, seedParts } from "@/data/seedParts";
import { calculateBuildTotal, deriveCompatibilityStatus, evaluateCompatibility } from "@/lib/compatibility";
import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part, PartCategory } from "@/types/parts";

export interface RecommendedBuildInput {
  budget?: number;
  targetUseCase?: string[];
}

function simulateLatency<T>(data: T, delayMs = 80) {
  return new Promise<T>((resolve) => {
    globalThis.setTimeout(() => resolve(data), delayMs);
  });
}

function normalizeCategory(category: string): PartCategory {
  return category.toLowerCase() as PartCategory;
}

function buildFromParts(parts: Part[], input?: RecommendedBuildInput): Build {
  const buildDraft: Build = {
    id: "build-production-master-pro",
    name: "Production Master Pro",
    targetUseCase: input?.targetUseCase ?? ["4K video editing", "casual gaming"],
    budget: input?.budget ?? 2500,
    totalPrice: calculateBuildTotal(parts),
    parts,
    compatibilityStatus: "pass",
    compatibilityWarnings: [],
  };

  const compatibilityWarnings = evaluateCompatibility(buildDraft);

  return {
    ...buildDraft,
    compatibilityWarnings,
    compatibilityStatus: deriveCompatibilityStatus(compatibilityWarnings),
    totalPrice: calculateBuildTotal(parts),
  };
}

function findPartById(id: string) {
  return seedParts.find((part) => part.id === id);
}

function findPartCategoryById(build: Build, partId: string) {
  return build.parts.find((part) => part.id === partId)?.category;
}

export async function getRecommendedBuild(input?: RecommendedBuildInput): Promise<Build> {
  const selectedParts = Object.entries(recommendedBuildPartIds)
    .map(([, id]) => id)
    .filter(Boolean)
    .map((id) => findPartById(id))
    .filter((part): part is Part => Boolean(part));

  return simulateLatency(buildFromParts(selectedParts, input));
}

export async function getPartsByCategory(category: string): Promise<Part[]> {
  const normalizedCategory = normalizeCategory(category);
  const parts = seedParts
    .filter((part) => part.category === normalizedCategory)
    .sort((left, right) => left.price - right.price);

  return simulateLatency(parts);
}

export async function getCompareParts(ids: string[]): Promise<Part[]> {
  const parts = ids
    .map((id) => findPartById(id))
    .filter((part): part is Part => Boolean(part));

  return simulateLatency(parts);
}

export async function checkCompatibility(build: Build): Promise<CompatibilityWarning[]> {
  return simulateLatency(evaluateCompatibility(build));
}

export async function getCartPreview(build: Build): Promise<CartPreviewItem[]> {
  const items = build.parts.map((part) => ({
    partId: part.id,
    displayName: part.displayName,
    retailer: part.retailer ?? "Partner retailer",
    estimatedPrice: part.price,
    quantity: 1,
    productUrl: part.productUrl,
    searchUrl: part.searchUrl,
    note:
      part.availability === "low_stock"
        ? "Low stock in this mock dataset."
        : part.availability === "out_of_stock"
          ? "Out of stock in this mock dataset."
          : "Ready for store-assisted pre-cart handoff.",
  }));

  return simulateLatency(items);
}

export async function replaceBuildPart(build: Build, replacement: Part): Promise<Build> {
  return simulateLatency(createCandidateBuild(build, replacement));
}

export function createCandidateBuild(build: Build, replacement: Part): Build {
  const nextParts = build.parts.map((part) =>
    part.category === replacement.category ? replacement : part,
  );

  return buildFromParts(nextParts, {
    budget: build.budget,
    targetUseCase: build.targetUseCase,
  });
}

export function getRecommendedReplacementForWarning(build: Build, warning: CompatibilityWarning): Part | null {
  const categories = Array.from(
    new Set(
      warning.affectedPartIds
        .map((partId) => findPartCategoryById(build, partId))
        .filter((category): category is PartCategory => Boolean(category)),
    ),
  );
  const preferredCategory = warning.id.includes("psu") || categories.includes("psu")
    ? "psu"
    : categories[0];

  if (!preferredCategory) {
    return null;
  }

  const currentPart = build.parts.find((part) => part.category === preferredCategory);
  const candidates = seedParts
    .filter((part) => part.category === preferredCategory && part.id !== currentPart?.id)
    .sort((left, right) => left.price - right.price);

  const resolvingCandidate = candidates.find((candidate) => {
    const candidateBuild = createCandidateBuild(build, candidate);
    return !candidateBuild.compatibilityWarnings.some(
      (candidateWarning) => candidateWarning.id === warning.id,
    );
  });

  return resolvingCandidate ?? candidates[0] ?? null;
}

export function getPartSummarySpecs(part: Part) {
  switch (part.category) {
    case "cpu":
      return [
        `${part.specs.cores} cores / ${part.specs.threads} threads`,
        `${part.specs.socket}`,
        `Up to ${part.specs.boostGHz} GHz`,
      ];
    case "gpu":
      return [
        `${part.specs.vramGb}GB VRAM`,
        `${part.specs.powerDrawW}W draw`,
        `${part.specs.performanceTier}`,
      ];
    case "motherboard":
      return [
        `${part.specs.socket} socket`,
        `${part.specs.ramType}`,
        `${part.specs.formFactor}`,
      ];
    case "ram":
      return [
        `${part.specs.capacityGb}GB`,
        `${part.specs.speedMt} MT/s`,
        `${part.specs.ramType}`,
      ];
    case "ssd":
      return [
        `${part.specs.capacityTb}TB`,
        `${part.specs.interface}`,
        `${part.specs.readMb}/${part.specs.writeMb} MB/s`,
      ];
    case "psu":
      return [
        `${part.specs.wattageW}W`,
        `${part.specs.efficiency}`,
        `${part.specs.atxVersion}`,
      ];
    case "case":
      return [
        `${part.specs.style}`,
        `${part.specs.gpuClearanceMm}mm GPU clearance`,
        `${part.specs.radiatorSupportMm}mm radiator support`,
      ];
    case "cooler":
      return part.specs.coolerType === "aio"
        ? [
            `${part.specs.coolerType.toString().toUpperCase()}`,
            `${part.specs.radiatorMm}mm radiator`,
            `Supports around ${part.specs.tdpSupportW}W`,
          ]
        : [
            `${part.specs.coolerType.toString().toUpperCase()}`,
            `${part.specs.heightMm}mm height`,
            `Supports around ${part.specs.tdpSupportW}W`,
          ];
    default:
      return [];
  }
}

export function getPartPowerRequirement(part: Part) {
  if (typeof part.specs.powerDrawW === "number") {
    return `${part.specs.powerDrawW}W`;
  }

  if (typeof part.specs.tdpW === "number") {
    return `${part.specs.tdpW}W`;
  }

  if (typeof part.specs.wattageW === "number") {
    return `${part.specs.wattageW}W supply`;
  }

  return "N/A";
}

export function getCompatibilityNotesForPart(build: Build, part: Part) {
  const matchingWarnings = build.compatibilityWarnings.filter((warning) =>
    warning.affectedPartIds.includes(part.id),
  );

  if (matchingWarnings.length > 0) {
    return matchingWarnings.map((warning) => warning.message);
  }

  return [`Compatible with the current ${build.name} configuration.`];
}

export function getStoreEmployeeSummary(build: Build, cartItems: CartPreviewItem[]): StoreEmployeeSummary {
  const gpu = build.parts.find((part) => part.category === "gpu");
  const cpu = build.parts.find((part) => part.category === "cpu");
  const cheaperGpu = seedParts
    .filter((part) => part.category === "gpu" && gpu && part.price < gpu.price)
    .sort((left, right) => right.price - left.price)[0];
  const upsellGpu = seedParts
    .filter((part) => part.category === "gpu" && gpu && part.price > gpu.price)
    .sort((left, right) => left.price - right.price)[0];
  const preCartReadyCount = cartItems.filter((item) => !item.note?.includes("Out of stock")).length;

  return {
    customerGoal: build.targetUseCase.join(" + "),
    recommendedBuildLogic: `${cpu?.displayName ?? "Selected CPU"} plus ${gpu?.displayName ?? "selected GPU"} delivers the strongest balance for this mock recommendation.`,
    keySellingPoints: [
      cpu?.recommendationReason ?? "Balanced CPU choice",
      gpu?.recommendationReason ?? "Balanced GPU choice",
      `${categoryLabels.ram} and ${categoryLabels.ssd} were chosen to keep creator workflows responsive.`,
    ],
    cheaperAlternative: cheaperGpu
      ? `${cheaperGpu.displayName} saves about $${Math.round((gpu?.price ?? 0) - cheaperGpu.price)} on the graphics budget.`
      : "The selected parts are already near the value floor in this mock dataset.",
    upsellOption: upsellGpu
      ? `${upsellGpu.displayName} is the clearest upsell if the customer wants more graphics headroom.`
      : "No higher-tier upsell is configured in the current mock dataset.",
    compatibilityStatus:
      build.compatibilityStatus === "pass"
        ? "All checks passed."
        : `${build.compatibilityWarnings.length} compatibility item(s) need attention.`,
    preCartStatus: `${preCartReadyCount}/${cartItems.length} items are ready for pre-cart handoff.`,
  };
}
