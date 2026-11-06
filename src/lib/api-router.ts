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
import { SaveConflictError } from "@/lib/persistence/save-version";
import { searchProducts } from "@/lib/product-search/search-service";
import { runSupabaseSmokeTest } from "@/lib/supabase/smoke-test.server";
import { createStripeCheckoutSession } from "@/lib/stripe.server";
import { normalizeAnalyticsEvent } from "@/lib/analytics";
import { getPriceRepository } from "@/lib/pricing/repository";
import { normalizePriceHistoryRange, PriceValidationError } from "@/lib/pricing/validation";
import { getRetailPriceProvider } from "@/lib/pricing/current-offer-service.server";
import { BEST_BUY_DISCLOSURE } from "@/lib/pricing/best-buy-provider.server";
import { seedParts } from "@/data/seedParts";
import { normalizeRecommendedBuildInput, ValidationError } from "@/lib/validation";
import { readBoundedImage, ImageInputError } from "@/lib/v3/image-input";
import { analyzeReferenceImage, ImageAnalysisError } from "@/lib/v3/image-analysis.server";
import type { ImageAnalyzer } from "@/lib/v3/image-contract";
import { encodeEvent, NDJSON, type AnalysisStreamEvent } from "@/lib/v3/analysis-stream";
import { workerBindings, type WorkerBindings } from "@/lib/v3/cloudflare-env.server";
import {
  clientIp,
  D1DailyCap,
  DailyCapError,
  dailyCapOf,
  DEFAULT_IP_DAILY_CAP,
  IpDailyCapError,
  ipDayKey,
  memoryDailyCap,
  memoryIpDailyCap,
  utcDay,
  type DailyCapStore,
} from "@/lib/v3/image-daily-cap.server";
import { precheckReferenceImage, type ImagePrecheck } from "@/lib/v3/image-precheck.server";
import { verifyTurnstile } from "@/lib/v3/turnstile.server";
import { getServerConfig } from "@/lib/config.server";
import {
  imageSessionKey,
  imageSessionLimiter,
  ImageSessionLimitError,
  type ImageSessionLimiter,
} from "@/lib/v3/image-rate-limit.server";
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
  PartPriceHistoryResponse,
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
import type { PriceApiErrorCode, PriceApiErrorResponse } from "@/types/pricing";
import type { RetailPriceProvider } from "@/types/current-offer";
import { isReplayKey } from "@/lib/v3/image-replay";

class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

const MOCK_BUILD_ID = "mock-build";
const MAX_ANALYTICS_EVENT_BYTES = 8 * 1024;

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

function priceErrorResponse(status: number, code: PriceApiErrorCode, message: string) {
  const payload: PriceApiErrorResponse = { error: { code, message } };
  return jsonResponse(payload, { status });
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

async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiRouteError(413, `Request body must not exceed ${maxBytes} bytes.`);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new ApiRouteError(413, `Request body must not exceed ${maxBytes} bytes.`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiRouteError(400, "Request body must be valid JSON.");
  }
}

export async function handleInternalApiRequest(
  request: Request,
  dependencies: {
    retailPriceProvider?: RetailPriceProvider;
    imageAnalyzer?: ImageAnalyzer;
    imageLimiter?: ImageSessionLimiter;
    imageDailyCap?: DailyCapStore | null;
    imageIpDailyCap?: DailyCapStore | null;
    /** Defaults to the provider prechecks, except with a substituted analyzer (tests, fakes). */
    imagePrecheck?: ImagePrecheck;
    workerBindings?: WorkerBindings | null;
    turnstileFetch?: typeof fetch;
  } = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = normalizeApiPath(url.pathname);
  const store = getPersistenceStore();

  if (!pathname.startsWith("/api")) {
    return null;
  }

  try {
    if (pathname === "/api/image-analyses") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      // Kill switch: nothing is read, counted or sent while it is on.
      if (getServerConfig().imageAnalysisPaused)
        return jsonResponse(
          {
            error: {
              code: "IMAGE_ANALYSIS_PAUSED",
              message:
                "Photo reading is paused right now. You can still describe your PC or build it by hand.",
            },
          },
          { status: 503, headers: { "cache-control": "no-store", "retry-after": "3600" } },
        );
      const image = await readBoundedImage(request);
      const actor = await store.getActor(request);
      const { key, setCookie } = imageSessionKey(request, actor.userId);
      const headers: Record<string, string> = { "cache-control": "no-store" };
      if (setCookie) headers["set-cookie"] = setCookie;
      let release: (() => void) | undefined;
      let releaseDay: (() => Promise<void>) | undefined;
      let releaseIp: (() => Promise<void>) | undefined;
      try {
        const config = getServerConfig();
        const bindings =
          "workerBindings" in dependencies ? dependencies.workerBindings : await workerBindings();
        await verifyTurnstile(request, config.turnstileSecretKey, dependencies.turnstileFetch);
        // The platform limit is shared by every isolate; the in-memory one is the fallback.
        if (
          bindings?.IMAGE_RATE_LIMITER &&
          !(await bindings.IMAGE_RATE_LIMITER.limit({ key })).success
        )
          throw new ImageSessionLimitError(60);
        release = (dependencies.imageLimiter ?? imageSessionLimiter).reserve(key);
        // In production the daily cap needs the shared D1 store; without it, analysis stays off.
        const capStore =
          "imageDailyCap" in dependencies
            ? dependencies.imageDailyCap
            : bindings?.IMAGE_CAP_DB
              ? new D1DailyCap(bindings.IMAGE_CAP_DB)
              : import.meta.env.PROD
                ? null
                : memoryDailyCap;
        if (!capStore) throw new DailyCapError("DAILY_CAP_UNAVAILABLE");
        const day = utcDay();
        // Per client IP, so clearing the session cookie does not reset the count.
        const ip = clientIp(request);
        const ipStore =
          "imageIpDailyCap" in dependencies
            ? dependencies.imageIpDailyCap
            : bindings?.IMAGE_CAP_DB
              ? new D1DailyCap(bindings.IMAGE_CAP_DB)
              : memoryIpDailyCap;
        if (ip && ipStore) {
          const ipKey = await ipDayKey(day, ip);
          const ipCap = dailyCapOf(config.imageAnalysisIpDailyCap, DEFAULT_IP_DAILY_CAP);
          if (!(await ipStore.reserve(ipKey, ipCap))) throw new IpDailyCapError();
          releaseIp = () => ipStore.release(ipKey);
        }
        if (!(await capStore.reserve(day, dailyCapOf(config.imageAnalysisDailyCap))))
          throw new DailyCapError("DAILY_CAP_REACHED");
        releaseDay = () => capStore.release(day);
        // Moderation and the "is it a PC?" check, before anything streams (image-precheck.server.ts).
        const precheck =
          dependencies.imagePrecheck ??
          (dependencies.imageAnalyzer ? undefined : precheckReferenceImage);
        const checked = (await precheck?.(image)) ?? null;
        // Dev only: the client names the original photo so the response can be saved as a replay.
        const replayKey = import.meta.env.DEV
          ? (request.headers.get("x-aipc-replay-key") ?? undefined)
          : undefined;
        const analyzer = dependencies.imageAnalyzer ?? analyzeReferenceImage;
        const input = {
          ...image,
          ...(isReplayKey(replayKey) && { replayKey }),
          ...(checked && { precheck: checked }),
        };
        if (!request.headers.get("accept")?.includes(NDJSON))
          return jsonResponse(await analyzer(input), { headers });
        // Streamed: every check above, and any error before the provider accepts the request,
        // answers with its own status; after that, parts, the result and errors are events.
        const { readable, writable } = new TransformStream<string, string>();
        const writer = writable.getWriter();
        // A closed tab ends the stream; its failed writes are not errors.
        const send = (event: AnalysisStreamEvent) =>
          void writer.write(encodeEvent(event)).catch(() => undefined);
        let isStarted = false;
        let markStarted = () => {};
        const started = new Promise<void>((resolve) => (markStarted = resolve));
        const start = () => {
          if (!isStarted)
            send({ type: "started", ...(checked?.kind === "unclear" && { photo: "unclear" }) });
          isStarted = true;
          markStarted();
        };
        const work = analyzer({ ...input, onStarted: start, onPart: send });
        // A fake analyzer may finish without calling onStarted; its errors still come first.
        await Promise.race([started, work]);
        start();
        void work
          .then((result) => send({ type: "done", result }))
          .catch((error: unknown) =>
            send({
              type: "error",
              code: error instanceof ImageAnalysisError ? error.code : "ANALYSIS_FAILED",
              message:
                error instanceof ImageAnalysisError
                  ? error.message
                  : "Image analysis is unavailable. You can continue manually.",
            }),
          )
          .finally(() => void writer.close().catch(() => undefined));
        return new Response(readable.pipeThrough(new TextEncoderStream()), {
          status: 200,
          headers: { ...headers, "content-type": `${NDJSON}; charset=utf-8` },
        });
      } catch (error) {
        if (!(error instanceof ImageAnalysisError)) throw error;
        // Requests that never reached the provider don't use up the session's allowance.
        if (error.code === "IMAGE_AI_NOT_CONFIGURED" || error.code === "RATE_LIMITED") {
          release?.();
          await releaseDay?.();
          await releaseIp?.();
        }
        // A request stopped before the provider never counts against the session either.
        if (error instanceof DailyCapError) {
          release?.();
          await releaseIp?.();
        }
        if (error instanceof IpDailyCapError) release?.();
        if (error instanceof ImageSessionLimitError)
          headers["retry-after"] = String(error.retryAfterSeconds);
        return jsonResponse(
          { error: { code: error.code, message: error.message } },
          { status: error.status, headers },
        );
      }
    }

    if (pathname === "/api/analytics/events") {
      if (request.method !== "POST") {
        return methodNotAllowed(["POST"]);
      }

      const input = await readBoundedJson<unknown>(request, MAX_ANALYTICS_EVENT_BYTES);
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

    const partPricesMatch = pathname.match(/^\/api\/parts\/([^/]+)\/prices$/);
    if (partPricesMatch) {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const partId = decodeURIComponent(partPricesMatch[1]);
      const priceRepository = getPriceRepository();
      if (!priceRepository.hasCanonicalPart(partId)) {
        return priceErrorResponse(404, "UNKNOWN_PART", "Canonical part not found.");
      }

      let range;
      try {
        range = normalizePriceHistoryRange(url.searchParams.get("range") ?? "30d");
      } catch (error) {
        if (error instanceof PriceValidationError) {
          return priceErrorResponse(400, "INVALID_RANGE", error.message);
        }
        throw error;
      }

      const payload = priceRepository.getCurrentPriceSummary(partId, range);
      if (!payload) {
        return priceErrorResponse(
          404,
          "NO_PRICE_DATA",
          "No price observations are available for this part and range.",
        );
      }

      return jsonResponse(payload satisfies PartPriceHistoryResponse);
    }

    const currentOfferMatch = pathname.match(/^\/api\/parts\/([^/]+)\/current-offer$/);
    if (currentOfferMatch) {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }

      const partId = decodeURIComponent(currentOfferMatch[1]);
      if (!seedParts.some((part) => part.id === partId)) {
        return jsonResponse({
          partId,
          providerId: "best_buy",
          status: "unavailable",
          offer: null,
          disclosure: BEST_BUY_DISCLOSURE,
          fetchedAt: null,
          expiresAt: null,
          cached: false,
          reason: "UNKNOWN_PART",
        });
      }

      const retailPriceProvider = dependencies.retailPriceProvider ?? getRetailPriceProvider();
      return jsonResponse(await retailPriceProvider.getCurrentOffer(partId));
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
      if (input.expectedUpdatedAt !== undefined && typeof input.expectedUpdatedAt !== "string") {
        throw new ApiRouteError(400, "expectedUpdatedAt must be a string.");
      }

      const actor = await store.getActor(request);
      let payload: SaveBuildResponse;
      try {
        payload = await store.saveBuild(actor, input);
      } catch (error) {
        if (error instanceof SaveConflictError) {
          return jsonResponse(
            { error: { code: error.code, message: error.message } },
            { status: 409, headers: { "cache-control": "no-store" } },
          );
        }
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
    if (error instanceof ImageInputError || error instanceof ImageAnalysisError) {
      return jsonResponse(
        { error: { code: error.code, message: error.message } },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
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
