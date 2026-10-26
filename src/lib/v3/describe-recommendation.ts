import {
  createDraft,
  primarySlots,
  slotCategory,
  slotLabel,
  type BuildDocumentV3,
} from "@/lib/v3/build-document";
import type {
  AppearancePreference,
  CpuBrandPreference,
  GpuBrandPreference,
  RecommendedBuildInput,
} from "@/types/api";
import type { Build } from "@/types/build";

/**
 * EP-06 requirements wizard for the Describe entry. Choices are structured so the existing
 * rule-based recommender (`build-advisor.getRecommendedBuildData`) gets inputs it understands.
 * The free-text description is kept with the draft but is not interpreted.
 */
export const describeUseCases = [
  "1440p gaming",
  "4K gaming",
  "Streaming",
  "Video editing",
  "3D rendering",
  "Local AI",
] as const;
export type DescribeUseCase = (typeof describeUseCases)[number];

export interface DescribeRequirements {
  budget: number;
  useCases: DescribeUseCase[];
  appearance?: AppearancePreference;
  cpuBrand?: CpuBrandPreference;
  gpuBrand?: GpuBrandPreference;
}

export interface DescribeProposal {
  /** Not applied until the user confirms. */
  candidate: BuildDocumentV3;
  /** Price is the seed catalog price, or null when the slot is empty (unknown is not $0). */
  lines: Array<{ slot: string; name: string; price: number | null }>;
  notes: string[];
}

export function recommendationInput(requirements: DescribeRequirements): RecommendedBuildInput {
  return {
    budget: requirements.budget,
    targetUseCase: requirements.useCases.length ? [...requirements.useCases] : undefined,
    appearancePreference: requirements.appearance,
    cpuBrandPreference: requirements.cpuBrand,
    gpuBrandPreference: requirements.gpuBrand,
  };
}

/** States plainly which requirements the recommendation did or could not honor. */
export function recommendationNotes(requirements: DescribeRequirements, build: Build): string[] {
  const notes: string[] = [];
  const byCategory = (category: string) => build.parts.find((part) => part.category === category);
  const caseColor = (
    byCategory("case")?.color ?? String(byCategory("case")?.specs.color ?? "")
  ).toLowerCase();
  if (build.totalPrice > requirements.budget)
    notes.push(
      `Seed total $${build.totalPrice.toLocaleString()} is $${(build.totalPrice - requirements.budget).toLocaleString()} over your $${requirements.budget.toLocaleString()} budget. Swap parts in the Studio to bring it down.`,
    );
  if (requirements.appearance === "white" && !caseColor.includes("white"))
    notes.push(
      `White look not applied: the local catalog has no white case (recommended case: ${caseColor || "color unknown"}).`,
    );
  if (requirements.appearance === "black" && caseColor && !caseColor.includes("black"))
    notes.push(`Black look not fully applied: the recommended case is ${caseColor}.`);
  if (requirements.appearance === "rgb")
    notes.push("RGB look: lighting isn't recorded for catalog parts, so it can't be confirmed.");
  const cpu = byCategory("cpu");
  if (requirements.cpuBrand && cpu && !cpu.brand.toLowerCase().includes(requirements.cpuBrand))
    notes.push(`${requirements.cpuBrand.toUpperCase()} CPU preference not applied (${cpu.brand}).`);
  const gpu = byCategory("gpu");
  if (requirements.gpuBrand && gpu && !gpu.brand.toLowerCase().includes(requirements.gpuBrand))
    notes.push(
      `${requirements.gpuBrand === "amd" ? "AMD" : "NVIDIA"} GPU preference not applied: the recommender doesn't choose GPUs by brand (${gpu.brand}).`,
    );
  if (!requirements.useCases.length)
    notes.push("No use case chosen, so a general-purpose default was used.");
  notes.push(
    "Rule-based picks from the local seed catalog with seed prices, not live offers or benchmarks. Your description isn't analyzed.",
  );
  return notes;
}

/** Turns a recommended Build into a describe draft preview covering the eight slots. */
export function proposeDescribeDraft(
  recommended: Build,
  requirements: DescribeRequirements,
  description: string,
): DescribeProposal {
  const slotParts = primarySlots
    .map((slot) => recommended.parts.find((part) => part.category === slotCategory[slot]))
    .filter((part): part is NonNullable<typeof part> => !!part);
  const candidate = createDraft("describe", {
    name: "Description draft",
    budget: requirements.budget,
    useCases: [...requirements.useCases],
    sourceInput: description.trim() || undefined,
    parts: slotParts,
  });
  const lines = primarySlots.map((slot) => {
    const part = candidate.build.parts.find((item) => item.category === slotCategory[slot]);
    return {
      slot: slotLabel[slot],
      name: part?.displayName ?? "Not chosen",
      price: part?.price ?? null,
    };
  });
  return { candidate, lines, notes: recommendationNotes(requirements, candidate.build) };
}
