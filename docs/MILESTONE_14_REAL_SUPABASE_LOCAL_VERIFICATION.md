# Milestone 14: Real Supabase Local Verification

## Goal

Verify that the production Supabase wiring works against a real Supabase project in local development.

## Result

Local Supabase smoke test passed.

Endpoint tested:

GET /api/smoke/supabase

Safe response summary:

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

## Validation

- .env.local was used for real local secrets.
- .env.local was not committed.
- PERSISTENCE_PROVIDER=supabase was used.
- SUPABASE_SMOKE_TEST_ENABLED=true was used for local testing.
- Supabase schema was applied through SQL Editor.
- The smoke test verified env presence and a safe database query.

## Notes

Do not commit real Supabase keys, service role keys, Stripe keys, or OpenAI keys.
