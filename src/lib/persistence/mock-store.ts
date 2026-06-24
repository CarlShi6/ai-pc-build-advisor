import { BUILD_PRO_PLAN, FREE_PLAN } from "@/lib/monetization";
import { recalculateBuild } from "@/lib/build-advisor";
import type { SavedBuild, SavedBuildSummary } from "@/types/build";
import type { AffiliateClickEvent, Entitlement, PlanType, UsageStatus } from "@/types/monetization";
import type {
  AuthSession,
  CheckoutSessionRecord,
  PersistenceActor,
  PersistenceStore,
  SaveBuildInput,
  SignInRequest,
  SignOutResponse,
  SignUpRequest,
  User,
} from "@/lib/persistence/types";

const MOCK_GUEST_SESSION_ID = "mock-guest-session";
const MOCK_BUILD_ID = "mock-build";
const SESSION_COOKIE = "pc_advisor_session";

type ActorState = {
  entitlement: Entitlement;
  aiQuestionsUsedToday: number;
  aiQuestionsUsedForBuild: number;
  replacementsUsedForBuild: number;
  affiliateClicks: AffiliateClickEvent[];
  checkoutSessions: CheckoutSessionRecord[];
  savedBuilds: SavedBuild[];
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseCookie(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  return (
    header
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

function createFreeEntitlement(actor: PersistenceActor): Entitlement {
  return {
    userId: actor.userId ?? actor.sessionId,
    plan: "free",
    active: true,
    startedAt: nowIso(),
    paymentProvider: "mock",
  };
}

function toUserId(session: AuthSession) {
  return session.user?.id ?? session.sessionId;
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

export class MockPersistenceStore implements PersistenceStore {
  private usersByEmail = new Map<string, User>();
  private sessions = new Map<string, AuthSession>();
  private actorStates = new Map<string, ActorState>();

  async getSession(request: Request): Promise<AuthSession> {
    const sessionId = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
    const session = sessionId ? this.sessions.get(sessionId) : null;

    if (session) {
      return session;
    }

    return {
      status: "guest",
      sessionId: MOCK_GUEST_SESSION_ID,
      userId: MOCK_GUEST_SESSION_ID,
      isMock: true,
    };
  }

  async signIn(input: SignInRequest): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const user =
      this.usersByEmail.get(email) ??
      this.createUser({
        email,
      });

    return this.createSession(user);
  }

  async signUp(input: SignUpRequest): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const existing = this.usersByEmail.get(email);
    const user =
      existing ??
      this.createUser({
        email,
        displayName: input.displayName?.trim() || undefined,
      });

    return this.createSession(user);
  }

  async signOut(request: Request): Promise<SignOutResponse> {
    const current = await this.getSession(request);

    if (current.status === "authenticated") {
      this.sessions.delete(current.sessionId);
    }

    return {
      success: true,
      session: {
        status: "guest",
        sessionId: MOCK_GUEST_SESSION_ID,
        userId: MOCK_GUEST_SESSION_ID,
        isMock: true,
      },
      message: "Signed out. Guest mode is active for this browser.",
    };
  }

  async getActor(request: Request): Promise<PersistenceActor> {
    const session = await this.getSession(request);
    return {
      userId: session.status === "authenticated" ? session.user?.id : undefined,
      sessionId: session.sessionId,
    };
  }

  async getEntitlement(actor: PersistenceActor): Promise<Entitlement> {
    return this.getActorState(actor).entitlement;
  }

  async activateBuildPro(
    actor: PersistenceActor,
    input: {
      paymentProvider: "mock" | "stripe";
      buildId?: string;
      checkoutSessionId?: string;
    },
  ): Promise<Entitlement> {
    const state = this.getActorState(actor);
    const now = nowIso();
    state.entitlement = {
      userId: actor.userId ?? actor.sessionId,
      plan: "build_pro",
      buildId: input.buildId ?? MOCK_BUILD_ID,
      active: true,
      startedAt: state.entitlement.startedAt || now,
      paymentProvider: input.paymentProvider,
      checkoutSessionId: input.checkoutSessionId,
      activatedAt: now,
    };
    await this.recordCheckoutSession(actor, {
      plan: "build_pro",
      paymentProvider: input.paymentProvider,
      checkoutSessionId: input.checkoutSessionId ?? `mock-checkout-${Date.now()}`,
      status: "completed",
    });

    return state.entitlement;
  }

  async recordCheckoutSession(
    actor: PersistenceActor,
    input: {
      plan: PlanType;
      paymentProvider: "mock" | "stripe";
      checkoutSessionId?: string;
      status: CheckoutSessionRecord["status"];
    },
  ): Promise<CheckoutSessionRecord> {
    const state = this.getActorState(actor);
    const now = nowIso();
    const record: CheckoutSessionRecord = {
      id: createId("checkout"),
      userId: actor.userId,
      sessionId: actor.sessionId,
      plan: input.plan,
      paymentProvider: input.paymentProvider,
      checkoutSessionId: input.checkoutSessionId,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    state.checkoutSessions.unshift(record);
    return record;
  }

  async getUsageStatus(actor: PersistenceActor): Promise<UsageStatus> {
    const state = this.getActorState(actor);
    const plan = this.getCurrentPlan(actor);
    const replacementLimit =
      plan === "build_pro"
        ? BUILD_PRO_PLAN.replacementLimit ?? 25
        : FREE_PLAN.replacementLimit ?? 3;
    const remainingReplacements = Math.max(0, replacementLimit - state.replacementsUsedForBuild);

    if (plan === "build_pro") {
      const limit = BUILD_PRO_PLAN.aiQuestionsPerBuild ?? 50;
      const remaining = Math.max(0, limit - state.aiQuestionsUsedForBuild);

      return {
        userId: actor.userId ?? actor.sessionId,
        plan,
        aiQuestionsUsedToday: state.aiQuestionsUsedToday,
        aiQuestionsUsedForBuild: state.aiQuestionsUsedForBuild,
        aiQuestionsLimitForBuild: limit,
        remainingAiQuestions: remaining,
        canAskAiQuestion: remaining > 0,
        replacementLimit,
        replacementsUsed: state.replacementsUsedForBuild,
        remainingReplacements,
        canReplacePart: remainingReplacements > 0,
      };
    }

    const limit = FREE_PLAN.aiQuestionsPerDay ?? 5;
    const remaining = Math.max(0, limit - state.aiQuestionsUsedToday);

    return {
      userId: actor.userId ?? actor.sessionId,
      plan,
      aiQuestionsUsedToday: state.aiQuestionsUsedToday,
      aiQuestionsLimitToday: limit,
      remainingAiQuestions: remaining,
      canAskAiQuestion: remaining > 0,
      replacementLimit,
      replacementsUsed: state.replacementsUsedForBuild,
      remainingReplacements,
      canReplacePart: remainingReplacements > 0,
    };
  }

  async consumeAiUsage(actor: PersistenceActor) {
    const usage = await this.getUsageStatus(actor);
    const state = this.getActorState(actor);

    if (!usage.canAskAiQuestion) {
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free advisor questions for today. Build Pro unlocks 50 AI questions per build.",
      };
    }

    if (usage.plan === "build_pro") {
      state.aiQuestionsUsedForBuild += 1;
    } else {
      state.aiQuestionsUsedToday += 1;
    }

    return {
      usage: await this.getUsageStatus(actor),
      consumed: true,
    };
  }

  async consumeReplacementUsage(actor: PersistenceActor) {
    const usage = await this.getUsageStatus(actor);
    const state = this.getActorState(actor);

    if (!usage.canReplacePart) {
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free hardware replacements for this build. Build Pro unlocks 25 replacements.",
      };
    }

    state.replacementsUsedForBuild += 1;

    return {
      usage: await this.getUsageStatus(actor),
      consumed: true,
    };
  }

  async listSavedBuilds(actor: PersistenceActor) {
    return {
      builds: this.getSavedBuildSummaries(actor),
      limit: this.getSavedBuildLimit(actor),
    };
  }

  async saveBuild(actor: PersistenceActor, input: SaveBuildInput) {
    const state = this.getActorState(actor);
    const existingIndex = input.id
      ? state.savedBuilds.findIndex((savedBuild) => savedBuild.id === input.id)
      : -1;
    const limit = this.getSavedBuildLimit(actor);

    if (existingIndex === -1 && state.savedBuilds.length >= limit) {
      throw new Error(
        this.getCurrentPlan(actor) === "build_pro"
          ? "You can save up to 10 builds with Build Pro."
          : "Your Free saved build slot is full. Build Pro unlocks up to 10 saved builds plus full export.",
      );
    }

    const savedBuild = this.createSavedBuild(actor, input);

    if (existingIndex >= 0) {
      state.savedBuilds[existingIndex] = savedBuild;
    } else {
      state.savedBuilds.unshift(savedBuild);
    }

    return {
      savedBuild,
      summary: createSavedBuildSummary(savedBuild),
      builds: this.getSavedBuildSummaries(actor),
      limit,
    };
  }

  async getSavedBuild(actor: PersistenceActor, id: string): Promise<SavedBuild | null> {
    return this.getActorState(actor).savedBuilds.find((item) => item.id === id) ?? null;
  }

  async deleteSavedBuild(actor: PersistenceActor, id: string) {
    const state = this.getActorState(actor);
    state.savedBuilds = state.savedBuilds.filter((item) => item.id !== id);

    return {
      builds: this.getSavedBuildSummaries(actor),
      limit: this.getSavedBuildLimit(actor),
    };
  }

  async trackAffiliateClick(
    actor: PersistenceActor,
    event: Omit<AffiliateClickEvent, "clickedAt"> & { clickedAt?: string },
  ): Promise<AffiliateClickEvent> {
    const state = this.getActorState(actor);
    const clickEvent: AffiliateClickEvent = {
      ...event,
      userId: event.userId ?? actor.userId ?? actor.sessionId,
      buildId: event.buildId ?? MOCK_BUILD_ID,
      clickedAt: event.clickedAt ?? nowIso(),
    };
    state.affiliateClicks.push(clickEvent);
    return clickEvent;
  }

  async resetActor(actor: PersistenceActor) {
    const state = this.createActorState(actor);
    this.actorStates.set(this.getActorKey(actor), state);

    return {
      entitlement: state.entitlement,
      usage: await this.getUsageStatus(actor),
    };
  }

  private createUser(input: { email: string; displayName?: string }): User {
    const user: User = {
      id: createId("mock-user"),
      email: input.email,
      displayName: input.displayName,
      createdAt: nowIso(),
    };
    this.usersByEmail.set(input.email, user);
    return user;
  }

  private createSession(user: User): AuthSession {
    const session: AuthSession = {
      status: "authenticated",
      sessionId: createId("mock-session"),
      user,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      isMock: true,
    };
    this.sessions.set(session.sessionId, session);
    this.getActorState({ userId: user.id, sessionId: session.sessionId });
    return session;
  }

  private getActorKey(actor: PersistenceActor) {
    return actor.userId ?? actor.sessionId;
  }

  private createActorState(actor: PersistenceActor): ActorState {
    return {
      entitlement: createFreeEntitlement(actor),
      aiQuestionsUsedToday: 0,
      aiQuestionsUsedForBuild: 0,
      replacementsUsedForBuild: 0,
      affiliateClicks: [],
      checkoutSessions: [],
      savedBuilds: [],
    };
  }

  private getActorState(actor: PersistenceActor): ActorState {
    const key = this.getActorKey(actor);
    const existing = this.actorStates.get(key);

    if (existing) {
      return existing;
    }

    const next = this.createActorState(actor);
    this.actorStates.set(key, next);
    return next;
  }

  private getCurrentPlan(actor: PersistenceActor): PlanType {
    const entitlement = this.getActorState(actor).entitlement;
    return entitlement.active ? entitlement.plan : "free";
  }

  private getSavedBuildLimit(actor: PersistenceActor) {
    return this.getCurrentPlan(actor) === "build_pro" ? 10 : 1;
  }

  private getSavedBuildSummaries(actor: PersistenceActor) {
    return [...this.getActorState(actor).savedBuilds]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map(createSavedBuildSummary);
  }

  private createSavedBuild(actor: PersistenceActor, input: SaveBuildInput): SavedBuild {
    const state = this.getActorState(actor);
    const now = nowIso();
    const existing = input.id ? state.savedBuilds.find((item) => item.id === input.id) : undefined;
    const safeBuild = recalculateBuild(input.build);

    return {
      id: existing?.id ?? createId("saved"),
      name: input.name.trim() || safeBuild.name,
      build: safeBuild,
      buildNeeds: input.buildNeeds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      totalPrice: safeBuild.totalPrice,
      compatibilityStatus: safeBuild.compatibilityStatus,
      ownedParts: safeBuild.parts.filter((part) => part.owned).length,
      targetUseCase: safeBuild.targetUseCase,
    };
  }
}

export function createSessionCookie(session: AuthSession) {
  const cookieValue =
    (session as AuthSession & { __cookieValue?: string }).__cookieValue ?? session.sessionId;
  return `${SESSION_COOKIE}=${encodeURIComponent(cookieValue)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0`;
}
