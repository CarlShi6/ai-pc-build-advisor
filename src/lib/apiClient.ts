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
} from "@/types/api";
import type { Build, StoreEmployeeSummary } from "@/types/build";
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
