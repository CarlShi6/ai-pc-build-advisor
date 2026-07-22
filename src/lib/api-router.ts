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
import { getPersistenceStore } from "@/lib/persistence";
import { clearSessionCookie, createSessionCookie } from "@/lib/persistence/mock-store";
import { searchProducts } from "@/lib/product-search/search-service";
import { runSupabaseSmokeTest } from "@/lib/supabase/smoke-test.server";
import { createStripeCheckoutSession } from "@/lib/stripe.server";
import { normalizeAnalyticsEvent } from "@/lib/analytics";
import { normalizeRecommendedBuildInput, ValidationError } from "@/lib/validation";
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
  PostBuildFeedbackRequest,
  PostBuildFeedbackResponse,
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
  AuthSessionResponse,
  SignInPayload,
  SignInResponse,
  SignOutApiResponse,
  SignUpPayload,
  SignUpResponse,
} from "@/types/api";

class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

const MOCK_BUILD_ID = "mock-build";

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
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
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
  const store = getPersistenceStore();

  if (!pathname.startsWith("/api")) {
    return null;
  }

  try {
    if (pathname === "/api/analytics/events") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<unknown>(request);
      const event = normalizeAnalyticsEvent(input, {
        eventId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        path: "/",
      });

      if (!event) {
        throw new ApiRouteError(400, "Analytics event is invalid or unsupported.");
      }

      console.info(JSON.stringify({ type: "product_analytics", ...event }));
      return jsonResponse({ accepted: true }, { status: 202 });
    }

    if (pathname === "/api/auth/session") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const payload: AuthSessionResponse = { session: await store.getSession(request) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/auth/sign-in") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<SignInPayload>(request);

      if (!input.email?.trim() || !input.password?.trim()) {
        throw new ApiRouteError(400, "Sign in requires email and password.");
      }

      const session = await store.signIn(input);
      const payload: SignInResponse = { session };
      return jsonResponse(payload, { headers: { "Set-Cookie": createSessionCookie(session) } });
    }

    if (pathname === "/api/auth/sign-up") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readJson<SignUpPayload>(request);

      if (!input.email?.trim() || !input.password?.trim()) {
        throw new ApiRouteError(400, "Sign up requires email and password.");
      }

      const session = await store.signUp(input);
      const payload: SignUpResponse = { session };
      return jsonResponse(payload, { headers: { "Set-Cookie": createSessionCookie(session) } });
    }

    if (pathname === "/api/auth/sign-out") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const payload: SignOutApiResponse = await store.signOut(request);
      return jsonResponse(payload, { headers: { "Set-Cookie": clearSessionCookie() } });
    }

    if (pathname === "/api/smoke/supabase") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const result = await runSupabaseSmokeTest();
      return jsonResponse(result.body, { status: result.httpStatus });
    }

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

      const rawInput = await readJson<RecommendedBuildInput>(request);
      const input = normalizeRecommendedBuildInput(rawInput);
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

      const actor = await store.getActor(request);
      const payload: SavedBuildsResponse = await store.listSavedBuilds(actor);
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

      const actor = await store.getActor(request);
      let payload: SaveBuildResponse;
      try {
        payload = await store.saveBuild(actor, input);
      } catch (error) {
        throw new ApiRouteError(
          403,
          error instanceof Error ? error.message : "This saved build could not be stored.",
        );
      }
      return jsonResponse(payload);
    }

    if (pathname === "/api/builds/feedback") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const { feedback } = await readJson<PostBuildFeedbackRequest>(request);

      if (!feedback?.buildId) {
        throw new ApiRouteError(400, "Post-build feedback requires a saved build id.");
      }

      if (
        !Number.isFinite(feedback.overallSatisfaction) ||
        feedback.overallSatisfaction < 1 ||
        feedback.overallSatisfaction > 5
      ) {
        throw new ApiRouteError(400, "Overall satisfaction must be between 1 and 5.");
      }

      const actor = await store.getActor(request);
      let result;
      try {
        result = await store.savePostBuildFeedback(actor, feedback);
      } catch (error) {
        throw new ApiRouteError(
          404,
          error instanceof Error
            ? error.message
            : "Feedback could not be attached to that saved build.",
        );
      }

      const payload: PostBuildFeedbackResponse = {
        success: true,
        ...result,
      };
      return jsonResponse(payload);
    }

    const savedBuildMatch = pathname.match(/^\/api\/builds\/([^/]+)$/);
    if (savedBuildMatch) {
      const id = decodeURIComponent(savedBuildMatch[1]);
      const actor = await store.getActor(request);

      if (request.method === "GET") {
        const savedBuild = await store.getSavedBuild(actor, id);

        if (!savedBuild) {
          throw new ApiRouteError(404, "Saved build not found.");
        }

        const payload: SavedBuildResponse = { savedBuild };
        return jsonResponse(payload);
      }

      if (request.method === "DELETE") {
        const result = await store.deleteSavedBuild(actor, id);
        const payload: DeleteSavedBuildResponse = {
          success: true,
          builds: result.builds,
          limit: result.limit,
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

      const actor = await store.getActor(request);
      const usageBefore = await store.getUsageStatus(actor);

      if (!usageBefore.canAskAiQuestion) {
        const responsePayload: AdvisorResponsePayload = {
          assistantMessage:
            "You have used the Free advisor questions for today. Your current build, compatibility checks, and part comparisons are still available. Build Pro unlocks 50 AI questions per build.",
          explanation:
            "Usage was not consumed because the current plan has no remaining advisor questions.",
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

      const usageResult = await store.consumeAiUsage(actor);
      const entitlement = await store.getEntitlement(actor);
      const advisorResponse = await getAdvisorResponse({
        message,
        conversationHistory: payload.conversationHistory ?? [],
        currentBuild: payload.currentBuild ?? null,
        collectedNeeds: payload.collectedNeeds ?? {},
        activeCompare: payload.activeCompare ?? null,
        plan: entitlement.active ? entitlement.plan : "free",
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

      const actor = await store.getActor(request);
      const payload: UsageStatusResponse = { usage: await store.getUsageStatus(actor) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/usage/consume") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const actor = await store.getActor(request);
      const payload = await store.consumeAiUsage(actor);
      return jsonResponse(payload, { status: payload.consumed ? 200 : 429 });
    }

    if (pathname === "/api/usage/replacement/consume") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const actor = await store.getActor(request);
      const payload = await store.consumeReplacementUsage(actor);
      return jsonResponse(payload, { status: payload.consumed ? 200 : 429 });
    }

    if (pathname === "/api/entitlement/status") {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const actor = await store.getActor(request);
      const payload: EntitlementStatusResponse = { entitlement: await store.getEntitlement(actor) };
      return jsonResponse(payload);
    }

    if (pathname === "/api/checkout/mock-upgrade") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const actor = await store.getActor(request);
      const entitlement = await store.activateBuildPro(actor, { paymentProvider: "mock" });

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

      const actor = await store.getActor(request);
      const stripeResult = await createStripeCheckoutSession({
        plan: input.plan,
        buildId: input.buildId ?? MOCK_BUILD_ID,
        userId: input.userId ?? actor.userId ?? actor.sessionId,
      });
      await store.recordCheckoutSession(actor, {
        plan: input.plan,
        paymentProvider: stripeResult.fallbackUsed ? "mock" : "stripe",
        checkoutSessionId: stripeResult.checkoutSessionId,
        status: stripeResult.fallbackUsed ? "failed" : "created",
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
          const webhookActor = {
            userId: session.metadata?.userId,
            sessionId: session.metadata?.userId ?? "stripe-webhook-session",
          };
          await store.activateBuildPro(webhookActor, {
            paymentProvider: "stripe",
            buildId: session.metadata?.buildId ?? MOCK_BUILD_ID,
            checkoutSessionId: session.id,
          });
        }
      }

      const actor = await store.getActor(request);
      return jsonResponse({
        received: true,
        entitlement: await store.getEntitlement(actor),
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

      const actor = await store.getActor(request);
      const clickEvent = await store.trackAffiliateClick(actor, event);

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

      const actor = await store.getActor(request);
      const result = await store.resetActor(actor);

      const payload: ResetMonetizationResponse = {
        success: true,
        entitlement: result.entitlement,
        usage: result.usage,
        message:
          "Demo state reset. Free limits, usage, Pro access, and saved builds are back to the starting point.",
      };
      return jsonResponse(payload);
    }

    return jsonResponse({ message: "API endpoint not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return jsonResponse({ message: error.message }, { status: error.status });
    }

    if (error instanceof ValidationError) {
      return jsonResponse({ message: error.message }, { status: 400 });
    }

    console.error(error);
    return jsonResponse(
      { message: "The internal API could not complete this request. Please try again." },
      { status: 500 },
    );
  }
}
