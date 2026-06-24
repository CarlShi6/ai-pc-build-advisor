# Milestone 9: Stripe Checkout for Build Pro

Milestone 9 adds a Stripe-ready one-time checkout path for Build Pro while keeping the local mock unlock available when Stripe is not configured.

## Stripe Environment Setup

Add these server-only variables in local or deployment secrets:

```txt
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BUILD_PRO_PRICE_ID=price_...
PUBLIC_APP_URL=http://localhost:5173
```

Do not prefix Stripe secrets with `VITE_`. The frontend never reads secret keys.

`.env.example` contains placeholders only. `.env.local` and other real env files remain ignored.

## Local Mock Fallback Behavior

When `STRIPE_SECRET_KEY` or `STRIPE_BUILD_PRO_PRICE_ID` is missing, `POST /api/checkout/create-session` returns:

- `fallbackUsed: true`
- no Stripe checkout URL
- a message explaining that local mock unlock is being used

`UpgradeCard` then calls the existing mock upgrade endpoint and unlocks Build Pro for the current mock session.

## Checkout Flow

1. User clicks **Unlock Pro**.
2. Frontend calls `createCheckoutSession({ plan: "build_pro" })`.
3. Backend checks server-only Stripe config.
4. If configured, backend creates a Stripe Checkout Session for the Build Pro one-time price.
5. Frontend redirects to the returned `checkoutUrl`.
6. If Stripe is not configured or session creation fails, the UI falls back to mock checkout.

No subscription flow is added. Build Pro remains a one-time unlock.

## Success and Cancel Behavior

Added routes:

- `/checkout/success`
- `/checkout/cancel`

Success shows a Build Pro confirmation. For local fallback without a Stripe session id, it activates the mock entitlement immediately.

Cancel shows that payment was cancelled and links back to the advisor.

With real Stripe, production entitlement activation should come from the verified webhook, not the success page alone.

## Webhook Placeholder

Added:

```txt
POST /api/stripe/webhook
```

For now it accepts parsed JSON and can activate the mock Build Pro entitlement when it receives a `checkout.session.completed` event with `metadata.plan = build_pro`.

Production TODO: verify the raw request body with `STRIPE_WEBHOOK_SECRET` before trusting events.

## Security Notes

- Stripe secret keys are read only through server-only config.
- No real keys are committed.
- No card data is stored by the app.
- The frontend receives only a checkout URL and fallback metadata.
- Compatibility, pricing, replacement limits, owned parts, saved builds, export, and purchase references remain rule-based.

## Future Production TODOs

- Install and use Stripe's official SDK if the deployment target supports raw body webhook verification cleanly.
- Persist Stripe customer id, checkout session id, and entitlement records in a real database.
- Verify webhooks with `STRIPE_WEBHOOK_SECRET`.
- Make success page poll entitlement status after checkout.
- Add idempotency for webhook processing.
- Add account/user ownership checks before activating entitlement.
- Add refund/revoke handling if needed.
- Keep Build Pro as one-time purchase until subscriptions are intentionally designed.
