# Milestone 13: Production Environment And Smoke Test

Milestone 13 adds a committed environment template and a server-only Supabase smoke test for deployment checks.

## Environment Files

Use `.env.example` as the safe template. It contains placeholder values only and must not contain real API keys, service role keys, webhook secrets, or production URLs.

For local development, copy the needed values into `.env.local`. Local private files such as `.env`, `.env.local`, and `.env.*` are ignored by git, while `.env.example` stays committed.

## Local Setup

Mock mode is the default local setup:

```txt
PERSISTENCE_PROVIDER=mock
```

In mock mode, Supabase variables can be omitted. Sign-in, guest sessions, saved builds, usage limits, replacement limits, checkout records, affiliate clicks, and mock Build Pro unlocks use in-memory storage and reset when the dev server restarts.

To test Supabase locally:

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

Run `docs/supabase/schema.sql` in the Supabase SQL editor before using Supabase mode.

## Production Deployment Variables

Set these server-side hosting variables for production persistence:

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

Also configure the non-persistence services used by the app when those features should be live:

```txt
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_API_KEY=your_generic_ai_provider_key_here
AI_PROVIDER_MODEL=gpt-4.1-mini
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BUILD_PRO_PRICE_ID=price_your_build_pro_price_id_here
PUBLIC_APP_URL=https://your-production-domain.example
```

`SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, AI provider keys, and webhook secrets must never be committed and must never use a `VITE_` prefix. Any `VITE_` variable is browser-visible.

## Supabase Smoke Test

Endpoint:

```txt
GET /api/smoke/supabase
```

The route runs automatically in development. Outside development it returns a disabled response unless explicitly enabled:

```txt
SUPABASE_SMOKE_TEST_ENABLED=true
```

The smoke test checks:

- Supabase URL is present.
- Supabase anon key is present.
- Supabase service role key is present on the server.
- A basic server-side query against `app_users` succeeds.

The response is intentionally safe. It returns status flags only and never returns the service role key, anon key, database rows, or raw database errors.

Example success response:

```json
{
  "status": "ok",
  "enabled": true,
  "environment": "development",
  "checks": {
    "supabaseUrl": true,
    "supabaseAnonKey": true,
    "supabaseServiceRoleKey": true,
    "query": true
  }
}
```

Disable `SUPABASE_SMOKE_TEST_ENABLED` after production verification unless the deployment process requires ongoing health checks.

## Validation

Required command:

```bash
npm.cmd run build
```
