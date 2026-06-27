# Milestone 18: Production Host Selection and Config

## Goal

Move from deployment documentation to a concrete production hosting configuration.

## Decision

Selected hosting target: Cloudflare Workers with Workers Static Assets.

Reason: the app is a server-rendered TanStack Start app and the production build emits a Worker-style default export from `dist/server/server.js`, plus browser assets under `dist/client`. Cloudflare Workers can run the generated server handler and serve the generated client assets from the same deployment.

This milestone adds `wrangler.jsonc` as the minimal checked-in Cloudflare configuration. It does not add secrets or `.env` files.

## Platform Configuration

Use these settings in the Cloudflare project connected to the `main` branch:

```txt
Install command: npm ci
Build command: npm run build
Deployment target: Cloudflare Workers
Worker entry: dist/server/server.js
Static assets directory: dist/client
Compatibility flag: nodejs_compat
```

Use `npm.cmd run build` only for local Windows validation. Hosted Cloudflare/GitHub runners should use `npm run build`.

The checked-in Cloudflare config is:

```txt
wrangler.jsonc
```

`wrangler.jsonc` points `main` to `dist/server/server.js` and binds static assets from `dist/client`.

## Current Build Behavior

The project uses `@lovable.dev/vite-tanstack-config` with TanStack Start. In this local environment, `npm.cmd run build` logs that the Lovable/Nitro deploy plugin is skipped because no Lovable context is detected. The build still emits:

```txt
dist/client
dist/server/server.js
```

`dist/server/server.js` exports a default object with a `fetch(request, env, ctx)` handler, which is the shape expected by Cloudflare Workers.

## Required Environment Variables

Set these in the Cloudflare dashboard as production environment variables or secrets. Do not commit real values.

```txt
PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
PUBLIC_APP_URL=https://your-production-domain.example
```

Set these only when live AI and checkout should be enabled:

```txt
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_API_KEY=your_generic_ai_provider_key_here
AI_PROVIDER_MODEL=gpt-4.1-mini
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BUILD_PRO_PRICE_ID=price_your_build_pro_price_id_here
```

Set this only during controlled production verification:

```txt
SUPABASE_SMOKE_TEST_ENABLED=true
```

Disable or remove `SUPABASE_SMOKE_TEST_ENABLED` after verification.

Do not use `VITE_` for server-only secrets. `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, webhook secrets, and AI provider keys must stay server-only.

## Supabase URL And Auth Redirect Updates

Before production verification:

1. Apply `docs/supabase/schema.sql` to the production Supabase project.
2. Confirm Supabase Auth email/password is enabled.
3. Set the Supabase Auth site URL to the production origin.
4. Add the production origin to allowed redirect URLs.
5. Add the custom domain and any Cloudflare preview URL only if they will intentionally be used for auth testing.
6. Set `PUBLIC_APP_URL` to the exact production origin users will visit.
7. Confirm the Cloudflare deployment uses the production Supabase project.

## Rollback Steps

1. Use Cloudflare deployment history to redeploy the last known-good Worker version.
2. If the issue came from an environment variable change, restore the previous variable value and redeploy or restart as Cloudflare requires.
3. If Supabase production connectivity is failing, temporarily set `PERSISTENCE_PROVIDER=mock` only as an emergency availability fallback. Treat this as temporary because data will not persist reliably.
4. If auth fails after a domain change, restore the previous Supabase Auth site URL and redirect URL settings, or restore the previous `PUBLIC_APP_URL`.
5. If checkout fails, restore the previous Stripe price/webhook configuration or remove live Stripe variables until fixed.
6. After rollback, repeat the production smoke test before marking the deployment healthy.

## Post-Publish Verification

After publishing:

1. Open the production URL and confirm the app loads without a server error.
2. Confirm browser assets under `/assets/...` load successfully.
3. Temporarily set `SUPABASE_SMOKE_TEST_ENABLED=true` and redeploy or restart if required.
4. Request `GET https://your-production-domain.example/api/smoke/supabase`.
5. Confirm the response reports `status: "ok"` and only boolean checks.
6. Disable `SUPABASE_SMOKE_TEST_ENABLED` and redeploy or restart if required.
7. Sign up with a test email/password.
8. Sign out and sign back in.
9. Save a build, refresh, and confirm the saved build persists.
10. Confirm the saved build appears in production Supabase.
11. Ask an advisor question and confirm usage tracking behaves as expected.
12. Test checkout if live Stripe variables are enabled.
13. Click a retailer link and confirm affiliate click tracking records the event.
14. Test the same account in a private window and confirm saved data is still available.

## Validation

Required local validation before publishing:

```bash
npm.cmd run build
```

Milestone 18 validation result: `npm.cmd run build` completed successfully.
