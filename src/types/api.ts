import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  PostBuildFeedback,
  PostBuildFeedbackInput,
  SavedBuild,
  SavedBuildSummary,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part, PartAvailability } from "@/types/parts";
import type {
  AffiliateClickEvent,
  CheckoutResult,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  Entitlement,
  UsageStatus,
} from "@/types/monetization";
import type { AdvisorApiRequest, AdvisorApiResponse } from "@/lib/ai/types";
import type {
  ProductSearchQuery,
  ProductSearchResponse,
} from "@/lib/product-search/types";
import type {
  AuthSession,
  SignInRequest,
  SignOutResponse,
  SignUpRequest,
} from "@/lib/persistence/types";

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
  affiliateLinks?: Part["affiliateLinks"];
  note: string;
}

export interface PartsResponse {
  parts: Part[];
}

export type ProductSearchRequest = ProductSearchQuery;

export type ProductsSearchResponse = ProductSearchResponse;

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

export interface UsageStatusResponse {
  usage: UsageStatus;
}

export interface EntitlementStatusResponse {
  entitlement: Entitlement;
}

export interface ConsumeUsageResponse {
  usage: UsageStatus;
  consumed: boolean;
  message?: string;
}

export interface ConsumeReplacementResponse {
  usage: UsageStatus;
  consumed: boolean;
  message?: string;
}

export type CheckoutResponse = CheckoutResult;

export type CreateCheckoutSessionPayload = CreateCheckoutSessionRequest;

export type CreateCheckoutSessionApiResponse = CreateCheckoutSessionResponse;

export interface AffiliateClickRequest {
  event: Omit<AffiliateClickEvent, "clickedAt"> & { clickedAt?: string };
}

export interface AffiliateClickResponse {
  success: boolean;
  event: AffiliateClickEvent;
}

export interface ResetMonetizationResponse {
  success: boolean;
  entitlement: Entitlement;
  usage: UsageStatus;
  message: string;
}

export interface SavedBuildsResponse {
  builds: SavedBuildSummary[];
  limit: number;
}

export interface SaveBuildRequest {
  id?: string;
  name: string;
  build: Build;
  buildNeeds: CustomerNeeds;
}

export interface SaveBuildResponse {
  savedBuild: SavedBuild;
  summary: SavedBuildSummary;
  builds: SavedBuildSummary[];
  limit: number;
}

export interface SavedBuildResponse {
  savedBuild: SavedBuild;
}

export interface PostBuildFeedbackRequest {
  feedback: PostBuildFeedbackInput;
}

export interface PostBuildFeedbackResponse {
  success: boolean;
  feedback: PostBuildFeedback;
  savedBuild: SavedBuild;
  summary: SavedBuildSummary;
  builds: SavedBuildSummary[];
  limit: number;
}

export interface DeleteSavedBuildResponse {
  success: boolean;
  builds: SavedBuildSummary[];
  limit: number;
}

export type AdvisorRequestPayload = AdvisorApiRequest;

export type AdvisorResponsePayload = AdvisorApiResponse;

export interface AuthSessionResponse {
  session: AuthSession;
}

export type SignInPayload = SignInRequest;

export type SignUpPayload = SignUpRequest;

export interface SignInResponse {
  session: AuthSession;
}

export interface SignUpResponse {
  session: AuthSession;
}

export type SignOutApiResponse = SignOutResponse;
