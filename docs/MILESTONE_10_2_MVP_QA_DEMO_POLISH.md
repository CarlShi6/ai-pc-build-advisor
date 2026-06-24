# Milestone 10.2: MVP QA and Demo Polish

## What Was Audited

- Full `/consult` advisor flow, including message usage, structured action chips, Build Needs cards, Part Explorer opening, and owned-part entry.
- Free and Build Pro state, including usage badges, upgrade prompts, local Stripe fallback, mock entitlement, replacement limits, saved-build limits, and reset behavior.
- Part Explorer Recommended, Search, Compare, preview swap, replacement, local catalog search, mock retailer preview results, and affiliate click flows.
- Owned/custom part handling across build totals, compatibility checks, purchase references, saved builds, and export text.
- Compatibility warning display for pass and warning states.
- Purchase reference updates after local, owned-part, and mock retailer replacements.
- Saved builds, load, rename, delete, Free/Pro save limits, and export preview/full export behavior.
- Checkout success and cancel pages for Build Pro activation and no-charge cancellation copy.

## Bugs Fixed

- Reset demo state now clears saved builds in addition to AI usage, replacement usage, Pro entitlement, and affiliate click state.
- Confirmed replacements now consume replacement usage only after the replacement path succeeds, while browsing, comparing, previewing, and failed applies do not spend replacement usage.
- Owned parts now display clearly in the main build card and purchase reference price column.
- Owned purchase references use `Already owned - no purchase needed.` and remain excluded from purchase links.
- Compare selected now appears only after 2 or more parts are selected.
- Retailer preview and swap preview warning lists no longer truncate compatibility warnings.
- Purchase and preview price checks reserve a new tab first, run affiliate tracking, then navigate the tab to the target link.
- Several main-flow copy labels were softened from developer/mock wording to demo/buyer-friendly wording while preserving required retailer and checkout disclaimers.
- Build Pro usage badge copy now reads consistently as active state plus remaining AI/replacement usage.

## Demo Test Checklist

1. Open `/consult` and confirm the live build, Build Needs cards, usage badge, compatibility state, purchase references, export preview, and chat panel render.
2. Send advisor messages for budget, use case, appearance, brand preference, and experience level. Confirm AI usage decreases only when sending messages.
3. Click advisor action chips and confirm Build Needs update without consuming another AI question.
4. Use `open_part_explorer` chips or component rows to open the correct Part Explorer category.
5. Use `add_owned_part` chips or Search tab to open the owned/custom part flow.
6. Search local parts, enable retailer results, add local and retailer preview results to compare, and confirm Compare appears only after 2+ selections.
7. Preview local, owned, and retailer preview replacements. Confirm compatibility warnings remain visible.
8. Confirm a replacement updates total price, compatibility, purchase references, and replacement usage.
9. Click Check price from purchase references and retailer preview cards. Confirm a new tab opens and `/consult` remains open.
10. Add an owned part and confirm it shows `Already owned`, counts as `$0`, remains in compatibility checks, and appears in purchase references as no purchase needed.
11. Save one build as Free, then confirm a second new save shows friendly upgrade copy.
12. Unlock Build Pro through the checkout CTA. With missing Stripe env vars, confirm local fallback unlocks Pro without refresh.
13. Save up to the Build Pro limit, load a saved build, rename it, and delete it.
14. Confirm Free users can preview export and Build Pro users can copy/download full export.
15. Visit `/checkout/success` and confirm Build Pro unlock copy. Visit `/checkout/cancel` and confirm no-charge copy.
16. Use Reset demo state and confirm Free state, AI usage, replacement usage, Pro access, and saved builds return to the starting point.

## Known Limitations

- Retailer results are static mock/demo data. Prices and stock are not live.
- Checkout uses Stripe only when server-side Stripe env vars are configured; otherwise it intentionally falls back to local mock unlock.
- Saved builds, usage, entitlement, and affiliate clicks are held in temporary mock server state.
- Owned/custom part specs are estimated from the current category baseline unless the user enters richer notes.
- The AI adapter can suggest safe actions, but compatibility, pricing, replacements, owned parts, purchase references, and limits remain rule-based.

## Future Production TODOs

- Add authentication and database persistence for entitlements, usage, saved builds, owned parts, and affiliate events.
- Verify Stripe webhooks with raw body handling and persist checkout session/customer records.
- Add approved retailer APIs, affiliate feeds, or partner catalog data with timestamps and caching before claiming live price or stock.
- Add richer custom owned-part spec entry and validation by category.
- Add end-to-end browser tests for the full `/consult` demo flow.
- Add production analytics for AI action acceptance, replacement confirmations, checkout fallback rate, and affiliate click success.
