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
  ConsumeReplacementResponse,
  AffiliateClickResponse,
  ResetMonetizationResponse,
  AdvisorRequestPayload,
  AdvisorResponsePayload,
} from "@/types/api";
import type { Build, StoreEmployeeSummary } from "@/types/build";
import type { AffiliateClickEvent, Entitlement, UsageStatus } from "@/types/monetization";
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
        message: "You have used your included AI questions for this plan.",
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
        message: "You have used your included hardware replacements for this build.",
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
