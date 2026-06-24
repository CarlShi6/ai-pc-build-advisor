# Milestone 12: Supabase Production Wiring

Milestone 12 replaces the placeholder server persistence path with Supabase Auth and Supabase Postgres when production environment variables are configured. The local mock fallback remains available when Supabase is not configured.

## What Was Wired

- Added the official Supabase JavaScript client.
- Added server-only Supabase client helpers in `src/lib/supabase/server.ts`.
- Added database row types in `src/lib/supabase/types.ts`.
- Implemented `SupabasePersistenceStore` behind the existing persistence interface.
- Kept `MockPersistenceStore` as the fallback when Supabase env vars are missing.
- Wired auth endpoints to Supabase Auth:
  - `GET /api/auth/session`
  - `POST /api/auth/sign-in`
  - `POST /api/auth/sign-up`
  - `POST /api/auth/sign-out`
- Persisted saved builds, Build Pro entitlements, usage counters, replacement counters, owned parts, affiliate clicks, and checkout sessions.
- Preserved Stripe checkout creation and mock checkout fallback.

## Required Environment Variables

Server-only:

```txt
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

Do not prefix the service role key with `VITE_`. It must never be exposed to the frontend.

## Database Tables

Schema documentation lives in `docs/supabase/schema.sql`.

Tables:

- `app_users`
- `saved_builds`
- `entitlements`
- `usage_counters`
- `replacement_counters`
- `owned_parts`
- `affiliate_clicks`
- `checkout_sessions`

## RLS Policy Notes

The internal API uses the Supabase service role key server-side, so it bypasses RLS for trusted server writes. RLS is still enabled and documented so future browser-side Supabase access is protected by `auth.uid() = user_id`.

Guest/mock session rows use `session_id` and are intended for local/demo behavior, not long-term anonymous production accounts.

## Mock Fallback Behavior

If any of these are missing, the app uses the mock persistence store:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Mock mode keeps local sign-in/sign-up behavior, guest mode, saved builds, usage limits, replacement limits, affiliate click tracking, Build Pro mock unlocks, and checkout-session recording in memory. Data resets when the dev server restarts.

## Local Testing Steps

Without Supabase:

1. Leave Supabase env vars unset.
2. Start the app.
3. Use guest mode or mock sign in.
4. Save a build, consume AI usage, replace parts, add owned parts, click affiliate links, and use mock Build Pro.
5. Restart the dev server to confirm mock data is ephemeral.

With Supabase:

1. Create a Supabase project.
2. Run `docs/supabase/schema.sql` in the Supabase SQL editor.
3. Set the three Supabase env vars in local/private environment configuration.
4. Start the app.
5. Sign up or sign in with email/password.
6. Save a build and confirm rows appear in `app_users`, `saved_builds`, and `owned_parts` when applicable.
7. Use advisor/replacement flows and confirm `usage_counters` and `replacement_counters`.
8. Use Build Pro mock upgrade and confirm `entitlements` plus `checkout_sessions`.
9. Click purchase links and confirm `affiliate_clicks`.

## Production Setup Checklist

- Configure Supabase Auth email/password settings.
- Run the schema SQL and review RLS policies.
- Store `SUPABASE_SERVICE_ROLE_KEY` only in server-side hosting secrets.
- Store `SUPABASE_ANON_KEY` only as server config unless a future browser Supabase client is introduced.
- Verify sign-up policy for email confirmation matches the product flow.
- Configure Stripe keys separately for real checkout.
- Confirm API routes run in a trusted server environment.
- Add monitoring for auth failures, entitlement activation, checkout-session writes, and fallback usage.

## Remaining TODOs for Stripe Webhook Persistence

- Verify Stripe webhook signatures using the raw request body and `STRIPE_WEBHOOK_SECRET`.
- Mark `checkout_sessions` rows completed/cancelled/failed from verified Stripe events.
- Enforce idempotency by checking `checkout_session_id` before activating entitlements.
- Store Stripe event ids if duplicate webhook detection needs event-level auditing.
- Add integration tests for checkout creation, webhook completion, and duplicate webhook delivery.

## Validation

Required commands:

```bash
npx.cmd tsc --noEmit
npx.cmd vite build --configLoader runner
```
