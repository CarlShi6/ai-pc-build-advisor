# Milestone 16: Production Deployment Platform Setup

## Goal

Prepare the TanStack Start app for production deployment on a hosting platform, building on the Milestone 15 Supabase production deployment verification checklist.

## Current Deployment Shape

This project uses TanStack Start through `@lovable.dev/vite-tanstack-config`.

Relevant scripts:

```txt
Install command: npm ci
Build command: npm.cmd run build
Build script: vite build --configLoader runner
Local preview script: npm.cmd run preview
```

The existing `vite.config.ts` delegates TanStack Start, React, Tailwind, path aliases, and Nitro setup to `@lovable.dev/vite-tanstack-config`. That config currently builds Nitro with a Cloudflare-oriented default target and uses `src/server.ts` as the server entry.

No platform-specific deployment file is currently required in this repository. Add one later only when the selected host requires checked-in configuration, and keep secrets in that host's environment or secret manager.

## Build Output And Server Behavior

After a successful production build, the generated output is:

```txt
dist/client
dist/server/server.js
```

`dist/client` contains browser assets. `dist/server/server.js` is the server fetch handler that serves SSR routes and handles the app's internal API routes, including auth, saved builds, AI advisor calls, checkout, affiliate tracking, and the Supabase smoke test.

This is not a static-only deployment. The hosting platform must run the generated server handler and serve the client assets with it.

## Production Environment Variables

Set production variables in the deployment platform's server-side environment settings. Do not commit `.env`, `.env.local`, `.env.production`, or any real secret file.

Required for production persistence:

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
PUBLIC_APP_URL=https://your-production-domain.example
```

Optional when enabling live AI and checkout services:

```txt
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_API_KEY=your_generic_ai_provider_key_here
AI_PROVIDER_MODEL=gpt-4.1-mini
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BUILD_PRO_PRICE_ID=price_your_build_pro_price_id_here
```

Optional controlled production verification:

```txt
SUPABASE_SMOKE_TEST_ENABLED=true
```

Turn `SUPABASE_SMOKE_TEST_ENABLED` back to `false` or remove it after verification unless the deployment process intentionally keeps this endpoint enabled as a controlled health check.

Do not expose server-only values with a `VITE_` prefix. Any `VITE_` variable is browser-visible.

## Platform Setup Checklist

1. Confirm the deployment source branch is `main`.
2. Configure the install command as `npm ci`.
3. Configure the build command as `npm.cmd run build` for Windows-based runners, or `npm run build` when the hosting platform uses a Unix-like runner.
4. Configure the app as a server-rendered TanStack Start/Nitro deployment, not a static-only site.
5. Ensure the platform serves `dist/client` assets and runs `dist/server/server.js` as the server handler.
6. Set the production environment variables listed above in the platform environment or secret manager.
7. Keep all real secrets out of source control and out of platform build logs.
8. Deploy and capture the production URL.
9. Set `PUBLIC_APP_URL` to the final production origin.
10. Rebuild/redeploy after changing production environment variables.

## Supabase Redirect URL And Allowed Origins Checklist

Before smoke testing the deployed app:

1. Confirm `docs/supabase/schema.sql` has been applied to the production Supabase project.
2. Confirm Supabase Auth email/password is enabled.
3. Add the production app origin to Supabase Auth URL configuration.
4. Add the production callback or redirect URL if a future Supabase redirect-based auth flow is introduced.
5. Confirm the production domain uses HTTPS.
6. Confirm `PUBLIC_APP_URL` exactly matches the deployed production origin.
7. Confirm `PERSISTENCE_PROVIDER=supabase` and all three Supabase variables are set in the deployment platform.
8. Confirm `SUPABASE_SERVICE_ROLE_KEY` is server-only and is never exposed to the browser.

## Post-Deploy Smoke Test Steps

1. Open the production URL and confirm the app loads without a server error.
2. Temporarily set `SUPABASE_SMOKE_TEST_ENABLED=true`, redeploy if required, and request `GET /api/smoke/supabase`.
3. Confirm the smoke endpoint returns `status: "ok"` with boolean checks only.
4. Disable `SUPABASE_SMOKE_TEST_ENABLED`, redeploy if required, and confirm the endpoint is no longer enabled.
5. Sign up with a test email/password.
6. Sign out and sign back in with the same test account.
7. Save a build, refresh the page, and confirm the saved build persists.
8. Confirm the saved build appears in the production Supabase tables.
9. Ask an advisor question and confirm usage tracking behaves as expected.
10. Test the checkout path appropriate for the deployment and confirm checkout records are written.
11. Click a retailer/purchase link and confirm affiliate click tracking records the event.
12. Open the app in a private window, sign in as the same test user, and confirm saved data is still available.

## Validation

Required local validation before deploying:

```bash
npm.cmd run build
```

Record the result in the milestone summary after running the command.
