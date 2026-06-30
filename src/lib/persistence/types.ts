import type { CustomerNeeds } from "@/types/api";
import type {
  Build,
  PostBuildFeedback,
  PostBuildFeedbackInput,
  SavedBuild,
  SavedBuildSummary,
} from "@/types/build";
import type {
  AffiliateClickEvent,
  Entitlement,
  PlanType,
  UsageStatus,
} from "@/types/monetization";
import type { Part } from "@/types/parts";

export type AuthStatus = "guest" | "authenticated" | "signed_out";

export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
}

export interface AuthSession {
  status: AuthStatus;
  user?: User;
  userId?: string;
  sessionId: string;
  expiresAt?: string;
  isMock: boolean;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignOutResponse {
  success: boolean;
  session: AuthSession;
  message: string;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  authProvider: "mock" | "supabase";
}

export interface SavedBuildRecord {
  id: string;
  userId?: string;
  sessionId: string;
  name: string;
  build: Build;
  buildNeeds: CustomerNeeds;
  totalPrice: number;
  compatibilityStatus: Build["compatibilityStatus"];
  ownedParts: number;
  targetUseCase: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementRecord extends Entitlement {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCounterRecord {
  id: string;
  userId?: string;
  sessionId: string;
  buildId?: string;
  aiQuestionsUsedToday: number;
  aiQuestionsUsedForBuild: number;
  counterDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReplacementCounterRecord {
  id: string;
  userId?: string;
  sessionId: string;
  buildId?: string;
  replacementsUsedForBuild: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnedPartRecord {
  id: string;
  userId?: string;
  sessionId: string;
  buildId?: string;
  part: Part;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateClickRecord extends AffiliateClickEvent {
  id: string;
  userId?: string;
  sessionId: string;
  buildId?: string;
  clickedAt: string;
}

export interface PostBuildFeedbackRecord extends PostBuildFeedback {}

export interface CheckoutSessionRecord {
  id: string;
  userId?: string;
  sessionId: string;
  plan: PlanType;
  paymentProvider: "mock" | "stripe";
  checkoutSessionId?: string;
  status: "created" | "completed" | "cancelled" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface PersistenceActor {
  userId?: string;
  sessionId: string;
}

export interface SaveBuildInput {
  id?: string;
  name: string;
  build: Build;
  buildNeeds: CustomerNeeds;
}

export interface SaveBuildResult {
  savedBuild: SavedBuild;
  summary: SavedBuildSummary;
  builds: SavedBuildSummary[];
  limit: number;
}

export interface SavePostBuildFeedbackResult {
  feedback: PostBuildFeedback;
  savedBuild: SavedBuild;
  summary: SavedBuildSummary;
  builds: SavedBuildSummary[];
  limit: number;
}

export interface PersistenceStore {
  getSession(request: Request): Promise<AuthSession>;
  signIn(input: SignInRequest): Promise<AuthSession>;
  signUp(input: SignUpRequest): Promise<AuthSession>;
  signOut(request: Request): Promise<SignOutResponse>;
  getActor(request: Request): Promise<PersistenceActor>;
  getEntitlement(actor: PersistenceActor): Promise<Entitlement>;
  activateBuildPro(actor: PersistenceActor, input: {
    paymentProvider: "mock" | "stripe";
    buildId?: string;
    checkoutSessionId?: string;
  }): Promise<Entitlement>;
  recordCheckoutSession(actor: PersistenceActor, input: {
    plan: PlanType;
    paymentProvider: "mock" | "stripe";
    checkoutSessionId?: string;
    status: CheckoutSessionRecord["status"];
  }): Promise<CheckoutSessionRecord>;
  getUsageStatus(actor: PersistenceActor): Promise<UsageStatus>;
  consumeAiUsage(actor: PersistenceActor): Promise<{
    usage: UsageStatus;
    consumed: boolean;
    message?: string;
  }>;
  consumeReplacementUsage(actor: PersistenceActor): Promise<{
    usage: UsageStatus;
    consumed: boolean;
    message?: string;
  }>;
  listSavedBuilds(actor: PersistenceActor): Promise<{
    builds: SavedBuildSummary[];
    limit: number;
  }>;
  saveBuild(actor: PersistenceActor, input: SaveBuildInput): Promise<SaveBuildResult>;
  getSavedBuild(actor: PersistenceActor, id: string): Promise<SavedBuild | null>;
  deleteSavedBuild(actor: PersistenceActor, id: string): Promise<{
    builds: SavedBuildSummary[];
    limit: number;
  }>;
  savePostBuildFeedback(
    actor: PersistenceActor,
    input: PostBuildFeedbackInput,
  ): Promise<SavePostBuildFeedbackResult>;
  trackAffiliateClick(
    actor: PersistenceActor,
    event: Omit<AffiliateClickEvent, "clickedAt"> & { clickedAt?: string },
  ): Promise<AffiliateClickEvent>;
  resetActor(actor: PersistenceActor): Promise<{
    entitlement: Entitlement;
    usage: UsageStatus;
  }>;
}
