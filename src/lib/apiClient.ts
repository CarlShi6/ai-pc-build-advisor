import { getRecommendedReplacementForWarning } from "@/lib/build-advisor";
import type {
  CartPreviewResponse,
  CompatibilityCheckResponse,
  ComparePartsResponse,
  PartOffer,
  OffersResponse,
  PartsResponse,
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
import type { Build, SavedBuild, SavedBuildSummary, StoreEmployeeSummary } from "@/types/build";
import type { AffiliateClickEvent, Entitlement, UsageStatus } from "@/types/monetization";
import type { AuthSession } from "@/lib/persistence/types";
import type { Part } from "@/types/parts";

class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "The request could not be completed.";

    throw new ApiClientError(message, response.status);
  }

  return payload as T;
}

export async function getRecommendedBuild(input?: RecommendedBuildInput): Promise<Build> {
  const response = await requestJson<RecommendBuildResponse>("/api/build/recommend", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });

  return response.build;
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
  const response = await requestJson<CompatibilityCheckResponse>("/api/build/compatibility-check", {
    method: "POST",
    body: JSON.stringify({ build }),
  });

  return response.build;
}

export async function getCartPreview(build: Build): Promise<CartPreviewResponse> {
  return requestJson<CartPreviewResponse>("/api/cart/preview", {
    method: "POST",
    body: JSON.stringify({ build }),
  });
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

export async function askAdvisor(
  payload: AdvisorRequestPayload,
): Promise<AdvisorResponsePayload> {
  return requestJson<AdvisorResponsePayload>("/api/ai/advisor", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSavedBuilds(): Promise<{ builds: SavedBuildSummary[]; limit: number }> {
  return requestJson<SavedBuildsResponse>("/api/builds/saved");
}

export async function saveCurrentBuild(
  payload: SaveBuildRequest,
): Promise<SaveBuildResponse> {
  return requestJson<SaveBuildResponse>("/api/builds/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSavedBuild(id: string): Promise<SavedBuild> {
  const response = await requestJson<SavedBuildResponse>(
    `/api/builds/${encodeURIComponent(id)}`,
  );

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
    parts: build.parts.map((part) =>
      part.category === replacement.category ? replacement : part,
    ),
  };

  const nextBuild = await checkCompatibility(draftBuild);
  const cartPreview = await getCartPreview(nextBuild);

  return {
    build: nextBuild,
    employeeSummary: cartPreview.employeeSummary,
    cartPreview: cartPreview.items,
  };
}

export { ApiClientError, getRecommendedReplacementForWarning };
