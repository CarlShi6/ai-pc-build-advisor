# Milestone 15: Production Supabase Deploy Verification

## Goal

Verify that a deployed environment is using the production Supabase configuration and that the app's auth and persistence flows behave as expected after deployment.

## Current Supabase Environment Usage

Supabase configuration is read only from server-side code in `src/lib/config.server.ts` and `src/lib/supabase/server.ts`.

Production Supabase mode is active when the server has all three Supabase variables and `PERSISTENCE_PROVIDER` is not set to `mock`:

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are used by the server auth client for email/password sign-in. `SUPABASE_SERVICE_ROLE_KEY` is used only by trusted server routes for database reads and writes.

If any required Supabase variable is missing, or if `PERSISTENCE_PROVIDER=mock`, the app falls back to in-memory mock persistence. That fallback is useful for local development but is not deployment-ready persistence.

## Required Production Variables

Set these in the hosting provider's server-side environment or secret manager:

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
PUBLIC_APP_URL=https://your-production-domain.example
```

Also configure these when the production deployment should use live AI and checkout behavior:

```txt
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_API_KEY=your_generic_ai_provider_key_here
AI_PROVIDER_MODEL=gpt-4.1-mini
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BUILD_PRO_PRICE_ID=price_your_build_pro_price_id_here
```

Do not commit `.env`, `.env.local`, `.env.production`, or any other real environment files. Do not expose service role keys, Stripe secrets, webhook secrets, or AI provider keys with a `VITE_` prefix.

## Pre-Deploy Supabase Checks

Before verifying the deployed app:

1. Confirm `docs/supabase/schema.sql` has been run in the target Supabase project.
2. Confirm the expected tables exist: `app_users`, `saved_builds`, `entitlements`, `usage_counters`, `replacement_counters`, `owned_parts`, `affiliate_clicks`, and `checkout_sessions`.
3. Confirm Supabase Auth email/password is enabled.
4. Confirm the production domain is allowed in Supabase Auth URL settings if redirects are introduced later.
5. Confirm row-level security policies from the schema are present. The current app writes through server routes with the service role key, but RLS should remain enabled for future browser-side Supabase access.

## Safe Production Smoke Test

Temporarily enable the server-only Supabase smoke endpoint in the deployed environment:

```txt
SUPABASE_SMOKE_TEST_ENABLED=true
```

Then request:

```txt
GET https://your-production-domain.example/api/smoke/supabase
```

Expected result:

```json
{
  "status": "ok",
  "enabled": true,
  "environment": "production",
  "checks": {
    "supabaseUrl": true,
    "supabaseAnonKey": true,
    "supabaseServiceRoleKey": true,
    "query": true
  }
}
```

The endpoint returns only boolean status flags. It must not return keys, database rows, user data, or raw database errors.

After verification, set:

```txt
SUPABASE_SMOKE_TEST_ENABLED=false
```

or remove the variable unless the deployment process intentionally uses this route as a controlled health check.

## Deployed Smoke Test Checklist

Run this checklist against the deployed app after the safe smoke endpoint passes:

1. Open the production URL and confirm the app loads without server errors.
2. Sign up with a test email/password and confirm the UI shows an authenticated session.
3. Confirm Supabase Auth has the test user and `app_users` has a matching row.
4. Sign out and confirm guest mode is restored.
5. Sign back in with the same test account and confirm the authenticated session returns.
6. Create or adjust a recommended build, save it, refresh the browser, and confirm the saved build remains available.
7. Confirm `saved_builds` has a row for the authenticated user and `owned_parts` rows appear when owned parts are included.
8. Ask an advisor question and confirm `usage_counters` updates for the authenticated user.
9. Replace a part and confirm `replacement_counters` updates for the authenticated user.
10. Trigger the Build Pro flow appropriate for the deployment and confirm `checkout_sessions` and `entitlements` are written.
11. Click a purchase/retailer link and confirm `affiliate_clicks` receives a row.
12. Open the deployed app in a second browser or private window, sign in as the same test user, and confirm saved data is still available.
13. Remove or disable `SUPABASE_SMOKE_TEST_ENABLED` and confirm `/api/smoke/supabase` no longer exposes an enabled production check.

## Production Behavior Expectations

Auth:

- Sign-up creates a Supabase Auth user through the server service client and then signs the user in.
- Sign-in uses the Supabase anon key server-side and stores the access token in the app session cookie.
- Session checks validate the cookie token with Supabase before returning authenticated user state.
- Sign-out clears the app session cookie and returns the browser to guest mode.

Persistence:

- Authenticated saved builds, usage counters, replacement counters, entitlements, checkout sessions, owned parts, and affiliate clicks are scoped by Supabase `user_id`.
- Guest rows use the app's guest `session_id`; they are not a substitute for long-term anonymous production accounts.
- The service role key bypasses RLS only inside trusted server routes. It must stay server-only.
- If the deployed app behaves like data resets on refresh or redeploy, verify that `PERSISTENCE_PROVIDER=supabase` is set and that all three Supabase variables are present.

## Verification Result

Code changes were not required for this milestone. Production readiness is documented through the checklist above, and local build validation should be run with:

```bash
npm.cmd run build
```
