import { categoryLabels, recommendedBuildPartIds, seedParts } from "@/data/seedParts";
import { calculateBuildTotal, deriveCompatibilityStatus, evaluateCompatibility } from "@/lib/compatibility";
import type { RecommendedBuildInput, PartOffer } from "@/types/api";
import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part, PartAvailability, PartCategory } from "@/types/parts";

function normalizeCategory(category: string): PartCategory {
  return category.toLowerCase() as PartCategory;
}

function pickPart(id: string) {
  const part = findPartById(id);

  if (!part) {
    throw new Error(`Missing seed part: ${id}`);
  }

  return part;
}

function buildNameFromInput(input?: RecommendedBuildInput) {
  const targetUseCase = input?.targetUseCase ?? [];
  const wantsAi = targetUseCase.some((item) => item.toLowerCase().includes("ai"));
  const wantsRendering = targetUseCase.some((item) => item.toLowerCase().includes("3d"));
  const wantsEditing = targetUseCase.some((item) => item.toLowerCase().includes("video editing"));
  const wants2K = targetUseCase.some((item) => item.toLowerCase().includes("2k"));
  const isBeginner = input?.experienceLevel === "beginner";

  if (wantsAi || wantsRendering) {
    return "AI Workstation Max";
  }

  if (wantsEditing) {
    return "Creator Studio Build";
  }

  if (wants2K) {
    return "2K Gaming Value Build";
  }

  if (isBeginner) {
    return "Easy Recommendation Build";
  }

  return "Production Master Pro";
}

function buildFromParts(parts: Part[], input?: RecommendedBuildInput): Build {
  const buildDraft: Build = {
    id: "build-production-master-pro",
    name: buildNameFromInput(input),
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

export function findPartById(id: string) {
  return seedParts.find((part) => part.id === id);
}

function findPartCategoryById(build: Build, partId: string) {
  return build.parts.find((part) => part.id === partId)?.category;
}

export function getRecommendedBuildData(input?: RecommendedBuildInput): Build {
  const budget = input?.budget ?? 2500;
  const targetUseCase = (input?.targetUseCase ?? []).map((item) => item.toLowerCase());
  const wants2K = targetUseCase.some((item) => item.includes("2k") || item.includes("1440p"));
  const wants4K = targetUseCase.some((item) => item.includes("4k"));
  const wantsEditing = targetUseCase.some((item) => item.includes("video editing"));
  const wantsStreaming = targetUseCase.some((item) => item.includes("stream"));
  const wantsAi = targetUseCase.some((item) => item.includes("ai"));
  const wantsRendering = targetUseCase.some((item) => item.includes("3d"));
  const wantsGaming = targetUseCase.some((item) => item.includes("gaming"));
  const creatorHeavy = wantsEditing || wantsAi || wantsRendering;
  const budgetTight = budget <= 2200;
  const budgetFlexible = budget >= 3200;
  const prefersAmdCpu = input?.cpuBrandPreference === "amd";
  const prefersIntelCpu = input?.cpuBrandPreference === "intel";
  const prefersBlack = input?.appearancePreference === "black";
  const prefersRgb = input?.appearancePreference === "rgb";

  const cpuId = prefersAmdCpu
    ? "cpu-r9-7950x3d"
    : wants2K && wantsGaming && !creatorHeavy && !wantsStreaming && !wants4K
      ? "cpu-i7-14700k"
    : prefersIntelCpu && !creatorHeavy && budgetTight
      ? "cpu-i7-14700k"
      : creatorHeavy || wantsStreaming || wants4K || budget >= 2500
        ? "cpu-i9-14900k"
        : "cpu-i7-14700k";

  const gpuId = wantsAi || wantsRendering || (budgetFlexible && wants4K)
    ? "gpu-rtx-4090"
    : wants2K && !creatorHeavy
      ? "gpu-rtx-4070-ti-super"
      : budgetTight && wantsGaming && !wants4K
        ? "gpu-rtx-4070-ti-super"
        : "gpu-rtx-4080-super";

  const motherboardId = cpuId === "cpu-r9-7950x3d"
    ? "mobo-x670e-hero"
    : budgetTight
      ? "mobo-b760-aorus"
      : "mobo-z790-hero";

  const ramId = budgetTight && !creatorHeavy
    ? "ram-gskill-32-ddr5-6000"
    : budget < 2600
      ? "ram-kingston-64-ddr5-6000"
      : "ram-corsair-64-ddr5-6400";

  const ssdId = wantsAi || wantsRendering || budgetFlexible
    ? "ssd-p44-pro-4tb"
    : budgetTight
      ? "ssd-sn850x-2tb"
      : "ssd-990-pro-2tb";

  const psuId = gpuId === "gpu-rtx-4090"
    ? "psu-rm1000x"
    : gpuId === "gpu-rtx-4070-ti-super" && cpuId === "cpu-i7-14700k" && budgetTight
      ? "psu-focus-750"
      : "psu-rm850x";

  const caseId = budgetTight && !prefersBlack && !prefersRgb
    ? "case-nzxt-h5-flow"
    : creatorHeavy || wantsRendering
      ? "case-fractal-north-xl"
      : "case-o11-evo";

  const coolerId = cpuId === "cpu-i7-14700k" && budgetTight
    ? "cooler-pa120"
    : creatorHeavy || cpuId === "cpu-i9-14900k" || prefersRgb
      ? "cooler-ls720"
      : "cooler-nh-d15";

  const selection = {
    ...recommendedBuildPartIds,
    cpu: cpuId,
    gpu: gpuId,
    motherboard: motherboardId,
    ram: ramId,
    ssd: ssdId,
    psu: psuId,
    case: caseId,
    cooler: coolerId,
  };

  const selectedParts = Object.entries(selection)
    .map(([, id]) => id)
    .filter(Boolean)
    .map((id) => pickPart(id));

  return buildFromParts(selectedParts, input);
}

export function getPartsByCategoryData(category: string): Part[] {
  const normalizedCategory = normalizeCategory(category);

  return seedParts
    .filter((part) => part.category === normalizedCategory)
    .sort((left, right) => left.price - right.price);
}

export function getComparePartsData(ids: string[]): Part[] {
  return ids
    .map((id) => findPartById(id))
    .filter((part): part is Part => Boolean(part));
}

export function recalculateBuild(build: Build): Build {
  return buildFromParts(build.parts, {
    budget: build.budget,
    targetUseCase: build.targetUseCase,
  });
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

function getAvailabilityNote(availability?: PartAvailability) {
  if (availability === "low_stock") {
    return "Low stock in this mock dataset.";
  }

  if (availability === "out_of_stock") {
    return "Out of stock in this mock dataset.";
  }

  return "Ready for store-assisted pre-cart handoff.";
}

export function getCartPreviewItems(build: Build): CartPreviewItem[] {
  return build.parts.map((part) => ({
    partId: part.id,
    displayName: part.displayName,
    retailer: part.retailer ?? "Partner retailer",
    estimatedPrice: part.price,
    quantity: 1,
    productUrl: part.productUrl,
    searchUrl: part.searchUrl,
    note: getAvailabilityNote(part.availability),
  }));
}

export function getOffersForPart(partId: string): PartOffer[] {
  const part = findPartById(partId);

  if (!part) {
    return [];
  }

  return [
    {
      partId: part.id,
      retailer: part.retailer ?? "Partner retailer",
      estimatedPrice: part.price,
      availability: part.availability ?? "unknown",
      productUrl: part.productUrl,
      searchUrl: part.searchUrl,
      note: getAvailabilityNote(part.availability),
    },
  ];
}

export function getRecommendedReplacementForWarning(
  build: Build,
  warning: CompatibilityWarning,
): Part | null {
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

export function getStoreEmployeeSummary(
  build: Build,
  cartItems: CartPreviewItem[],
): StoreEmployeeSummary {
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
