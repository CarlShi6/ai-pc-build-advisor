# Milestone 6: B2C Monetization MVP

## What Milestone 6 Adds

Milestone 6 adds the first consumer monetization layer for AI PC Build Advisor:

- A Free plan and a mock Build Pro one-time unlock.
- Product-level AI question limits instead of exposed token counts.
- Mock entitlement, usage, checkout, and affiliate click API endpoints.
- Reusable monetization UI: UpgradeCard, ProFeatureLock, UsageBadge, and AffiliateDisclosure.
- Free vs Pro behavior in the part compare drawer.
- Affiliate purchase links on mock parts and purchase references.
- A Pro-only purchase checklist for final buyer confidence.

No real Stripe, payment storage, external AI API, retailer scraping, or external service is required.

## Free vs Build Pro

| Feature | Free | Build Pro |
| --- | --- | --- |
| Basic build recommendation | Included | Included |
| AI-style questions | 5 per day | 50 per build |
| Basic compare fields | Included | Included |
| Advanced part comparisons | Locked | Included |
| AI recommendation reasoning | Locked | Included |
| Value analysis | Locked | Included |
| Performance fit explanation | Locked | Included |
| Compatibility impact | Locked | Included |
| Upgrade/downgrade explanation | Locked | Included |
| Final recommendation | Locked | Included |
| Purchase checklist | Locked preview | Full checklist |
| Build export/save-ready flow | Locked | Included later |
| Affiliate purchase links | Included | Included |

## Mock Checkout Flow

The MVP uses `POST /api/checkout/mock-upgrade`.

1. A Free user clicks **Unlock Pro**.
2. The frontend calls `mockUpgradeToPro()`.
3. The mock API marks the temporary mock user entitlement as `build_pro`.
4. The frontend refreshes entitlement and usage state.
5. Pro-only sections unlock without a real payment provider.

This flow is intentionally shaped like a future checkout handoff, but it does not collect payment information.

## Future Stripe Integration Notes

Future Stripe work should replace only the mock checkout activation path:

- Create a Stripe Checkout one-time payment for Build Pro.
- Store no card or payment information in the app.
- Activate entitlement from a verified Stripe webhook after successful payment.
- Keep the existing `Entitlement`, `CheckoutResult`, and feature-access helpers.
- Keep usage enforcement separate from Stripe so plan rules remain testable.

No Stripe keys or external payment requirements are part of Milestone 6.

## Affiliate Disclosure Note

Affiliate purchase buttons use mock merchant URLs and call the internal affiliate click endpoint before opening the link. The required disclosure appears near purchase links:

> Some links may earn us a commission at no extra cost to you.

The app still treats prices and stock as mock data and does not claim live retailer availability.

## Token/AI Usage Control Strategy

The app controls AI-like behavior at the product level:

- Free users get 5 AI questions per day.
- Build Pro users get 50 AI questions per build.
- The UI shows friendly remaining question counts, not raw tokens.
- Usage is consumed when the user asks for an AI-style recommendation refresh.
- If usage is exhausted, the app shows a soft upgrade prompt and keeps the current mock build stable.
- Compatibility checks remain deterministic and rule-based.

## Local Testing Instructions

1. Install dependencies if needed: `npm.cmd install`
2. Run the build check: `npm.cmd run build`
3. Start local preview: `npm.cmd run dev`
4. Open the app and visit `/consult`.
5. Send advisor prompts until the Free usage badge reaches zero.
6. Confirm the UpgradeCard appears and the app does not crash.
7. Click **Unlock Pro** and confirm Pro sections unlock.
8. Open a component compare drawer and verify advanced fields are locked for Free and visible for Pro.
9. Open purchase references and click a purchase button to verify the affiliate flow opens a retailer URL.

## Remaining TODOs

- Replace mock checkout with Stripe Checkout and verified webhooks.
- Add real authentication and persistent entitlement storage.
- Add a real AI adapter behind the existing usage controls.
- Add persistent usage tracking by user/build.
- Add real retailer price and stock data only after a reliable data provider is chosen.
- Implement a full build export/save-ready flow for Build Pro.
