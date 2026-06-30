# Milestone 19: Production Deployment Verification

## Goal

Document the successful production deployment and capture the remaining verification work needed before production auth can be considered complete.

## Deployment Target

Cloudflare Workers with Static Assets.

The app is deployed as a server-rendered TanStack Start app. Cloudflare Workers runs the generated server handler, and Cloudflare Static Assets serves the browser assets emitted by the production build.

## Production Deployment

Production URL:

```txt
https://ai-pc-build-advisor.ai-pc-build-advisor-carl.workers.dev
```

Cloudflare Version ID:

```txt
e59e7408-9ae9-414f-ae68-2ab993409ea6
```

Current production deployment status: successful.

## Commands Used

```bash
npm.cmd run build
npx.cmd wrangler login
npx.cmd wrangler deploy
```

## workers.dev Subdomain Registration Note

The production deployment uses the Cloudflare `workers.dev` subdomain:

```txt
ai-pc-build-advisor-carl.workers.dev
```

This subdomain must remain registered and available in the Cloudflare account that owns the Worker. If a custom domain is added later, keep the `workers.dev` deployment available as a fallback unless there is a deliberate reason to disable it.

## Smoke Test Checklist

1. Open the production URL and confirm the home page loads.
2. Open `/consult` and confirm the consult route loads.
3. Confirm browser assets under `/assets/...` load without errors.
4. Confirm the Worker is serving SSR routes instead of only static files.
5. Confirm no secrets are present in browser-visible output.
6. Confirm the deployed Cloudflare Version ID matches the expected production version.
7. Verify Supabase Auth with production URL settings after auth configuration is updated.
8. Save a build with a production test account and confirm persistence in Supabase.
9. Confirm usage tracking works with the production persistence provider.
10. Confirm checkout behavior only if live Stripe variables are enabled.

## Current Verification Status

Verified:

- Home page loads successfully.
- `/consult` route loads successfully.
- Production deployment completed successfully.

Known incomplete verification:

- Sign in currently opens the local mock sign-in prompt in production, so real Supabase Auth still needs production verification/configuration.

## Known Issue

Sign in currently opens the local mock sign-in prompt in production, so real Supabase Auth still needs production verification/configuration.

This should be treated as a production readiness follow-up before user account persistence is considered verified.

## Supabase Auth URL Update Checklist

Before marking production auth complete:

1. Confirm the production Cloudflare environment uses `PERSISTENCE_PROVIDER=supabase`.
2. Confirm `SUPABASE_URL` points to the intended production Supabase project.
3. Confirm `SUPABASE_ANON_KEY` is set as a production environment variable.
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set only as a server-side production secret.
5. Confirm `PUBLIC_APP_URL` exactly matches:

```txt
https://ai-pc-build-advisor.ai-pc-build-advisor-carl.workers.dev
```

6. In Supabase Auth URL settings, set the site URL to the production origin.
7. Add the production origin to allowed redirect URLs.
8. Confirm email/password auth is enabled for the production Supabase project.
9. Redeploy or restart the Worker if Cloudflare requires it after environment changes.
10. Sign up with a production test account.
11. Sign out and sign back in.
12. Save a build, refresh, and confirm the saved build persists.
13. Confirm the saved build appears in production Supabase.
14. Remove any temporary smoke-test-only settings after verification.

## Rollback Notes

Use Cloudflare deployment history to redeploy the last known-good Worker version if the current deployment regresses.

Rollback checklist:

1. Redeploy the previous healthy Cloudflare Worker version.
2. If the issue came from an environment variable change, restore the previous value and redeploy or restart as Cloudflare requires.
3. If production Supabase connectivity is failing, temporarily set `PERSISTENCE_PROVIDER=mock` only as an emergency availability fallback. Treat this as temporary because production persistence will not be verified in mock mode.
4. If auth fails after a URL change, restore the prior Supabase Auth site URL and redirect URL settings.
5. If checkout fails, remove live Stripe variables or restore the prior Stripe price and webhook configuration.
6. After rollback, repeat the production smoke test checklist before marking the deployment healthy.

## Next Milestone Recommendation

Milestone 20 Technical Moat Foundation: Compatibility Rule Engine v1 + Build Confidence Score.

## Validation

Required local validation after documenting this milestone:

```bash
npm.cmd run build
```
