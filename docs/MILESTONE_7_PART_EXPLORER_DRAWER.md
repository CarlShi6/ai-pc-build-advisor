# Milestone 7: Part Explorer Drawer

## What Milestone 7 Adds

Milestone 7 upgrades the old table-first Compare Drawer into a cleaner B2C Part Explorer Drawer.

The drawer now supports:

- Recommended, Search, and Compare tabs.
- Clean part cards with fallback category visuals.
- Local mock catalog search by brand, model, display name, specs, and compatibility tags.
- A sticky compare tray for 2 to 4 selected parts.
- A Compare tab that only shows the side-by-side table after the user selects enough parts.
- A Preview Swap panel before replacement.
- Affiliate purchase buttons with click tracking.
- Free vs Build Pro locks from Milestone 6.
- A mock monetization reset endpoint and local-testing button.

## UX Changes

The Part Explorer is intentionally less table-heavy:

- Recommended tab: default view with buyer-friendly cards.
- Search tab: filters same-category local seed parts.
- Compare tab: focused side-by-side view for selected parts only.
- Preview Swap: shows price delta, new build total, compatibility status, warnings, and Pro-only upgrade/downgrade reasoning.

The replacement flow still calls the existing replace handler, so total price, compatibility warnings, recommendation summary, and purchase references continue updating from the existing mock API.

## Monetization Preservation

Milestone 6 monetization remains active:

- Free users keep basic compare fields.
- Build Pro unlocks advanced compare, AI reasoning, value analysis, performance fit, compatibility impact, final recommendation, and richer swap explanations.
- Upgrade prompts still use mock checkout.
- AI usage limits remain unchanged.
- Affiliate disclosure remains near purchase links.

## Mock Monetization Reset

Added:

```txt
POST /api/monetization/reset
```

This resets the temporary mock user to:

- Free plan
- 0 AI questions used today
- 0 AI questions used for build
- Empty affiliate click log

The consult page includes a **Reset mock access** button beside the usage badge for local testing.

## Local Testing Instructions

1. Run `npm.cmd run dev`.
2. Open `/consult`.
3. Click any part row in the build card.
4. Confirm the Part Explorer Drawer opens.
5. Use Recommended cards to select parts for comparison.
6. Use Search to filter by strings like `NVIDIA`, `AM5`, `850`, `DDR5`, or `black`.
7. Open Compare after selecting at least 2 parts.
8. Preview a swap and confirm replacement.
9. Verify build total, compatibility warnings, and purchase references update.
10. Click affiliate purchase buttons and confirm links open.
11. Use **Reset mock access** to return to Free plan and reset usage.

## Remaining TODOs

- Add real part images or a curated local image asset set.
- Persist compare selections per build if desired.
- Add keyboard shortcuts for power users.
- Replace mock reset with admin/dev-only controls after real auth exists.
- Keep real Stripe, real AI, and live retailer search for future milestones.
