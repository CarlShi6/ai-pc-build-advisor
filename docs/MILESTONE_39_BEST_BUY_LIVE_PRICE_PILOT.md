# Milestone 39: Best Buy Live Price Provider Pilot

## Goal

Add a server-only, read-only current-offer provider for a small, explicitly mapped set of canonical parts. This pilot does not change the deterministic price-history API or frontend.

## Why Best Buy

Best Buy provides an official Products API, stable retailer SKUs, product URLs, current sale price, and online-availability fields. That makes it suitable for an exact-identity pilot without scraping retailer pages.

## Exact SKU mapping

`best-buy-mappings.ts` is the auditable canonical `Part.id` to Best Buy SKU boundary. Production mappings are intentionally empty because no real SKU was verified during implementation. No guessed SKU is shipped. Tests inject obvious fixture SKUs. Normal requests never search by title, brand, chipset, partial name, or user-provided query syntax. Unmapped parts return `UNMAPPED_PART`; similar variants cannot share data unless each receives an explicit mapping.

## Environment configuration

Set `BEST_BUY_API_KEY` only in the server environment. `PRICE_PROVIDER=bestbuy` is optional; another value disables this adapter. Do not use a `VITE_` prefix.

For local development, provide the variables through the developer's uncommitted local environment. No `.env` file is created or changed by this milestone. For Cloudflare, add the credential with `wrangler secret put BEST_BUY_API_KEY`; set `PRICE_PROVIDER` through the deployment environment if explicit provider selection is desired.

## Provider architecture

`RetailPriceProvider` returns `RetailProviderResult` containing a normalized `CurrentRetailOffer` or a typed disabled, unavailable, or error reason. The Best Buy adapter is server-only, queries the official Products endpoint by exact SKU, requests only needed fields, validates identity, price, currency, URL, and payload shape, and exposes no raw upstream payload.

Shipping remains `null` because the Products response used by this pilot does not explicitly establish shipping cost. Consequently, effective price also remains `null`; unknown shipping is never treated as free.

## Current-offer contract

`GET /api/parts/:partId/current-offer` returns canonical part ID, provider status, normalized offer or `null`, disclosure, fetch and expiration timestamps, attribution, cache status, and a typed reason. Successful offers preserve Best Buy SKU, USD integer minor-unit price, conservative availability, condition, exact HTTPS Best Buy product URL, provider product name, live status, and freshness metadata.

The endpoint is read-only. It returns neither credentials nor the complete Best Buy response.

## Timeout and error behavior

The adapter has a five-second default timeout. Typed reasons cover disabled configuration, unknown or unmapped parts, product not found, timeout, 401/403, rate limiting, upstream failures, malformed JSON/payload, unsupported currency, and missing price. Unknown availability remains `unknown` rather than being inferred.

## Cache and retention

Successful current offers use an exact `best_buy:{canonical part ID}:{SKU}` in-memory cache for 20 minutes. Simultaneous identical requests share one promise. Configured TTL is clamped strictly below 72 hours. Serverless instances may discard cache entries earlier.

No Best Buy response is written to disk, Supabase, the historical repository, or another durable store.

## Historical API separation

`GET /api/parts/:partId/prices?range=...` keeps its existing deterministic sample-history meaning. Live Best Buy offers are not appended to mock observations, connected to sample chart points, or used to manufacture historical trends. A licensed, legally retainable history source requires separate future work.

## Attribution and trust

Responses retain “Price data provided by Best Buy,” exact product URL, live status, fetched timestamp, and expiration timestamp for future UI use. The contract does not claim cheapest internet price, best market price, complete retailer coverage, guaranteed availability, or live historical tracking.

## Rate-limit awareness

The short cache and concurrent-request deduplication reduce duplicate upstream traffic. HTTP 429 maps to `RATE_LIMITED`; callers can distinguish it from authentication and upstream service failures. This milestone adds no automated retry storm, scheduler, or collector.

## Local setup and manual smoke test

After adding a manually verified production mapping, set `BEST_BUY_API_KEY` and optionally `PRICE_PROVIDER=bestbuy`, start the server, and request `/api/parts/{mapped-part-id}/current-offer`. Inspect only normalized output and confirm the API key is absent. Without a key or verified mapping, the endpoint exits cleanly through `PROVIDER_DISABLED` or `UNMAPPED_PART`; no upstream request occurs.

No automated real-provider smoke test runs in CI, and no credential was available for this implementation pass.

## Tests

Vitest mocks all external fetches and covers missing key, unmapped parts, exact SKU isolation, successful normalization, dollar conversion, availability, unknown shipping, unsupported currency, missing price, product-not-found, 401/403, rate limit, 5xx, timeout, invalid JSON/payload, cache reuse, concurrency deduplication, expiration, the 72-hour maximum, API unavailable/unknown responses, secret non-disclosure, and unchanged historical observations.

## Security boundaries

- Credentials are read only by server code and never logged or returned.
- User input cannot become Best Buy query syntax or an upstream URL.
- Only exact mapped SKUs are requested.
- Only expected HTTPS Best Buy product URLs are accepted.
- There is no write endpoint, scraping, browser automation, database, scheduled task, or persistent provider cache.

## Known limitations

Production mappings are empty pending manual SKU verification. The pilot supports Best Buy and USD only, reads one product, has no shipping total, performs no broad catalog discovery, and uses instance-local memory. Current availability is provider-reported and not guaranteed.

## Future frontend integration

A later milestone may present a clearly labeled current-offer card using attribution, freshness, exact URL, and provider status. It must remain visually and semantically separate from historical sample trends.

## Future licensed history-provider work

Historical live pricing requires a source whose license permits the intended retention, plus independent ingestion, provenance, freshness, and data-quality design. Best Buy pilot responses must not be repurposed for that role.

## Rollback notes

Revert the Milestone 39 commit to remove current-offer types, mapping, provider, service, API/client contract, tests, and this document. No persisted provider data, schema, route-tree change, environment file, scheduled job, or frontend migration requires cleanup.
