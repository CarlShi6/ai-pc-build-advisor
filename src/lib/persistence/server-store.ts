import { getServerConfig } from "@/lib/config.server";
import { MockPersistenceStore } from "@/lib/persistence/mock-store";
import type { PersistenceStore } from "@/lib/persistence/types";

export function createServerPersistenceStore(): PersistenceStore {
  const config = getServerConfig();

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    // TODO(Milestone 11 production): wire Supabase Auth and Postgres here.
    // The persistence interface is intentionally async and database-shaped so
    // each method can be backed by Supabase row-level records without changing
    // frontend API contracts.
  }

  return new MockPersistenceStore();
}
