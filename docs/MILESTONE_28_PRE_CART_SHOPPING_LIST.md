# Milestone 28: Pre-cart / Shopping List Output

## Goal

Add a lightweight pre-cart experience for the currently recommended PC build. The feature gives users a clear shopping list they can review and copy before the product has real retailer checkout, payment, or inventory integration.

## User Value

- Makes the selected build easier to understand as a purchase-ready parts list.
- Shows the expected CPU, GPU, motherboard, RAM, SSD/storage, PSU, case, and cooler in one place.
- Summarizes estimated subtotal, budget impact, estimated wattage, and compatibility status.
- Gives users copy-friendly text they can paste into notes, messages, or a retailer search workflow.

## UI Behavior

- The current build card includes a `Review Parts List` entry point in the existing action area.
- Opening it expands an inline shopping list section below the build insight card.
- The section includes:
  - Summary tiles for estimated subtotal, budget target, budget impact, and estimated wattage.
  - Per-part rows with category, part name, estimated price, key specs, and compatibility or replacement notes.
  - A compatibility notes area.
  - A suggested next action based on compatibility and budget status.
  - A read-only copy-friendly text area.
  - A `Copy` button when the browser clipboard API is available.

## Data Used

The shopping list is generated from the existing selected build data:

- `Build.parts` for selected part categories, names, specs, prices, and owned-part handling.
- `Build.totalPrice` and `Build.budget` for subtotal and budget impact.
- `Build.compatibilityChecks`, `Build.compatibilityWarnings`, and `Build.confidenceScore` for notes and status.
- Existing summary helpers for key part specs.
- Existing substitution suggestions, when available, for optional replacement notes.

No separate hardcoded build is introduced for the pre-cart output.

## Known Limitations

- Prices are still estimates from the app's current catalog/mock data.
- Estimated wattage only includes parts with available draw/TDP specs and is not a full PSU sizing calculator.
- The copy output is plain text and does not preserve table formatting.
- The feature does not verify live availability, shipping, taxes, bundles, rebates, or retailer-specific compatibility claims.
- Legacy/sample card data has reduced notes compared with live recommended build data.

## Future Retailer / Cart Integration Direction

This milestone intentionally stops before checkout. A future integration can build on the same pre-cart surface by adding:

- Retailer-specific product offers per part.
- Live price and stock refresh.
- Affiliate or partner purchase references.
- Replacement suggestions based on availability.
- Export to retailer carts where supported.
- Saved shopping lists tied to saved builds.
- Clear price freshness timestamps and retailer disclaimers.
