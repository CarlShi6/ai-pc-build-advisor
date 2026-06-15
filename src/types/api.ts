import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part, PartAvailability } from "@/types/parts";

export type AppearancePreference = "black" | "white" | "rgb";
export type ExperienceLevel = "beginner" | "intermediate" | "expert";
export type CpuBrandPreference = "amd" | "intel";
export type GpuBrandPreference = "amd" | "nvidia";

export interface CustomerNeeds {
  budget?: number;
  targetUseCase?: string[];
  appearancePreference?: AppearancePreference;
  experienceLevel?: ExperienceLevel;
  cpuBrandPreference?: CpuBrandPreference;
  gpuBrandPreference?: GpuBrandPreference;
}

export interface RecommendedBuildInput {
  budget?: number;
  targetUseCase?: string[];
  appearancePreference?: AppearancePreference;
  experienceLevel?: ExperienceLevel;
  cpuBrandPreference?: CpuBrandPreference;
  gpuBrandPreference?: GpuBrandPreference;
}

export interface PartOffer {
  partId: string;
  retailer: string;
  estimatedPrice: number;
  availability: PartAvailability;
  productUrl?: string;
  searchUrl?: string;
  note: string;
}

export interface PartsResponse {
  parts: Part[];
}

export interface ComparePartsResponse {
  parts: Part[];
}

export interface RecommendBuildResponse {
  build: Build;
}

export interface CompatibilityCheckRequest {
  build: Build;
}

export interface CompatibilityCheckResponse {
  build: Build;
  warnings: CompatibilityWarning[];
}

export interface OffersResponse {
  partId: string;
  offers: PartOffer[];
}

export interface CartPreviewRequest {
  build: Build;
}

export interface CartPreviewResponse {
  items: CartPreviewItem[];
  employeeSummary: StoreEmployeeSummary;
}
