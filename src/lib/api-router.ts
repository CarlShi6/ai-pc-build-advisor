import {
  getCartPreviewItems,
  getComparePartsData,
  getOffersForPart,
  getPartsByCategoryData,
  getRecommendedBuildData,
  getStoreEmployeeSummary,
  recalculateBuild,
} from "@/lib/build-advisor";
import { BUILD_PRO_PLAN, FREE_PLAN } from "@/lib/monetization";
import type {
  AffiliateClickRequest,
  AffiliateClickResponse,
  CartPreviewRequest,
  CartPreviewResponse,
  CheckoutResponse,
  ConsumeUsageResponse,
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  ComparePartsResponse,
  EntitlementStatusResponse,
  OffersResponse,
  PartsResponse,
  RecommendBuildResponse,
  RecommendedBuildInput,
  ResetMonetizationResponse,
  UsageStatusResponse,
} from "@/types/api";
import type { AffiliateClickEvent, Entitlement, PlanType, UsageStatus } from "@/types/monetization";

class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

const MOCK_USER_ID = "mock-user";
const MOCK_BUILD_ID = "mock-build";

type MockMonetizationState = {
  entitlement: Entitlement;
  aiQuestionsUsedToday: number;
  aiQuestionsUsedForBuild: number;
  affiliateClicks: AffiliateClickEvent[];
};

const mockState: MockMonetizationState = {
  entitlement: {
    userId: MOCK_USER_ID,
    plan: "free",
    active: true,
    startedAt: new Date().toISOString(),
  },
  aiQuestionsUsedToday: 0,
  aiQuestionsUsedForBuild: 0,
  affiliateClicks: [],
};

function createFreeEntitlement(): Entitlement {
  return {
    userId: MOCK_USER_ID,
    plan: "free",
    active: true,
    startedAt: new Date().toISOString(),
  };
}

function resetMockMonetizationState() {
  mockState.entitlement = createFreeEntitlement();
  mockState.aiQuestionsUsedToday = 0;
  mockState.aiQuestionsUsedForBuild = 0;
  mockState.affiliateClicks = [];
}

function getCurrentPlan(): PlanType {
  return mockState.entitlement.active ? mockState.entitlement.plan : "free";
}

function getUsageStatus(): UsageStatus {
  const plan = getCurrentPlan();

  if (plan === "build_pro") {
    const limit = BUILD_PRO_PLAN.aiQuestionsPerBuild ?? 50;
    const remaining = Math.max(0, limit - mockState.aiQuestionsUsedForBuild);

    return {
      userId: MOCK_USER_ID,
      plan,
      aiQuestionsUsedToday: mockState.aiQuestionsUsedToday,
      aiQuestionsUsedForBuild: mockState.aiQuestionsUsedForBuild,
      aiQuestionsLimitForBuild: limit,
      remainingAiQuestions: remaining,
      canAskAiQuestion: remaining > 0,
    };
  }

  const limit = FREE_PLAN.aiQuestionsPerDay ?? 5;
  const remaining = Math.max(0, limit - mockState.aiQuestionsUsedToday);

  return {
    userId: MOCK_USER_ID,
    plan,
    aiQuestionsUsedToday: mockState.aiQuestionsUsedToday,
    aiQuestionsLimitToday: limit,
    remainingAiQuestions: remaining,
    canAskAiQuestion: remaining > 0,
  };
}

function consumeAiUsage(): ConsumeUsageResponse {
  const usage = getUsageStatus();

  if (!usage.canAskAiQuestion) {
    return {
      usage,
      consumed: false,
      message: "You have used your included AI questions for this plan.",
    };
  }

  if (usage.plan === "build_pro") {
    mockState.aiQuestionsUsedForBuild += 1;
  } else {
    mockState.aiQuestionsUsedToday += 1;
  }

  return {
    usage: getUsageStatus(),
    consumed: true,
  };
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

    if (pathname === "/api/usage/status") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const payload: UsageStatusResponse = { usage: getUsageStatus() };
      return jsonResponse(payload);
    }

    if (pathname === "/api/usage/consume") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const payload = consumeAiUsage();
      return jsonResponse(payload, { status: payload.consumed ? 200 : 429 });
    }

    if (pathname === "/api/entitlement/status") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const payload: EntitlementStatusResponse = { entitlement: mockState.entitlement };
      return jsonResponse(payload);
    }

    if (pathname === "/api/checkout/mock-upgrade") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      mockState.entitlement = {
        userId: MOCK_USER_ID,
        plan: "build_pro",
        buildId: MOCK_BUILD_ID,
        active: true,
        startedAt: new Date().toISOString(),
      };

      const payload: CheckoutResponse = {
        success: true,
        plan: "build_pro",
        entitlement: mockState.entitlement,
        message: "Build Pro unlocked for this mock session.",
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/affiliate/click") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const { event } = await readJson<AffiliateClickRequest>(request);

      if (!event?.partId || !event.merchant || !event.url) {
        throw new ApiRouteError(400, "Affiliate click requires partId, merchant, and url.");
      }

      const clickEvent: AffiliateClickEvent = {
        ...event,
        userId: event.userId ?? MOCK_USER_ID,
        buildId: event.buildId ?? MOCK_BUILD_ID,
        clickedAt: event.clickedAt ?? new Date().toISOString(),
      };
      mockState.affiliateClicks.push(clickEvent);

      const payload: AffiliateClickResponse = {
        success: true,
        event: clickEvent,
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/monetization/reset") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      resetMockMonetizationState();

      const payload: ResetMonetizationResponse = {
        success: true,
        entitlement: mockState.entitlement,
        usage: getUsageStatus(),
        message: "Mock monetization state reset for local testing.",
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
