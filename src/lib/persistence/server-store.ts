import { BUILD_PRO_PLAN, FREE_PLAN } from "@/lib/monetization";
import { recalculateBuild } from "@/lib/build-advisor";
import { MockPersistenceStore } from "@/lib/persistence/mock-store";
import {
  createSupabaseAuthClient,
  createSupabaseServiceClient,
  isSupabasePersistenceEnabled,
} from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SavedBuild, SavedBuildSummary } from "@/types/build";
import type { AffiliateClickEvent, Entitlement, PlanType, UsageStatus } from "@/types/monetization";
import type {
  AuthSession,
  PersistenceActor,
  PersistenceStore,
  SaveBuildInput,
  SaveBuildResult,
  SignInRequest,
  SignOutResponse,
  SignUpRequest,
  User,
  CheckoutSessionRecord,
} from "@/lib/persistence/types";

const SESSION_COOKIE = "pc_advisor_session";
const MOCK_GUEST_SESSION_ID = "mock-guest-session";
const MOCK_BUILD_ID = "mock-build";

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;
type SavedBuildRow = Database["public"]["Tables"]["saved_builds"]["Row"];
type EntitlementRow = Database["public"]["Tables"]["entitlements"]["Row"];
type UsageCounterRow = Database["public"]["Tables"]["usage_counters"]["Row"];
type ReplacementCounterRow = Database["public"]["Tables"]["replacement_counters"]["Row"];

function nowIso() {
  return new Date().toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseCookie(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  const value = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  return value ? decodeURIComponent(value) : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

function toUser(row: { id: string; email?: string; display_name?: string | null; created_at?: string }): User {
  return {
    id: row.id,
    email: row.email ?? "",
    displayName: row.display_name ?? undefined,
    createdAt: row.created_at ?? nowIso(),
  };
}

function toSavedBuild(row: SavedBuildRow): SavedBuild {
  const safeBuild = recalculateBuild(row.build);

  return {
    id: row.id,
    name: row.name,
    build: safeBuild,
    buildNeeds: row.build_needs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalPrice: safeBuild.totalPrice,
    compatibilityStatus: safeBuild.compatibilityStatus,
    ownedParts: safeBuild.parts.filter((part) => part.owned).length,
    targetUseCase: safeBuild.targetUseCase.length > 0 ? safeBuild.targetUseCase : row.target_use_case,
  };
}

function toEntitlement(row: EntitlementRow): Entitlement {
  return {
    userId: row.user_id ?? row.session_id,
    plan: row.plan,
    buildId: row.build_id ?? undefined,
    active: row.active,
    startedAt: row.started_at,
    expiresAt: row.expires_at ?? undefined,
    paymentProvider: row.payment_provider,
    checkoutSessionId: row.checkout_session_id ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  };
}

function withHiddenCookieValue(session: AuthSession, cookieValue?: string): AuthSession {
  if (!cookieValue) {
    return session;
  }

  Object.defineProperty(session, "__cookieValue", {
    value: cookieValue,
    enumerable: false,
  });
  return session;
}

export class SupabasePersistenceStore implements PersistenceStore {
  private service: SupabaseClient;
  private auth: SupabaseClient;

  constructor() {
    this.service = createSupabaseServiceClient();
    this.auth = createSupabaseAuthClient();
  }

  async getSession(request: Request): Promise<AuthSession> {
    const accessToken = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);

    if (!accessToken) {
      return this.createGuestSession();
    }

    const { data, error } = await this.service.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      return this.createGuestSession();
    }

    await this.upsertAppUser({
      id: data.user.id,
      email: data.user.email,
      displayName: this.getDisplayName(data.user.user_metadata),
    });

    return {
      status: "authenticated",
      sessionId: `supabase-${data.user.id}`,
      userId: data.user.id,
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: this.getDisplayName(data.user.user_metadata),
        createdAt: data.user.created_at ?? nowIso(),
      },
      isMock: false,
    };
  }

  async signIn(input: SignInRequest): Promise<AuthSession> {
    const { data, error } = await this.auth.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
    });

    if (error || !data.user?.email || !data.session?.access_token) {
      throw new Error(error?.message ?? "Supabase sign in failed.");
    }

    await this.upsertAppUser({
      id: data.user.id,
      email: data.user.email,
      displayName: this.getDisplayName(data.user.user_metadata),
    });

    return withHiddenCookieValue(
      {
        status: "authenticated",
        sessionId: `supabase-${data.user.id}`,
        userId: data.user.id,
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: this.getDisplayName(data.user.user_metadata),
          createdAt: data.user.created_at ?? nowIso(),
        },
        expiresAt: data.session.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : undefined,
        isMock: false,
      },
      data.session.access_token,
    );
  }

  async signUp(input: SignUpRequest): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName?.trim() || undefined;
    const { error } = await this.service.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    });

    if (error && !error.message.toLowerCase().includes("already")) {
      throw new Error(error.message);
    }

    return this.signIn({ email, password: input.password });
  }

  async signOut(request: Request): Promise<SignOutResponse> {
    return {
      success: true,
      session: this.createGuestSession(),
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
    const { data, error } = await this.actorFilter(
      this.service.from("entitlements").select("*").eq("active", true),
      actor,
    )
      .order("activated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? toEntitlement(data) : createFreeEntitlement(actor);
  }

  async activateBuildPro(
    actor: PersistenceActor,
    input: {
      paymentProvider: "mock" | "stripe";
      buildId?: string;
      checkoutSessionId?: string;
    },
  ): Promise<Entitlement> {
    const now = nowIso();
    const checkoutSessionId =
      input.checkoutSessionId ?? `${input.paymentProvider}-checkout-${Date.now()}`;

    await this.upsertCheckoutSession(actor, {
      plan: "build_pro",
      paymentProvider: input.paymentProvider,
      checkoutSessionId,
      status: "completed",
    });

    const { data, error } = await this.service
      .from("entitlements")
      .insert({
        user_id: actor.userId ?? null,
        session_id: actor.sessionId,
        plan: "build_pro",
        build_id: input.buildId ?? MOCK_BUILD_ID,
        active: true,
        payment_provider: input.paymentProvider,
        checkout_session_id: checkoutSessionId,
        activated_at: now,
        started_at: now,
        expires_at: null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return toEntitlement(data);
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
    return this.upsertCheckoutSession(actor, input);
  }

  async getUsageStatus(actor: PersistenceActor): Promise<UsageStatus> {
    const [entitlement, usageRow, replacementRow] = await Promise.all([
      this.getEntitlement(actor),
      this.getUsageCounter(actor),
      this.getReplacementCounter(actor),
    ]);
    const plan = entitlement.active ? entitlement.plan : "free";
    const replacementLimit =
      plan === "build_pro"
        ? BUILD_PRO_PLAN.replacementLimit ?? 25
        : FREE_PLAN.replacementLimit ?? 3;
    const replacementsUsed = replacementRow?.replacements_used_for_build ?? 0;
    const remainingReplacements = Math.max(0, replacementLimit - replacementsUsed);

    if (plan === "build_pro") {
      const limit = BUILD_PRO_PLAN.aiQuestionsPerBuild ?? 50;
      const usedForBuild = usageRow?.ai_questions_used_for_build ?? 0;
      const remaining = Math.max(0, limit - usedForBuild);

      return {
        userId: actor.userId ?? actor.sessionId,
        plan,
        aiQuestionsUsedToday: usageRow?.ai_questions_used_today ?? 0,
        aiQuestionsUsedForBuild: usedForBuild,
        aiQuestionsLimitForBuild: limit,
        remainingAiQuestions: remaining,
        canAskAiQuestion: remaining > 0,
        replacementLimit,
        replacementsUsed,
        remainingReplacements,
        canReplacePart: remainingReplacements > 0,
      };
    }

    const limit = FREE_PLAN.aiQuestionsPerDay ?? 5;
    const usedToday = usageRow?.ai_questions_used_today ?? 0;
    const remaining = Math.max(0, limit - usedToday);

    return {
      userId: actor.userId ?? actor.sessionId,
      plan,
      aiQuestionsUsedToday: usedToday,
      aiQuestionsLimitToday: limit,
      remainingAiQuestions: remaining,
      canAskAiQuestion: remaining > 0,
      replacementLimit,
      replacementsUsed,
      remainingReplacements,
      canReplacePart: remainingReplacements > 0,
    };
  }

  async consumeAiUsage(actor: PersistenceActor) {
    const usage = await this.getUsageStatus(actor);

    if (!usage.canAskAiQuestion) {
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free advisor questions for today. Build Pro unlocks 50 AI questions per build.",
      };
    }

    const row = await this.ensureUsageCounter(actor);
    const now = nowIso();
    const updates =
      usage.plan === "build_pro"
        ? { ai_questions_used_for_build: row.ai_questions_used_for_build + 1, updated_at: now }
        : { ai_questions_used_today: row.ai_questions_used_today + 1, updated_at: now };
    const { error } = await this.service.from("usage_counters").update(updates).eq("id", row.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      usage: await this.getUsageStatus(actor),
      consumed: true,
    };
  }

  async consumeReplacementUsage(actor: PersistenceActor) {
    const usage = await this.getUsageStatus(actor);

    if (!usage.canReplacePart) {
      return {
        usage,
        consumed: false,
        message:
          "You have used the Free hardware replacements for this build. Build Pro unlocks 25 replacements.",
      };
    }

    const row = await this.ensureReplacementCounter(actor);
    const { error } = await this.service
      .from("replacement_counters")
      .update({
        replacements_used_for_build: row.replacements_used_for_build + 1,
        updated_at: nowIso(),
      })
      .eq("id", row.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      usage: await this.getUsageStatus(actor),
      consumed: true,
    };
  }

  async listSavedBuilds(actor: PersistenceActor) {
    const { data, error } = await this.actorFilter(
      this.service.from("saved_builds").select("*"),
      actor,
    ).order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return {
      builds: (data ?? []).map((row) => createSavedBuildSummary(toSavedBuild(row))),
      limit: await this.getSavedBuildLimit(actor),
    };
  }

  async saveBuild(actor: PersistenceActor, input: SaveBuildInput): Promise<SaveBuildResult> {
    const now = nowIso();
    const existing = input.id ? await this.getSavedBuild(actor, input.id) : null;
    const { builds, limit } = await this.listSavedBuilds(actor);

    if (!existing && builds.length >= limit) {
      throw new Error(
        (await this.getCurrentPlan(actor)) === "build_pro"
          ? "You can save up to 10 builds with Build Pro."
          : "Your Free saved build slot is full. Build Pro unlocks up to 10 saved builds plus full export.",
      );
    }

    const safeBuild = recalculateBuild(input.build);
    const row = {
      user_id: actor.userId ?? null,
      session_id: actor.sessionId,
      name: input.name.trim() || safeBuild.name,
      build: safeBuild,
      build_needs: input.buildNeeds,
      total_price: safeBuild.totalPrice,
      compatibility_status: safeBuild.compatibilityStatus,
      owned_parts: safeBuild.parts.filter((part) => part.owned).length,
      target_use_case: safeBuild.targetUseCase,
      created_at: existing?.createdAt ?? now,
      updated_at: now,
    };

    const query = existing
      ? this.service.from("saved_builds").update(row).eq("id", existing.id).select("*").single()
      : this.service.from("saved_builds").insert(row).select("*").single();
    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    await this.persistOwnedParts(actor, toSavedBuild(data));
    const savedBuild = toSavedBuild(data);
    const nextList = await this.listSavedBuilds(actor);

    return {
      savedBuild,
      summary: createSavedBuildSummary(savedBuild),
      builds: nextList.builds,
      limit,
    };
  }

  async getSavedBuild(actor: PersistenceActor, id: string): Promise<SavedBuild | null> {
    const { data, error } = await this.actorFilter(
      this.service.from("saved_builds").select("*").eq("id", id),
      actor,
    ).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? toSavedBuild(data) : null;
  }

  async deleteSavedBuild(actor: PersistenceActor, id: string) {
    const { error } = await this.actorFilter(
      this.service.from("saved_builds").delete().eq("id", id),
      actor,
    );

    if (error) {
      throw new Error(error.message);
    }

    return this.listSavedBuilds(actor);
  }

  async trackAffiliateClick(
    actor: PersistenceActor,
    event: Omit<AffiliateClickEvent, "clickedAt"> & { clickedAt?: string },
  ): Promise<AffiliateClickEvent> {
    const clickedAt = event.clickedAt ?? nowIso();
    const buildId = event.buildId ?? MOCK_BUILD_ID;
    const clickEvent: AffiliateClickEvent = {
      ...event,
      userId: event.userId ?? actor.userId ?? actor.sessionId,
      buildId,
      clickedAt,
    };
    const { error } = await this.service.from("affiliate_clicks").insert({
      user_id: actor.userId ?? null,
      session_id: actor.sessionId,
      build_id: buildId,
      part_id: clickEvent.partId,
      merchant: clickEvent.merchant,
      url: clickEvent.url,
      clicked_at: clickedAt,
    });

    if (error) {
      throw new Error(error.message);
    }

    return clickEvent;
  }

  async resetActor(actor: PersistenceActor) {
    await Promise.all([
      this.actorFilter(this.service.from("saved_builds").delete(), actor),
      this.actorFilter(this.service.from("entitlements").delete(), actor),
      this.actorFilter(this.service.from("usage_counters").delete(), actor),
      this.actorFilter(this.service.from("replacement_counters").delete(), actor),
      this.actorFilter(this.service.from("owned_parts").delete(), actor),
      this.actorFilter(this.service.from("affiliate_clicks").delete(), actor),
      this.actorFilter(this.service.from("checkout_sessions").delete(), actor),
    ]);

    return {
      entitlement: createFreeEntitlement(actor),
      usage: await this.getUsageStatus(actor),
    };
  }

  private createGuestSession(): AuthSession {
    return {
      status: "guest",
      sessionId: MOCK_GUEST_SESSION_ID,
      userId: MOCK_GUEST_SESSION_ID,
      isMock: true,
    };
  }

  private getDisplayName(metadata: Record<string, unknown> | null | undefined) {
    const displayName = metadata?.display_name;
    return typeof displayName === "string" && displayName.trim() ? displayName : undefined;
  }

  private async upsertAppUser(input: { id: string; email: string; displayName?: string }) {
    const now = nowIso();
    const { error } = await this.service.from("app_users").upsert(
      {
        id: input.id,
        email: input.email,
        display_name: input.displayName ?? null,
        auth_provider: "supabase",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  private actorFilter<T extends { eq: (column: string, value: string) => T }>(
    query: T,
    actor: PersistenceActor,
  ): T {
    return actor.userId ? query.eq("user_id", actor.userId) : query.eq("session_id", actor.sessionId);
  }

  private async getCurrentPlan(actor: PersistenceActor): Promise<PlanType> {
    const entitlement = await this.getEntitlement(actor);
    return entitlement.active ? entitlement.plan : "free";
  }

  private async getSavedBuildLimit(actor: PersistenceActor) {
    return (await this.getCurrentPlan(actor)) === "build_pro" ? 10 : 1;
  }

  private async getUsageCounter(actor: PersistenceActor): Promise<UsageCounterRow | null> {
    const { data, error } = await this.actorFilter(
      this.service
        .from("usage_counters")
        .select("*")
        .eq("counter_date", todayKey())
        .eq("build_id", MOCK_BUILD_ID),
      actor,
    ).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private async ensureUsageCounter(actor: PersistenceActor): Promise<UsageCounterRow> {
    const existing = await this.getUsageCounter(actor);

    if (existing) {
      return existing;
    }

    const now = nowIso();
    const { data, error } = await this.service
      .from("usage_counters")
      .insert({
        user_id: actor.userId ?? null,
        session_id: actor.sessionId,
        build_id: MOCK_BUILD_ID,
        counter_date: todayKey(),
        ai_questions_used_today: 0,
        ai_questions_used_for_build: 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private async getReplacementCounter(actor: PersistenceActor): Promise<ReplacementCounterRow | null> {
    const { data, error } = await this.actorFilter(
      this.service.from("replacement_counters").select("*").eq("build_id", MOCK_BUILD_ID),
      actor,
    ).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private async ensureReplacementCounter(actor: PersistenceActor): Promise<ReplacementCounterRow> {
    const existing = await this.getReplacementCounter(actor);

    if (existing) {
      return existing;
    }

    const now = nowIso();
    const { data, error } = await this.service
      .from("replacement_counters")
      .insert({
        user_id: actor.userId ?? null,
        session_id: actor.sessionId,
        build_id: MOCK_BUILD_ID,
        replacements_used_for_build: 0,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private async persistOwnedParts(actor: PersistenceActor, savedBuild: SavedBuild) {
    const ownedParts = savedBuild.build.parts.filter((part) => part.owned || part.source === "user_owned");

    await this.actorFilter(
      this.service.from("owned_parts").delete().eq("build_id", savedBuild.id),
      actor,
    );

    if (ownedParts.length === 0) {
      return;
    }

    const now = nowIso();
    const { error } = await this.service.from("owned_parts").insert(
      ownedParts.map((part) => ({
        user_id: actor.userId ?? null,
        session_id: actor.sessionId,
        build_id: savedBuild.id,
        part,
        notes: null,
        created_at: now,
        updated_at: now,
      })),
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  private async upsertCheckoutSession(
    actor: PersistenceActor,
    input: {
      plan: PlanType;
      paymentProvider: "mock" | "stripe";
      checkoutSessionId?: string;
      status: "created" | "completed" | "cancelled" | "failed";
    },
  ): Promise<CheckoutSessionRecord> {
    const now = nowIso();
    const { data, error } = await this.service.from("checkout_sessions").upsert(
      {
        user_id: actor.userId ?? null,
        session_id: actor.sessionId,
        plan: input.plan,
        payment_provider: input.paymentProvider,
        checkout_session_id: input.checkoutSessionId ?? null,
        status: input.status,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "checkout_session_id" },
    ).select("*").single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id ?? undefined,
      sessionId: data.session_id,
      plan: data.plan,
      paymentProvider: data.payment_provider,
      checkoutSessionId: data.checkout_session_id ?? undefined,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export function createServerPersistenceStore(): PersistenceStore {
  if (isSupabasePersistenceEnabled()) {
    return new SupabasePersistenceStore();
  }

  return new MockPersistenceStore();
}
