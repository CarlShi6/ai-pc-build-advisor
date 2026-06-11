import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part, PartAvailability } from "@/types/parts";

export interface RecommendedBuildInput {
  budget?: number;
  targetUseCase?: string[];
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
