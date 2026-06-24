import { createServerPersistenceStore } from "@/lib/persistence/server-store";
import type { PersistenceStore } from "@/lib/persistence/types";

let store: PersistenceStore | null = null;

export function getPersistenceStore(): PersistenceStore {
  store ??= createServerPersistenceStore();
  return store;
}

export type {
  AuthSession,
  AuthStatus,
  PersistenceActor,
  SignInRequest,
  SignOutResponse,
  SignUpRequest,
  User,
} from "@/lib/persistence/types";
