import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Image recognition provider (v3 photo analysis).
    aiProvider: process.env.AI_PROVIDER,
    // Build advisor chat provider; separate so turning on image recognition keeps the advisor on mock.
    advisorAiProvider: process.env.ADVISOR_AI_PROVIDER,
    openAiApiKey: process.env.OPENAI_API_KEY,
    aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
    aiProviderModel: process.env.AI_PROVIDER_MODEL ?? "gpt-4.1-mini",
    // Photo analysis model. gpt-5.4 read a real photo far better than gpt-4.1-mini (about 9x the
    // cost per photo); set IMAGE_AI_MODEL=gpt-4.1-mini for the cheaper model.
    imageAiModel: process.env.IMAGE_AI_MODEL || "gpt-5.4",
    // Reasoning effort for a reasoning image model (gpt-5.x, o-series): none | minimal | low | ...
    imageAiReasoningEffort: process.env.IMAGE_AI_REASONING_EFFORT || "low",
    // Global photo analyses per UTC day (default 100); counted in the IMAGE_CAP_DB D1 binding.
    imageAnalysisDailyCap: process.env.IMAGE_ANALYSIS_DAILY_CAP,
    // Cloudflare Turnstile secret; when set, Analyze needs a passed human check.
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
    priceProvider: process.env.PRICE_PROVIDER,
    bestBuyApiKey: process.env.BEST_BUY_API_KEY,
    persistenceProvider: process.env.PERSISTENCE_PROVIDER,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripeBuildProPriceId: process.env.STRIPE_BUILD_PRO_PRICE_ID,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseSmokeTestEnabled: process.env.SUPABASE_SMOKE_TEST_ENABLED,
    publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:5173",
  };
}
