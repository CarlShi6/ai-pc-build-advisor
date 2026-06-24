# Milestone 9.1: Payment UX Polish and Production Readiness

Milestone 9.1 polishes the Build Pro upgrade experience around limits, Pro locks, checkout results, and local fallback behavior while preserving the Milestone 9 Stripe Checkout path.

## What Changed

- Updated `UpgradeCard` to present Build Pro as a `$7.99 one-time` upgrade.
- Clarified that Build Pro unlocks:
  - 50 AI questions per build
  - 25 hardware replacements per build
  - Advanced part comparison
  - Purchase checklist
  - Saved builds and full export
- Kept all Pro CTAs routed through the shared `UpgradeCard` checkout flow.
- Kept Stripe Checkout as the primary path when Stripe server env vars are configured.
- Kept mock unlock fallback for local development when Stripe env vars are missing.
- Added friendlier Free limit messaging for AI questions, hardware replacements, saved builds, and export prompts.
- Added clearer `Build Pro active` status near usage and upgrade surfaces.
- Expanded `/checkout/success` with a Build Pro unlocked confirmation and unlocked feature list.
- Expanded `/checkout/cancel` with clear no-charge cancellation copy.

## Checkout Behavior

The upgrade flow remains:

1. User selects Build Pro.
2. Frontend calls `POST /api/checkout/create-session`.
3. If Stripe is configured, the app redirects to Stripe Checkout for a one-time payment.
4. If Stripe env vars are missing locally, the app uses the mock Build Pro unlock.
5. Success returns users to `/checkout/success`.
6. Cancel returns users to `/checkout/cancel`.

No subscriptions, auth, database persistence, live retailer search, or payment storage were added.

## Local Mock Fallback

When `STRIPE_SECRET_KEY` or `STRIPE_BUILD_PRO_PRICE_ID` is missing, the app now describes the fallback as local dev checkout using the mock Build Pro unlock. This avoids making local development feel broken while keeping production users on the Stripe path when configured.

## Testing

Run:

```bash
npm.cmd run build
```

Manual checks:

- Open `/consult`.
- Confirm Free usage shows remaining AI questions and swaps.
- Exhaust or simulate a Free limit and confirm the upgrade prompt uses friendly copy.
- Click any Pro lock CTA and confirm it uses the shared Build Pro checkout flow.
- Unlock locally without Stripe env vars and confirm Build Pro active appears.
- Visit `/checkout/success` and confirm the unlocked feature list and `/consult` button.
- Visit `/checkout/cancel` and confirm the no-charge copy and `/consult` button.

## Remaining Production TODOs

- Persist entitlements in a database after real auth exists.
- Verify Stripe webhooks with raw body handling before trusting checkout completion.
- Poll entitlement state on success once production persistence exists.
- Keep Build Pro as a one-time purchase unless subscriptions are intentionally designed later.
