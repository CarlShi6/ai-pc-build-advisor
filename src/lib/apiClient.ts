import { getRecommendedReplacementForWarning } from "@/lib/build-advisor";
import type {
  CartPreviewResponse,
  CompatibilityCheckResponse,
  ComparePartsResponse,
  PartOffer,
  OffersResponse,
  PartsResponse,
  PartPriceHistoryResponse,
  PostBuildFeedbackRequest,
  PostBuildFeedbackResponse,
  RecommendBuildResponse,
  RecommendedBuildInput,
  UsageStatusResponse,
  EntitlementStatusResponse,
  ConsumeUsageResponse,
  CheckoutResponse,
  CreateCheckoutSessionApiResponse,
  CreateCheckoutSessionPayload,
  ConsumeReplacementResponse,
  AffiliateClickResponse,
  ResetMonetizationResponse,
  AdvisorRequestPayload,
  AdvisorResponsePayload,
  DeleteSavedBuildResponse,
  AuthSessionResponse,
  ProductSearchRequest,
  ProductsSearchResponse,
  SaveBuildRequest,
  SaveBuildResponse,
  SavedBuildResponse,
  SavedBuildsResponse,
  SignInPayload,
  SignInResponse,
  SignOutApiResponse,
  SignUpPayload,
  SignUpResponse,
} from "@/types/api";
import type { PriceHistoryRange } from "@/types/pricing";
import type { CurrentOfferApiResponse } from "@/types/current-offer";
import type {
  Build,
  PostBuildFeedbackInput,
  SavedBuild,
  SavedBuildSummary,
  StoreEmployeeSummary,
} from "@/types/build";
import type { AffiliateClickEvent, Entitlement, UsageStatus } from "@/types/monetization";
import type { AuthSession } from "@/lib/persistence/types";
import type { Part } from "@/types/parts";
import { validateBuild } from "@/lib/validation";

const API_REQUEST_TIMEOUT_MS = 12_000;
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function getPartPriceHistory(partId: string, range: PriceHistoryRange = "30d") {
  return requestJson<PartPriceHistoryResponse>(
    `/api/parts/${encodeURIComponent(partId)}/prices?range=${encodeURIComponent(range)}`,
  );
}

export function getPartCurrentOffer(partId: string) {
  return requestJson<CurrentOfferApiResponse>(
    `/api/parts/${encodeURIComponent(partId)}/current-offer`,
  );
}

export class ApiClientError extends Error {
  status: number;
  retryable: boolean;
  code?: string;

  constructor(
    message: string,
    status: number,
    retryable = TRANSIENT_STATUS_CODES.has(status),
    code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

type RequestOptions = {
  retries?: number;
  timeoutMs?: number;
};

function waitForRetry(attempt: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 150 * (attempt + 1)));
}

async function requestJson<T>(
  input: string,
  init?: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  const retries = options.retries ?? (init?.method === undefined || init.method === "GET" ? 1 : 0);
  let attempt = 0;

  while (true) {
    try {
      return await requestJsonOnce<T>(input, init, options.timeoutMs ?? API_REQUEST_TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof ApiClientError) || !error.retryable || attempt >= retries) {
        throw error;
      }

      await waitForRetry(attempt);
      attempt += 1;
    }
  }
}

async function requestJsonOnce<T>(input: string, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("The request timed out. Please try again.", 0, true);
    }

    throw new ApiClientError(
      "The service could not be reached. Check your connection and retry.",
      0,
      true,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const topLevelMessage =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : null;
    const nestedError =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object"
        ? payload.error
        : null;
    const message =
      nestedError && "message" in nestedError
        ? String(nestedError.message)
        : (topLevelMessage ?? "The request could not be completed.");
    const code = nestedError && "code" in nestedError ? String(nestedError.code) : undefined;

    throw new ApiClientError(message, response.status, undefined, code);
  }

  return payload as T;
}

export async function getRecommendedBuild(input?: RecommendedBuildInput): Promise<Build> {
  const response = await requestJson<RecommendBuildResponse>(
    "/api/build/recommend",
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
    { retries: 1 },
  );

  return validateBuild(response.build);
}

export async function getAuthSession(): Promise<AuthSession> {
  const response = await requestJson<AuthSessionResponse>("/api/auth/session");

  return response.session;
}

export async function signIn(payload: SignInPayload): Promise<AuthSession> {
  const response = await requestJson<SignInResponse>("/api/auth/sign-in", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.session;
}

export async function signUp(payload: SignUpPayload): Promise<AuthSession> {
  const response = await requestJson<SignUpResponse>("/api/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.session;
}

export async function signOut(): Promise<SignOutApiResponse> {
  return requestJson<SignOutApiResponse>("/api/auth/sign-out", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getPartsByCategory(category: string): Promise<Part[]> {
  const response = await requestJson<PartsResponse>(
    `/api/parts?category=${encodeURIComponent(category)}`,
  );

  return response.parts;
}

export async function getCompareParts(ids: string[]): Promise<Part[]> {
  const response = await requestJson<ComparePartsResponse>(
    `/api/parts/compare?ids=${encodeURIComponent(ids.join(","))}`,
  );

  return response.parts;
}

export async function searchProducts(
  payload: ProductSearchRequest,
): Promise<ProductsSearchResponse> {
  return requestJson<ProductsSearchResponse>("/api/products/search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkCompatibility(build: Build): Promise<Build> {
  const response = await requestJson<CompatibilityCheckResponse>(
    "/api/build/compatibility-check",
    {
      method: "POST",
      body: JSON.stringify({ build }),
    },
    { retries: 1 },
  );

  return validateBuild(response.build);
}

export async function getCartPreview(build: Build): Promise<CartPreviewResponse> {
  return requestJson<CartPreviewResponse>(
    "/api/cart/preview",
    {
      method: "POST",
      body: JSON.stringify({ build }),
    },
    { retries: 1 },
  );
}

export async function getOffers(partId: string): Promise<PartOffer[]> {
  const response = await requestJson<OffersResponse>(
    `/api/offers?partId=${encodeURIComponent(partId)}`,
  );

  return response.offers;
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const response = await requestJson<UsageStatusResponse>("/api/usage/status");

  return response.usage;
}

export async function consumeAiUsage(): Promise<ConsumeUsageResponse> {
  try {
    return await requestJson<ConsumeUsageResponse>("/api/usage/consume", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 429) {
      const usage = await getUsageStatus();
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free advisor questions for today. Build Pro unlocks 50 AI questions per build.",
      };
    }

    throw error;
  }
}

export async function consumeReplacementUsage(): Promise<ConsumeReplacementResponse> {
  try {
    return await requestJson<ConsumeReplacementResponse>("/api/usage/replacement/consume", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 429) {
      const usage = await getUsageStatus();
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free hardware replacements for this build. Build Pro unlocks 25 replacements.",
      };
    }

    throw error;
  }
}

export async function getEntitlementStatus(): Promise<Entitlement> {
  const response = await requestJson<EntitlementStatusResponse>("/api/entitlement/status");

  return response.entitlement;
}

export async function mockUpgradeToPro(): Promise<CheckoutResponse> {
  return requestJson<CheckoutResponse>("/api/checkout/mock-upgrade", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function createCheckoutSession(
  payload: CreateCheckoutSessionPayload,
): Promise<CreateCheckoutSessionApiResponse> {
  return requestJson<CreateCheckoutSessionApiResponse>("/api/checkout/create-session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function trackAffiliateClick(
  event: Omit<AffiliateClickEvent, "clickedAt"> & { clickedAt?: string },
): Promise<AffiliateClickEvent | null> {
  try {
    const response = await requestJson<AffiliateClickResponse>("/api/affiliate/click", {
      method: "POST",
      body: JSON.stringify({ event }),
    });

    return response.event;
  } catch {
    return null;
  }
}

export async function resetMockMonetizationState(): Promise<ResetMonetizationResponse> {
  return requestJson<ResetMonetizationResponse>("/api/monetization/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function askAdvisor(payload: AdvisorRequestPayload): Promise<AdvisorResponsePayload> {
  return requestJson<AdvisorResponsePayload>("/api/ai/advisor", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSavedBuilds(): Promise<{ builds: SavedBuildSummary[]; limit: number }> {
  return requestJson<SavedBuildsResponse>("/api/builds/saved");
}

export async function saveCurrentBuild(payload: SaveBuildRequest): Promise<SaveBuildResponse> {
  return requestJson<SaveBuildResponse>("/api/builds/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSavedBuild(id: string): Promise<SavedBuild> {
  const response = await requestJson<SavedBuildResponse>(`/api/builds/${encodeURIComponent(id)}`);

  return response.savedBuild;
}

export async function deleteSavedBuild(
  id: string,
): Promise<{ builds: SavedBuildSummary[]; limit: number }> {
  const response = await requestJson<DeleteSavedBuildResponse>(
    `/api/builds/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  return {
    builds: response.builds,
    limit: response.limit,
  };
}

export async function savePostBuildFeedback(
  feedback: PostBuildFeedbackInput,
): Promise<PostBuildFeedbackResponse> {
  const payload: PostBuildFeedbackRequest = { feedback };

  return requestJson<PostBuildFeedbackResponse>("/api/builds/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function replaceBuildPart(
  build: Build,
  replacement: Part,
): Promise<{
  build: Build;
  employeeSummary: StoreEmployeeSummary;
  cartPreview: CartPreviewResponse["items"];
}> {
  const draftBuild: Build = {
    ...build,
    parts: build.parts.map((part) => (part.category === replacement.category ? replacement : part)),
  };

  const nextBuild = await checkCompatibility(draftBuild);
  const cartPreview = await getCartPreview(nextBuild);

  return {
    build: nextBuild,
    employeeSummary: cartPreview.employeeSummary,
    cartPreview: cartPreview.items,
  };
}

export { getRecommendedReplacementForWarning };
