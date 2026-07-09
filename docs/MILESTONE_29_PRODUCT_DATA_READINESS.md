# Milestone 29: Product Data Quality And Purchase Link Readiness

## Goal

Prepare the local product catalog and product display surfaces for future retailer links, inventory, and real product data integration without adding live APIs, checkout, scraping, Supabase schema changes, or authentication changes.

## Product Metadata Added

The `Part` shape now supports optional shopping-readiness fields:

- `purchaseUrl`
- `stockStatus`
- `lastUpdated`
- `partNumber`
- `sku`
- `specSummary`
- `valueRating`

Existing fields such as `brand`, `model`, `retailer`, `productUrl`, `searchUrl`, `imageUrl`, `availability`, and `valueScore` remain supported. Seed catalog entries now generate a safe retailer search URL, stock-status alias, generated spec summary, and catalog freshness date from existing local data.

## Current UI Usage

The build card can show brand/model, retailer, stock status, a `View product` link, and concise specs when those fields are available.

The pre-cart shopping list now shows retailer, stock status, and product links in the table. Its copy-friendly output includes only plain useful lines: retailer, stock, link, specs, price, and compatibility notes.

The compare drawer uses the metadata in candidate cards and the explainable comparison table. Price and compatibility remain the main focus, with product metadata shown as supporting context.

## Known Limitations

- Stock and prices are still local demo/catalog values, not live inventory.
- Seed `purchaseUrl` values are safe retailer search links, not verified product-detail pages.
- No checkout, cart handoff, payment flow, or retailer API integration exists in this milestone.
- `partNumber` and `sku` are optional and should remain empty unless a verified manufacturer part number or retailer SKU is available.
- `lastUpdated` reflects the local seed-data freshness marker, not a retailer sync timestamp.

## Future Retailer Integration Direction

Future work can map live retailer or partner data into the optional product fields without changing the main build, compare, and shopping-list workflows. A provider should populate verified retailer labels, exact product URLs, image URLs, SKUs, stock status, last-updated timestamps, and price metadata. The app should continue to treat local catalog parts as compatibility candidates even when live retailer data is unavailable.

## Data Quality Rules

- Do not invent checkout behavior, live inventory, exact SKUs, or manufacturer part numbers.
- Prefer empty optional fields over fake or misleading data.
- Use search URLs only as safe placeholders when exact product URLs are unavailable.
- Label purchase links as product/reference links, not checkout links.
- Keep demo stock and prices clearly separate from future live retailer data.
- Only set `stockStatus`, `lastUpdated`, `sku`, `partNumber`, or `imageUrl` when the source is known.
