/**
 * Cloudflare Worker bindings (D1, rate limiting) for the request being served. Nitro's
 * Cloudflare preset hands the app only the Request, so bindings come from the
 * `cloudflare:workers` module. Outside Workers (Vite dev, Vitest, Node) the module does not
 * exist and this resolves to null; callers then use their in-memory fallbacks.
 *
 * String vars and secrets still arrive in `process.env` (nodejs_compat); see config.server.ts.
 */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(query: string): D1Statement;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerBindings {
  IMAGE_CAP_DB?: D1Like;
  IMAGE_RATE_LIMITER?: RateLimitBinding;
}

let bindings: Promise<WorkerBindings | null> | undefined;

export function workerBindings(): Promise<WorkerBindings | null> {
  if (!bindings) {
    // A variable specifier keeps bundlers from resolving it; only workerd provides it.
    const specifier = "cloudflare:workers";
    bindings = import(/* @vite-ignore */ specifier)
      .then((module: { env?: WorkerBindings }) => module.env ?? null)
      .catch(() => null);
  }
  return bindings;
}
