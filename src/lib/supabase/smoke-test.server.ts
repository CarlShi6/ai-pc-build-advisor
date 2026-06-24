import { getServerConfig } from "@/lib/config.server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type SmokeStatus = "ok" | "disabled" | "missing_configuration" | "query_failed";

export type SupabaseSmokeTestResponse = {
  status: SmokeStatus;
  enabled: boolean;
  environment: string;
  checks: {
    supabaseUrl: boolean;
    supabaseAnonKey: boolean;
    supabaseServiceRoleKey: boolean;
    query: boolean;
  };
};

function isExplicitlyEnabled(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

export async function runSupabaseSmokeTest(): Promise<{
  body: SupabaseSmokeTestResponse;
  httpStatus: number;
}> {
  const config = getServerConfig();
  const environment = config.nodeEnv ?? "unknown";
  const enabled = environment === "development" || isExplicitlyEnabled(config.supabaseSmokeTestEnabled);
  const checks = {
    supabaseUrl: Boolean(config.supabaseUrl),
    supabaseAnonKey: Boolean(config.supabaseAnonKey),
    supabaseServiceRoleKey: Boolean(config.supabaseServiceRoleKey),
    query: false,
  };

  if (!enabled) {
    return {
      httpStatus: 404,
      body: {
        status: "disabled",
        enabled: false,
        environment,
        checks,
      },
    };
  }

  if (!checks.supabaseUrl || !checks.supabaseAnonKey || !checks.supabaseServiceRoleKey) {
    return {
      httpStatus: 503,
      body: {
        status: "missing_configuration",
        enabled: true,
        environment,
        checks,
      },
    };
  }

  try {
    const client = createSupabaseServiceClient();
    const { error } = await client.from("app_users").select("id", { count: "exact", head: true });

    if (error) {
      return {
        httpStatus: 503,
        body: {
          status: "query_failed",
          enabled: true,
          environment,
          checks,
        },
      };
    }

    return {
      httpStatus: 200,
      body: {
        status: "ok",
        enabled: true,
        environment,
        checks: {
          ...checks,
          query: true,
        },
      },
    };
  } catch {
    return {
      httpStatus: 503,
      body: {
        status: "query_failed",
        enabled: true,
        environment,
        checks,
      },
    };
  }
}
