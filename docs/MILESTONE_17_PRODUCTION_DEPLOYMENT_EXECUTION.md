# Milestone 17: Production Deployment Execution

## Goal

Deploy the app from GitHub to a production hosting platform using the Milestone 16 deployment setup and the Milestone 15 Supabase verification flow.

## Recommended Platform

Use Cloudflare Pages or Cloudflare Workers as the first production target.

Reason: this TanStack Start app is built through `@lovable.dev/vite-tanstack-config`, and the existing `vite.config.ts` notes that Nitro is already included with a Cloudflare-oriented default target. The production build emits a server handler at `dist/server/server.js` and browser assets under `dist/client`, so the app must be deployed as a server-rendered app rather than a static-only site.

No platform config file is added in this milestone because the repository does not yet contain a selected Cloudflare project, deployment account, custom domain, or required checked-in routing file. Keep deployment secrets and platform bindings in the hosting provider's dashboard or secret manager. Add a minimal host config later only if the chosen platform requires one for repeatable deploys.

## GitHub Deployment Steps

1. Push the production-ready branch to GitHub and confirm `main` is the default branch.
2. In the hosting platform, create a new project from the GitHub repository.
3. Select `main` as the production branch.
4. Choose the server-rendered or framework deployment mode for TanStack Start/Nitro when prompted.
5. Set the install command:

```txt
npm ci
```

6. Set the build command:

```txt
npm run build
```

Use `npm.cmd run build` only for Windows-based deployment runners. Most hosted GitHub deployment runners use Unix-like environments, where `npm run build` is the portable command.

7. Do not set the app up as static-only hosting.
8. Confirm the platform serves `dist/client` assets and runs the generated server handler from `dist/server/server.js`.
9. Add production environment variables before the first production deploy.
10. Deploy the project and capture the final production origin.
11. Set or update `PUBLIC_APP_URL` to the final production origin.
12. Redeploy after updating `PUBLIC_APP_URL`.

## Production Server Behavior

This project does not currently define a separate `start` script in `package.json`.

Production request handling is provided by the generated TanStack Start/Nitro server output:

```txt
dist/client
dist/server/server.js
```

The server handler is responsible for:

- SSR application routes.
- Internal API routes under `/api`.
- Supabase auth and persistence calls.
- AI advisor API calls.
- Checkout and webhook routes.
- Affiliate click tracking.
- The controlled Supabase smoke test route.

If the hosting platform asks for an output directory, use the platform's TanStack Start/Nitro guidance and ensure it includes both the server bundle and client assets. If it only accepts a single static directory, it is not appropriate for this deployment without an adapter change.

## Required Production Environment Variables

Set these in the hosting platform's production environment or secret manager:

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

Use this only during controlled production verification:

```txt
SUPABASE_SMOKE_TEST_ENABLED=true
```

After verification, set `SUPABASE_SMOKE_TEST_ENABLED=false` or remove it and redeploy if the platform requires redeploys for environment changes.

Never commit real `.env` files. Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, webhook secrets, or AI provider keys with a `VITE_` prefix.

## Supabase Auth Redirect Updates

Before production smoke testing:

1. Apply `docs/supabase/schema.sql` to the production Supabase project.
2. Confirm Supabase Auth email/password is enabled.
3. In Supabase Auth URL settings, set the site URL to the production origin.
4. Add the production origin to allowed redirect URLs.
5. Add any custom domain and platform preview domain only if those URLs are intentionally used for auth testing.
6. Confirm `PUBLIC_APP_URL` exactly matches the production origin used by users.
7. Confirm all Supabase variables are set in the hosting platform's production environment.
8. Confirm no Supabase service role key is available to browser code.

## Production Smoke Test Flow

1. Open the deployed production URL and confirm the app loads.
2. Temporarily enable `SUPABASE_SMOKE_TEST_ENABLED=true`.
3. Redeploy or restart the deployment if the platform requires it for environment variable changes.
4. Request:

```txt
GET https://your-production-domain.example/api/smoke/supabase
```

5. Confirm the response reports `status: "ok"` and boolean checks for URL, anon key, service role key, and query.
6. Confirm the endpoint does not return secrets, database rows, user data, or raw database errors.
7. Disable `SUPABASE_SMOKE_TEST_ENABLED`.
8. Sign up with a test email/password.
9. Sign out and sign back in.
10. Save a build, refresh, and confirm the saved build persists.
11. Confirm the expected rows appear in production Supabase.
12. Ask an advisor question and confirm usage tracking updates.
13. Test the checkout path appropriate for the production configuration.
14. Click a retailer link and confirm affiliate click tracking records the event.
15. Test the same account in a private window and confirm saved data is still available.

## Rollback Plan

1. Use the hosting platform's deployment history to redeploy the last known-good production deployment.
2. If the issue is environment-related, revert the changed environment variable and redeploy or restart.
3. If the issue is Supabase-related, keep the app deployed but temporarily set `PERSISTENCE_PROVIDER=mock` only for emergency user-facing availability. Treat this as temporary because data will not persist across server restarts.
4. If auth is failing after a domain change, restore the previous production domain in Supabase Auth settings or revert `PUBLIC_APP_URL`.
5. If checkout is failing, remove live Stripe variables or restore the prior Stripe price/webhook configuration.
6. After rollback, rerun the production smoke test flow before marking the incident resolved.

## Common Deployment Failures

Build fails during install:

- Confirm the platform uses `npm ci`.
- Confirm `package-lock.json` is committed and matches `package.json`.
- Clear the platform build cache and retry.

Build succeeds but the app returns a server error:

- Confirm the platform is running the generated server handler, not serving only `dist/client`.
- Confirm required production environment variables are present.
- Confirm secrets are configured for the production environment, not only preview or development.

Saved builds disappear after refresh or redeploy:

- Confirm `PERSISTENCE_PROVIDER=supabase`.
- Confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are present.
- Run the controlled Supabase smoke test.

Sign-in or sign-up fails:

- Confirm Supabase Auth email/password is enabled.
- Confirm the production origin is allowed in Supabase Auth URL settings.
- Confirm the app is using the production Supabase project, not a local or staging project.

Smoke endpoint is disabled:

- Confirm `SUPABASE_SMOKE_TEST_ENABLED=true` is set in the production environment.
- Redeploy or restart if the platform does not apply environment changes immediately.
- Disable the flag again after verification.

Checkout does not redirect correctly:

- Confirm `PUBLIC_APP_URL` is the exact production origin.
- Confirm live Stripe variables are present only when live checkout should be enabled.
- Confirm webhook URLs in Stripe point to the production deployment.

## Validation

Run before executing production deployment:

```bash
npm.cmd run build
```

The build should emit `dist/client` and `dist/server/server.js` without errors.
