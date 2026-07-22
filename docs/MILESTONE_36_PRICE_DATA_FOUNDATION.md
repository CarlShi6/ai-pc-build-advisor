# Milestone 36: Price Data Foundation

## Goal

Provide a typed, retailer-aware price-observation model, deterministic local repository, summary calculations, and read-only internal API that can support later price-history features without presenting mock values as live market data.

## Scope

This milestone adds server-side price types, normalization, an in-memory repository, a small deterministic mock dataset, calculation rules, a typed API contract, a client helper, and focused tests. It does not add UI, charts, alerts, scraping, background collection, affiliate behavior, checkout integration, deployment automation, or production price claims.

## Canonical product identity

Every observation carries the exact existing `Part.id` as `partId`. Validation rejects IDs that are not in the canonical `seedParts` catalog. Price records are never joined by display name, brand, category, CPU family, or GPU chipset.

Retailer identity is additional listing metadata and never replaces the canonical part ID. Capacities, colors, memory sizes, board designs, factory-overclocked variants, and Founders Edition or partner models remain separate whenever the catalog gives them separate part IDs. Similar names or shared chipsets do not permit observations to cross those IDs.

## Price-observation schema

A normalized `PriceObservation` contains:

- Stable observation ID and canonical part ID
- Normalized retailer ID and display name
- Optional retailer SKU, seller name, and listing URL
- Explicit `USD` currency
- Integer item, shipping, and effective pre-tax amounts in minor units
- Constrained availability and condition
- Constrained source type
- ISO 8601 observation timestamp
- Optional confidence, verification timestamp, and note

The optional verification fields are metadata only. They do not convert a mock observation into verified live data.

## Currency representation

All monetary values use integer minor units. For USD, `38999` means $389.99. Milestone 36 accepts only USD but still stores the explicit `USD` currency so later multi-currency support cannot accidentally mix values. Unsupported currencies are rejected rather than converted.

## Availability rules

Supported values are `in_stock`, `out_of_stock`, `preorder`, `backorder`, and `unknown`. Only `in_stock` observations can become the current best price or contribute to range low/high comparisons. Other states remain in chronological history and contribute to the observation count so the API does not erase availability evidence.

## Retailer and seller identity

Known retailer aliases normalize to stable IDs and display names, such as `Best Buy` to `best-buy`. Other non-empty retailer names receive a conservative lowercase slug. Missing or unusable retailer identity is rejected.

Seller identity is stored separately when a marketplace seller differs from the retailer. Listing comparison keys include the retailer, seller, and retailer SKU or URL, preventing two sellers or listings at the same retailer from being treated as one listing.

## Effective-price and shipping behavior

When shipping is known, `effectivePreTaxPriceMinor` is item price plus shipping. A known free-shipping value is explicitly `0`. Missing shipping becomes `null`, and effective price also becomes `null`; the repository never assumes unknown shipping is free. An observation with unknown shipping remains in history but is not ranked against known delivered pre-tax totals.

Tax, rebates, coupons, memberships, and regional fees are outside this milestone.

## Validation and normalization

Server-side normalization rejects:

- Unknown canonical part IDs
- Negative, fractional, or unsafe-integer minor-unit prices
- Currencies other than USD
- Invalid availability, condition, source, or confidence values
- Missing retailer identity
- Invalid timestamps or observations more than five minutes in the future
- Malformed listing URLs and URL schemes other than HTTP or HTTPS

It normalizes currency casing, known retailer aliases, whitespace, HTTP(S) URL serialization, timestamps to UTC ISO 8601, missing shipping to `null`, and effective price calculation. Invalid observations are rejected; they are not repaired into plausible market data.

## Range filtering

The public API accepts only `7d`, `30d`, or `90d`. Ranges are inclusive from `asOf - range` through `asOf`, preventing unbounded history queries. The production API uses request-time `asOf`; tests inject a fixed clock.

## Deduplication rules

Storing an observation replaces an existing record when either:

1. The stable observation ID matches, or
2. The canonical part, retailer, seller, listing identity, and normalized observation timestamp all match.

Retailer SKU is the preferred listing identity, followed by listing URL. If neither exists, the observation ID keeps the record isolated. A deterministic replacement prevents replayed provider records from inflating counts while avoiding accidental merging across products or sellers.

## Current-best-price rules

The repository first selects the latest observation for each exact retailer/seller/listing key. It then considers only latest observations that are `in_stock`, in USD, and have a known effective pre-tax price. The lowest effective price wins. Ties resolve by newest observation and then stable listing identity.

Out-of-stock, preorder, backorder, unknown-availability, and unknown-shipping observations cannot win. If history exists but nothing is currently comparable, `currentBest` is `null`; that does not mean the part is free or universally unavailable.

## Price-change and range calculations

The previous comparable price is the newest earlier in-stock observation with a known effective price for the same retailer, seller, and listing that won `currentBest`. This avoids comparing a Newegg listing with a different Best Buy listing.

Absolute change is `current - previous` in minor units. Percentage change is `(absolute / previous) * 100`, rounded to two decimals. Percentage is `null` when no previous comparable observation exists or its effective price is zero.

Range low and high use all in-range, in-stock observations with known effective prices for the exact part. Observation count includes all valid, deduplicated in-range observations regardless of availability.

## Mock-data disclosure

The seed contains seven deterministic observations across three existing catalog parts. The Intel Core i7-14700K has multiple timestamps, Newegg and Best Buy listings, and an out-of-stock example. Two distinct RTX 4070 variants demonstrate canonical-ID isolation. Every seed observation uses `sourceType: "mock"`, an `example.com/mock` URL, and a fixed timestamp.

API responses include `containsMockData`, `isLive: false`, the encountered source types, and the message: “Deterministic mock price observations for development and testing; not live market data.”

## Repository abstraction

`PriceRepository` supports normalized storage, exact-part retrieval, supported-range retrieval, latest-per-listing retrieval, and current summary calculation. `InMemoryPriceRepository` is deterministic and has no external database dependency.

`PriceObservationProvider` defines the future collection boundary. A future feed or API adapter must return raw `PriceObservationInput` records, which must pass the same normalization before repository storage. No external provider is implemented in this milestone.

## API contract

Read-only endpoint:

```text
GET /api/parts/:partId/prices?range=30d
```

`range` defaults to `30d`. A successful response contains canonical part ID, USD currency, requested range, chronologically ordered normalized observations, current best listing, previous comparable price, absolute and percentage change, range low/high, observation count, last observation timestamp, and source disclosure.

The client helper is `getPartPriceHistory(partId, range)`. There is no HTTP ingestion or write endpoint.

## Error behavior

Price API errors use `{ "error": { "code", "message" } }`:

- `INVALID_RANGE` with HTTP 400
- `UNKNOWN_PART` with HTTP 404
- `NO_PRICE_DATA` with HTTP 404

No-data responses never use a zero price and do not infer stock availability.

## Tests

Vitest covers normalization, unknown shipping, negative price rejection, unsupported currency, unknown part rejection, constrained validation, exact-variant isolation, chronological ordering, supported-range filtering, duplicate replacement, best-price selection, out-of-stock exclusion, price-change calculation, low/high calculation, no-data behavior, mock disclosure, invalid public ranges, successful API retrieval, and all typed API errors.

## Security boundaries

- No secrets, credentials, tokens, or environment files are added.
- No public or unauthenticated write endpoint exists.
- Listing URLs are parsed and stored only; the application does not request them, follow redirects, or store HTML.
- No scraping, browser automation, scheduled job, affiliate integration, or arbitrary URL execution is present.
- Future providers remain behind an interface and must use the same validation boundary.

## Known limitations

Only USD and deterministic in-memory mock data are supported. Data disappears on process restart. Range filtering eventually ages fixed mock records out, which is preferable to pretending stale data is current. Tax, coupons, rebates, memberships, location-specific pricing, and cross-currency comparisons are not modeled. Unknown shipping prevents best-price ranking. No production provider, scheduler, or durable price database exists.

## Future provider integration

A future provider should implement `PriceObservationProvider`, retain exact catalog-to-listing mappings, produce raw observations without trusting retailer payloads, and store them only through `PriceRepository.storeObservation`. Production persistence can implement the same repository interface. Provider credentials must remain in a secret manager and must never enter API responses or repository files.

## Milestone 37 price-trend UI plan

Milestone 37 can consume this read endpoint to add price-history visualization and accessible trend summaries. It should preserve source disclosure, expose no-data and unknown-shipping states honestly, avoid “best time to buy” claims without a defensible model, and add no collection behavior to the browser.

## Rollback notes

Revert the Milestone 36 commit to remove the pricing types, server modules, tests, API route/client helper, and this document. No schema migration, external data, secrets, scheduled process, generated route file, or frontend state requires cleanup.
