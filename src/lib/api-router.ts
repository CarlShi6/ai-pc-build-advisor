import {
  getCartPreviewItems,
  getComparePartsData,
  getOffersForPart,
  getPartsByCategoryData,
  getRecommendedBuildData,
  getStoreEmployeeSummary,
  recalculateBuild,
} from "@/lib/build-advisor";
import { getAdvisorResponse } from "@/lib/ai/advisor-service";
import { normalizeAdvisorActions } from "@/lib/ai/types";
import { BUILD_PRO_PLAN, FREE_PLAN } from "@/lib/monetization";
import { searchProducts } from "@/lib/product-search/search-service";
import { createStripeCheckoutSession } from "@/lib/stripe.server";
import type {
  AdvisorRequestPayload,
  AdvisorResponsePayload,
  AffiliateClickRequest,
  AffiliateClickResponse,
  CartPreviewRequest,
  CartPreviewResponse,
  CheckoutResponse,
  ConsumeReplacementResponse,
  ConsumeUsageResponse,
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  ComparePartsResponse,
  CreateCheckoutSessionApiResponse,
  CreateCheckoutSessionPayload,
  DeleteSavedBuildResponse,
  EntitlementStatusResponse,
  OffersResponse,
  PartsResponse,
  ProductSearchRequest,
  ProductsSearchResponse,
  RecommendBuildResponse,
  RecommendedBuildInput,
  ResetMonetizationResponse,
  SaveBuildRequest,
  SaveBuildResponse,
  SavedBuildResponse,
  SavedBuildsResponse,
  UsageStatusResponse,
} from "@/types/api";
import type { AffiliateClickEvent, Entitlement, PlanType, UsageStatus } from "@/types/monetization";
import type { Build, SavedBuild, SavedBuildSummary } from "@/types/build";

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
  replacementsUsedForBuild: number;
  affiliateClicks: AffiliateClickEvent[];
  savedBuilds: SavedBuild[];
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
  replacementsUsedForBuild: 0,
  affiliateClicks: [],
  savedBuilds: [],
};

function createFreeEntitlement(): Entitlement {
  return {
    userId: MOCK_USER_ID,
    plan: "free",
    active: true,
    startedAt: new Date().toISOString(),
    paymentProvider: "mock",
  };
}

function resetMockMonetizationState() {
  mockState.entitlement = createFreeEntitlement();
  mockState.aiQuestionsUsedToday = 0;
  mockState.aiQuestionsUsedForBuild = 0;
  mockState.replacementsUsedForBuild = 0;
  mockState.affiliateClicks = [];
}

function getCurrentPlan(): PlanType {
  return mockState.entitlement.active ? mockState.entitlement.plan : "free";
}

function activateBuildProEntitlement({
  paymentProvider,
  buildId = MOCK_BUILD_ID,
  checkoutSessionId,
  userId = MOCK_USER_ID,
}: {
  paymentProvider: "mock" | "stripe";
  buildId?: string;
  checkoutSessionId?: string;
  userId?: string;
}) {
  const now = new Date().toISOString();
  mockState.entitlement = {
    userId,
    plan: "build_pro",
    buildId,
    active: true,
    startedAt: mockState.entitlement.startedAt || now,
    paymentProvider,
    checkoutSessionId,
    activatedAt: now,
  };

  return mockState.entitlement;
}

function getSavedBuildLimit() {
  return getCurrentPlan() === "build_pro" ? 10 : 1;
}

function createSavedBuildSummary(savedBuild: SavedBuild): SavedBuildSummary {
  return {
    id: savedBuild.id,
    name: savedBuild.name,
    createdAt: savedBuild.createdAt,
    updatedAt: savedBuild.updatedAt,
    totalPrice: savedBuild.totalPrice,
    compatibilityStatus: savedBuild.compatibilityStatus,
    ownedParts: savedBuild.ownedParts,
    targetUseCase: savedBuild.targetUseCase,
    cpuName: savedBuild.build.parts.find((part) => part.category === "cpu")?.displayName,
    gpuName: savedBuild.build.parts.find((part) => part.category === "gpu")?.displayName,
  };
}

function getSavedBuildSummaries() {
  return [...mockState.savedBuilds]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map(createSavedBuildSummary);
}

function createSavedBuild({
  id,
  name,
  build,
  buildNeeds,
}: SaveBuildRequest): SavedBuild {
  const now = new Date().toISOString();
  const existing = id ? mockState.savedBuilds.find((item) => item.id === id) : undefined;
  const safeBuild = recalculateBuild(build);

  return {
    id: existing?.id ?? `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim() || safeBuild.name,
    build: safeBuild,
    buildNeeds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    totalPrice: safeBuild.totalPrice,
    compatibilityStatus: safeBuild.compatibilityStatus,
    ownedParts: safeBuild.parts.filter((part) => part.owned).length,
    targetUseCase: safeBuild.targetUseCase,
  };
}

function getUsageStatus(): UsageStatus {
  const plan = getCurrentPlan();
  const replacementLimit =
    plan === "build_pro"
      ? BUILD_PRO_PLAN.replacementLimit ?? 25
      : FREE_PLAN.replacementLimit ?? 3;
  const remainingReplacements = Math.max(0, replacementLimit - mockState.replacementsUsedForBuild);

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
      replacementLimit,
      replacementsUsed: mockState.replacementsUsedForBuild,
      remainingReplacements,
      canReplacePart: remainingReplacements > 0,
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
    replacementLimit,
    replacementsUsed: mockState.replacementsUsedForBuild,
    remainingReplacements,
    canReplacePart: remainingReplacements > 0,
  };
}

function consumeAiUsage(): ConsumeUsageResponse {
  const usage = getUsageStatus();

  if (!usage.canAskAiQuestion) {
    return {
      usage,
      consumed: false,
      message:
        "You have used the Free advisor questions for today. Build Pro unlocks 50 AI questions per build.",
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

function consumeReplacementUsage(): ConsumeReplacementResponse {
  const usage = getUsageStatus();

  if (!usage.canReplacePart) {
    return {
      usage,
      consumed: false,
      message:
        "You have used the Free hardware replacements for this build. Build Pro unlocks 25 replacements.",
    };
  }

  mockState.replacementsUsedForBuild += 1;

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

    if (pathname === "/api/products/search") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<ProductSearchRequest>(request);
      const payload: ProductsSearchResponse = await searchProducts({
        query: input.query ?? "",
        category: input.category,
        onlyCompatible: input.onlyCompatible,
        includeExternal: input.includeExternal,
        currentBuild: input.currentBuild,
      });
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

    if (pathname === "/api/builds/saved") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const payload: SavedBuildsResponse = {
        builds: getSavedBuildSummaries(),
        limit: getSavedBuildLimit(),
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/builds/save") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<SaveBuildRequest>(request);

      if (!input.build || !input.name?.trim()) {
        throw new ApiRouteError(400, "Saving a build requires a name and build.");
      }

      const existingIndex = input.id
        ? mockState.savedBuilds.findIndex((savedBuild) => savedBuild.id === input.id)
        : -1;
      const limit = getSavedBuildLimit();

      if (existingIndex === -1 && mockState.savedBuilds.length >= limit) {
        throw new ApiRouteError(
          403,
          getCurrentPlan() === "build_pro"
            ? "You can save up to 10 builds with Build Pro."
            : "Your Free saved build slot is full. Build Pro unlocks up to 10 saved builds plus full export.",
        );
      }

      const savedBuild = createSavedBuild(input);

      if (existingIndex >= 0) {
        mockState.savedBuilds[existingIndex] = savedBuild;
      } else {
        mockState.savedBuilds.unshift(savedBuild);
      }

      const payload: SaveBuildResponse = {
        savedBuild,
        summary: createSavedBuildSummary(savedBuild),
        builds: getSavedBuildSummaries(),
        limit,
      };
      return jsonResponse(payload);
    }

    const savedBuildMatch = pathname.match(/^\/api\/builds\/([^/]+)$/);
    if (savedBuildMatch) {
      const id = decodeURIComponent(savedBuildMatch[1]);
      const savedBuild = mockState.savedBuilds.find((item) => item.id === id);

      if (request.method === "GET") {
        if (!savedBuild) {
          throw new ApiRouteError(404, "Saved build not found.");
        }

        const payload: SavedBuildResponse = { savedBuild };
        return jsonResponse(payload);
      }

      if (request.method === "DELETE") {
        mockState.savedBuilds = mockState.savedBuilds.filter((item) => item.id !== id);
        const payload: DeleteSavedBuildResponse = {
          success: true,
          builds: getSavedBuildSummaries(),
          limit: getSavedBuildLimit(),
        };
        return jsonResponse(payload);
      }

      return methodNotAllowed(["GET", "DELETE"]);
    }

    if (pathname === "/api/ai/advisor") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const payload = await readJson<AdvisorRequestPayload>(request);
      const message = payload.message?.trim();

      if (!message) {
        throw new ApiRouteError(400, "Advisor request requires a user message.");
      }

      const usageBefore = getUsageStatus();

      if (!usageBefore.canAskAiQuestion) {
        const responsePayload: AdvisorResponsePayload = {
          assistantMessage:
            "You have used the Free advisor questions for today. Your current build, compatibility checks, and part comparisons are still available. Build Pro unlocks 50 AI questions per build.",
          explanation: "Usage was not consumed because the current plan has no remaining advisor questions.",
          provider: "mock",
          usage: usageBefore,
          usageConsumed: false,
          upgradeRequired: usageBefore.plan === "free",
          suggestedActions: [],
          extractedNeeds: {},
          warnings: [],
          fallbackUsed: true,
        };
        return jsonResponse(responsePayload);
      }

      const usageResult = consumeAiUsage();
      const advisorResponse = await getAdvisorResponse({
        message,
        currentBuild: payload.currentBuild ?? null,
        collectedNeeds: payload.collectedNeeds ?? {},
        plan: getCurrentPlan(),
        usageStatus: usageResult.usage,
      });

      const responsePayload: AdvisorResponsePayload = {
        ...advisorResponse,
        suggestedActions: normalizeAdvisorActions(advisorResponse.suggestedActions),
        warnings: advisorResponse.warnings ?? [],
        fallbackUsed: advisorResponse.fallbackUsed ?? advisorResponse.provider === "mock",
        usage: usageResult.usage,
        usageConsumed: usageResult.consumed,
      };
      return jsonResponse(responsePayload);
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

    if (pathname === "/api/usage/replacement/consume") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const payload = consumeReplacementUsage();
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

      const entitlement = activateBuildProEntitlement({ paymentProvider: "mock" });

      const payload: CheckoutResponse = {
        success: true,
        plan: "build_pro",
        entitlement,
        message: "Build Pro unlocked for this local session.",
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/checkout/create-session") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<CreateCheckoutSessionPayload>(request);

      if (input.plan !== "build_pro") {
        throw new ApiRouteError(400, "Only Build Pro checkout is supported.");
      }

      const stripeResult = await createStripeCheckoutSession({
        plan: input.plan,
        buildId: input.buildId ?? MOCK_BUILD_ID,
        userId: input.userId ?? MOCK_USER_ID,
      });
      const payload: CreateCheckoutSessionApiResponse = {
        checkoutUrl: stripeResult.checkoutUrl,
        fallbackUsed: stripeResult.fallbackUsed,
        message: stripeResult.message,
      };
      return jsonResponse(payload);
    }

    if (pathname === "/api/stripe/webhook") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const event = await readJson<{
        id?: string;
        type?: string;
        data?: {
          object?: {
            id?: string;
            metadata?: {
              plan?: string;
              buildId?: string;
              userId?: string;
            };
          };
        };
      }>(request);

      // TODO: In production, verify the raw request body with STRIPE_WEBHOOK_SECRET
      // before trusting this event. The mock API reads parsed JSON so local dev can
      // exercise the entitlement path without breaking when the secret is missing.
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const plan = session?.metadata?.plan;

        if (session && plan === "build_pro") {
          activateBuildProEntitlement({
            paymentProvider: "stripe",
            buildId: session.metadata?.buildId ?? MOCK_BUILD_ID,
            userId: session.metadata?.userId ?? MOCK_USER_ID,
            checkoutSessionId: session.id,
          });
        }
      }

      return jsonResponse({
        received: true,
        entitlement: mockState.entitlement,
        message: "Stripe webhook placeholder received.",
      });
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
