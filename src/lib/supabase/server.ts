import { createClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/lib/config.server";
import type { Database } from "@/lib/supabase/types";

export function isSupabaseServerConfigured() {
  const config = getServerConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.supabaseServiceRoleKey);
}

export function createSupabaseServiceClient() {
  const config = getServerConfig();

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase service client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAuthClient() {
  const config = getServerConfig();

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase auth client requires SUPABASE_URL and SUPABASE_ANON_KEY.");
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
