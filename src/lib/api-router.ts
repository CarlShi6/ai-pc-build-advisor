import {
  getCartPreviewItems,
  getComparePartsData,
  getOffersForPart,
  getPartsByCategoryData,
  getRecommendedBuildData,
  getStoreEmployeeSummary,
  recalculateBuild,
} from "@/lib/build-advisor";
import type {
  CartPreviewRequest,
  CartPreviewResponse,
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  ComparePartsResponse,
  OffersResponse,
  PartsResponse,
  RecommendBuildResponse,
  RecommendedBuildInput,
} from "@/types/api";

class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function methodNotAllowed(allowedMethods: string[]) {
  return jsonResponse(
    { message: `Method not allowed. Use ${allowedMethods.join(" or ")}.` },
    {
      status: 405,
      headers: { Allow: allowedMethods.join(", ") },
    },
  );
}

function normalizeApiPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function requireSearchParam(url: URL, key: string) {
  const value = url.searchParams.get(key);

  if (!value) {
    throw new ApiRouteError(400, `Missing required query parameter: ${key}.`);
  }

  return value;
}

function getIdsFromSearchParams(url: URL) {
  const rawIds = url.searchParams.getAll("ids").flatMap((value) =>
    value.split(",").map((id) => id.trim()).filter(Boolean),
  );

  if (rawIds.length === 0) {
    throw new ApiRouteError(400, "Provide one or more part ids in the ids query parameter.");
  }

  return rawIds;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiRouteError(400, "Request body must be valid JSON.");
  }
}

export async function handleInternalApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = normalizeApiPath(url.pathname);

  if (!pathname.startsWith("/api")) {
    return null;
  }

  try {
    if (pathname === "/api/parts") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const category = requireSearchParam(url, "category");
      const payload: PartsResponse = { parts: getPartsByCategoryData(category) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/parts/compare") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const ids = getIdsFromSearchParams(url);
      const payload: ComparePartsResponse = { parts: getComparePartsData(ids) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/build/recommend") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<RecommendedBuildInput>(request);
      const payload: RecommendBuildResponse = { build: getRecommendedBuildData(input) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/build/compatibility-check") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const { build } = await readJson<CompatibilityCheckRequest>(request);

      if (!build) {
        throw new ApiRouteError(400, "Request body must include a build.");
      }

      const nextBuild = recalculateBuild(build);
      const payload: CompatibilityCheckResponse = {
        build: nextBuild,
        warnings: nextBuild.compatibilityWarnings,
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/offers") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const partId = requireSearchParam(url, "partId");
      const payload: OffersResponse = {
        partId,
        offers: getOffersForPart(partId),
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/cart/preview") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const { build } = await readJson<CartPreviewRequest>(request);

      if (!build) {
        throw new ApiRouteError(400, "Request body must include a build.");
      }

      const nextBuild = recalculateBuild(build);
      const items = getCartPreviewItems(nextBuild);
      const payload: CartPreviewResponse = {
        items,
        employeeSummary: getStoreEmployeeSummary(nextBuild, items),
      };
      return jsonResponse(payload);
    }

    return jsonResponse({ message: "API endpoint not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return jsonResponse({ message: error.message }, { status: error.status });
    }

    console.error(error);
    return jsonResponse(
      { message: "The internal API could not complete this request. Please try again." },
      { status: 500 },
    );
  }
}
