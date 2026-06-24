# Milestone 10: Retailer Search and Product Data Layer

## What was added

Milestone 10 adds a provider-based product search layer that can search the local seed catalog today and preview mock retailer results without scraping or live retailer API calls.

Core files:

- `src/lib/product-search/types.ts`
- `src/lib/product-search/local-provider.ts`
- `src/lib/product-search/mock-retailer-provider.ts`
- `src/lib/product-search/search-service.ts`
- `POST /api/products/search`

## Product Search Architecture

The search layer is built around `ProductSearchProvider`. Providers accept a `ProductSearchQuery` and return normalized `ProductSearchResult` records.

`ProductSearchResult` includes:

- Product identity: `id`, `category`, `brand`, `model`, `displayName`
- Retail context: `retailer`, `productUrl`, optional `affiliateUrl`
- Commercial data: `price`, `priceStatus`, `stockStatus`, optional `lastUpdated`
- Source safety: `source` is `local`, `mock_retailer`, or `external_placeholder`
- Matching quality: `confidence`

The service combines provider output into:

- `localResults`
- `mockRetailerResults`
- `externalSearchAvailable: false`
- A clear pricing and stock disclaimer

## Local vs Mock Retailer Provider

The local provider searches `seedParts`. These results reflect the app's built-in mock catalog and are used for existing compare, replacement, compatibility, purchase reference, and affiliate flows.

The mock retailer provider returns static, realistic-looking product records. It does not call live retailer APIs. It is only a preview for future retailer search UI and data normalization.

Mock retailer results can be converted into a `Part`-like object by `productSearchResultToPart()`. That lets the app reuse existing rule-based compatibility checks for:

- Add to compare
- Preview swap
- Replace
- Purchase reference updates

Compatibility warnings remain visible when a mock retailer result is previewed.

## Why No Scraping Yet

This milestone intentionally does not scrape retailer websites.

Reasons:

- Retailer pages often prohibit scraping in terms of service.
- HTML scraping is brittle and can create incorrect price or stock claims.
- The app should not imply real-time availability unless data is fetched from an authorized, reliable source.
- Affiliate and retailer integrations should be built on approved APIs, feeds, or partner data contracts.

## Pricing and Stock Disclaimer

Retailer preview results use mock data. The UI and API both include safe copy:

```txt
Retailer results are mock data in this preview. Prices and stock may change. External live search coming later.
```

The app does not claim real-time price or stock for mock retailer results.

## Affiliate Tracking Behavior

Retailer result actions such as `Check price` use the existing `trackAffiliateClick()` client flow and the internal `POST /api/affiliate/click` mock endpoint.

The affiliate disclosure remains visible near purchase/search result actions:

```txt
Some links may earn us a commission at no extra cost to you.
```

Mock retailer URLs currently point to durable placeholder URLs. Future production links should use approved retailer or affiliate URLs.

## Future Live API Integration Plan

Future milestones can add live search by implementing additional `ProductSearchProvider` adapters.

Recommended path:

1. Use approved retailer APIs, affiliate product feeds, or partner catalog exports.
2. Normalize each provider into `ProductSearchResult`.
3. Store fetched prices and stock with timestamps before showing them as live data.
4. Add caching and rate limits so the app does not query retailers on every keystroke.
5. Keep rule-based compatibility checks as the source of truth.
6. Keep disclaimers visible unless the app can verify freshness and source.

Database and auth are intentionally not part of this milestone.
