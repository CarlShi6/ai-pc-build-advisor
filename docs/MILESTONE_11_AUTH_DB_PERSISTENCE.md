# Milestone 11: Auth and Database Persistence

Milestone 11 prepares AI PC Build Advisor for production persistence while keeping the local demo fully usable without external services.

## Auth Approach

The app now has auth-ready types and API endpoints:

- `GET /api/auth/session`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-out`

Supabase Auth is the preferred production path. For local development, the app uses a mock auth fallback that creates an in-memory session from an email address and stores the session id in an HTTP-only style app cookie. Guest mode remains available when no session cookie exists.

The frontend shows lightweight account status in the top bar:

- Guest mode or Signed in
- Sign in
- Sign out
- Free or Build Pro active

No real passwords, OAuth providers, or Supabase secrets are required for local development.

## Database Schema

The persistence layer defines database-ready record models for:

- `users`
- `saved_builds`
- `entitlements`
- `usage_counters`
- `replacement_counters`
- `owned_parts`
- `affiliate_clicks`
- `checkout_sessions`

These are TypeScript models in `src/lib/persistence/types.ts`. They are shaped for Supabase Postgres rows and include `userId` and/or `sessionId` ownership fields, timestamps, and provider metadata where relevant.

## Persistence Abstraction

Added:

- `src/lib/persistence/types.ts`
- `src/lib/persistence/mock-store.ts`
- `src/lib/persistence/server-store.ts`
- `src/lib/persistence/index.ts`

The internal API now calls `PersistenceStore` methods instead of directly mutating router-level mock state. The interface is async so it can be backed by Supabase later without changing frontend API contracts.

`server-store.ts` checks for Supabase configuration and currently falls back to the mock store. The Supabase implementation is intentionally left as a production TODO so no new external service is required during this milestone.

## Mock Fallback Behavior

Without Supabase credentials, the app uses the mock persistence store:

- Guests use a stable local mock guest session.
- Mock sign in/sign up create an in-memory user and session.
- Saved builds, entitlements, usage counters, replacement counters, and affiliate clicks are scoped to the current user id or session id.
- Reset demo state resets only the current actor's local state.
- Local mock data still resets when the dev server process restarts.

## Scoping Rules

Saved builds are scoped by the current authenticated `userId` when signed in, otherwise by guest `sessionId`.

- Free: 1 saved build
- Build Pro: 10 saved builds

Entitlements are scoped by `userId` or `sessionId` and keep:

- `paymentProvider`
- `checkoutSessionId`
- `activatedAt`

AI usage and replacement usage are scoped by `userId` or `sessionId`.

Affiliate clicks are stored through the persistence layer with:

- `userId` or `sessionId`
- optional `buildId`
- `partId`
- `merchant`
- `url`
- `clickedAt`

Compatibility, pricing, replacement, owned parts, and purchase references remain rule-based. AI suggestions still cannot directly replace parts.

## Environment Variables

`.env.example` now includes Supabase placeholders:

```txt
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

Do not commit `.env.local` or real secrets.

## Production TODOs

- Install and wire the official Supabase client on the server side.
- Implement `server-store.ts` with Supabase Auth session verification.
- Create Postgres tables matching the record models.
- Add row-level security policies keyed by authenticated user id.
- Migrate mock checkout/webhook entitlement activation into database writes.
- Add idempotency for Stripe checkout session completion.
- Persist owned/custom parts as first-class records.
- Add observability for auth state, checkout activation, affiliate tracking, and fallback usage.
- Add integration tests for guest mode, sign in, saved build limits, Pro activation, and reset behavior.
