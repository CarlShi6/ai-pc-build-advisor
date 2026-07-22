# Milestone 37: Price Trend UI

## Goal

Expose the Milestone 36 price-history contract in an accessible, compact, and trustworthy product experience. The UI helps a user understand observed sample prices for one exact catalog part without presenting deterministic development data as live retailer pricing.

## Placement decision

The price-history section lives inside the existing part comparison drawer, immediately after the current-selection summary. This keeps pricing near the replacement decision, preserves the consultation chat, uses the drawer's independent scrolling, and avoids a disconnected demo page or new top-level route.

The focused part is `previewPart ?? selectedPart`. Opening a replacement preview therefore switches price history to the preview's exact canonical `Part.id`; closing the preview returns focus to the currently selected build part. Only this one focused item is fetched, not every alternative in the catalog.

## Component architecture

- `PriceTrendPanel` owns the selected range and asynchronous request lifecycle.
- `PriceTrendView` renders deterministic loading, error, success, empty, and no-comparable presentations.
- Focused summary, disclosure, responsive SVG, legend, text summary, and collapsible observation table are small presentation functions in the same component module.
- `price-trend.ts` contains only browser presentation helpers, chart scaling, typed error presentation, request-key isolation, a latest-request guard, and a deduplicating request loader.
- Milestone 36 remains the source of business calculations for current best, price change, and range low/high.

No generic chart framework or new chart dependency was added.

## API integration

The panel calls the existing `getPartPriceHistory(partId, range)` helper. Requests always use the focused exact canonical part ID and one of the existing typed ranges: `7d`, `30d`, or `90d`.

The shared API client's existing `ApiClientError` now preserves the structured price API error code and nested error message. This allows `UNKNOWN_PART` and `NO_PRICE_DATA` to receive truthful, user-facing states without exposing internal stack traces. Existing top-level API error payloads continue to work.

The browser does not fetch or navigate to retailer listing URLs. URLs remain API metadata and are intentionally omitted from the price-history UI.

## Request lifecycle

The default range is `30d`. Part, range, or explicit retry changes start a request identified by the exact `partId:range` key. A monotonically increasing request token ensures that only the latest request may update state; late responses from a previous part or range are ignored.

The request loader caches promises and successful results by exact part-and-range key. Simultaneous duplicate requests reuse one promise. A failed request removes itself from the cache. Retry explicitly refreshes the current key, so a transient failure cannot become sticky.

During a part or range transition, state associated with a different key is never rendered for the new focus. The panel shows its compact loading state while the correct request is in flight.

## Range behavior

The range control is a semantic button group containing `7D`, `30D`, and `90D`. Each button has a descriptive accessible label, `aria-pressed`, a visible selected state, and a visible keyboard focus ring. The group becomes a full-width three-column control at narrow sizes and does not navigate or blank the drawer.

Changing range retains the exact focused part ID and fetches only that new combination. Cached completed combinations may be reused when revisited.

## Summary fields

The summary displays:

- Best comparable sample price
- Associated retailer, or a neutral no-ranked-retailer value
- Absolute and percentage direction, or “No previous comparable price”
- Comparable range low and high
- Last observation timestamp in an explicit UTC presentation
- Observation count

All USD values are formatted from integer minor units. Missing values display as unavailable or not comparable and are never replaced with zero. A genuine zero change is labeled “Unchanged,” which remains distinct from missing previous data.

## Chart behavior

The visualization is a responsive inline SVG with a stable `viewBox` and no fixed drawer width. Comparable in-stock observations with known effective pre-tax totals are connected chronologically. Sparse samples include an explicit explanation that the line does not mean continuous tracking.

A single point is centered safely. Equal-price histories use the vertical midpoint and cannot divide by zero. In-stock observations with unknown shipping use a hollow marker. Out-of-stock and otherwise unavailable observations use an × marker. The visible legend and detail table communicate those distinctions without relying on color.

The SVG has an accessible title and description. The same trend summary is also rendered as text, so the graphical line is never the only source of meaning. No animation delays or obscures values.

## Comparable-price rules inherited from Milestone 36

The UI does not recalculate current-best business meaning. It displays the server's `currentBest`, previous comparison, change, and low/high values. Chart filtering mirrors presentation eligibility only: an observation can be plotted as comparable when it is in stock and the server supplied a known effective pre-tax price.

Unknown shipping is not treated as free. Out-of-stock, preorder, backorder, unknown-availability, and unknown-effective-price observations cannot be shown as comparable totals. When observations exist but none can be ranked, the UI explains why instead of implying a free price or universal stock state.

## Mock-data disclosure

Every successful response displays the prominent message:

> Development sample data — not live retailer pricing.

The API-provided disclosure appears directly below it. Mock responses label the leading value “Best comparable sample price.” The UI does not use “today's best,” “current market price,” automated-collection language, or any live-price claim.

## Loading, error, and no-data states

- Loading uses a compact skeleton inside a stable minimum-height panel and announces “Loading price history.” Existing part and compare controls remain available.
- Generic failures show a friendly alert and keyboard-accessible retry button.
- `UNKNOWN_PART` explains that the exact catalog item has no price history.
- `NO_PRICE_DATA` explains that no observations exist in the selected range.
- A successful empty response has its own neutral no-observations presentation.
- A successful response with observations but no `currentBest` explains unknown shipping and unavailable-listing exclusions.
- Older requests cannot replace state for a newer focus.

## Exact-product isolation

All cache keys, request tokens, and API paths include the canonical `Part.id`; display names are never used as price identity. Similar RTX 4070 variants therefore have separate requests and cache entries. Previewing, closing, and confirming replacement actions retain the comparison drawer's existing behavior while moving price focus to the appropriate exact part.

Custom or retailer-preview parts that are not members of the canonical price catalog receive the typed unavailable state rather than borrowing a similar catalog item's history.

## Observation details

A collapsed-by-default details section provides a newest-first table with meaningful column headers and caption. It contains observation date, retailer, item price, shipping amount/status, effective comparable total, availability, and condition.

Long retailer values wrap. The table scrolls within its own narrow-width container. Raw internal IDs and mock listing URLs are not displayed, and the UI adds no purchase action.

## Accessibility

- Semantic section and heading association
- Keyboard-operable range and retry buttons
- Visible `focus-visible` rings
- `aria-pressed` range state
- Polite loading status and assertive error alert
- Named SVG with a text equivalent
- Text and symbols in addition to color for direction and availability
- Semantic table caption, headers, and newest-first detail ordering
- Exact focused item name remains visible during all states

## Responsive behavior

The panel uses `min-w-0`, wrapping text, responsive grids, and a width-independent SVG. Range buttons occupy the available row on mobile. Summary metrics move from two to three and then six columns as space permits. Large prices use wrapping-safe containers, long names break within the drawer, and the details table receives local horizontal scrolling instead of widening the page.

The compare drawer remains independently vertically scrollable. The chat panel, sticky drawer header, replacement preview, comparison tray, and replacement actions are unchanged and remain accessible.

## Tests

The Milestone 37 Vitest suite covers:

- Minor-unit USD formatting, including large values and missing values
- Positive, negative, unchanged, and neutral price changes
- Supported range options and separate range request keys
- Loading and successful summary rendering
- Visible mock/non-live disclosure
- Empty observations and no-comparable presentation
- Typed unknown-part and no-data API errors
- Retry after a failed request and duplicate-request reuse
- Exact canonical-part switching and stale-response protection
- One-point and equal-price chart scaling
- Unknown-shipping and out-of-stock presentation
- Accessible range labels, loading/error semantics, and chart text summary

These tests use the repository's existing Vitest and React server-rendering capabilities; no browser-testing dependency was added.

## Manual QA

The validation checklist covers wide and narrow consultation layouts, an open comparison drawer, and mobile widths. It exercises CPU history with multiple observations, RTX 4070 Super one-point history, RTX 4070 Ti Super unknown shipping, RTX 4090 no data, range switching across 7D/30D/90D, loading, retry, exact replacement preview switching, long retailer text, large price formatting, independent drawer scrolling, and continued access to chat and replacement actions.

Browser console errors, document-level horizontal overflow, focus visibility, text wrapping, disclosure visibility, and stale content during rapid focus changes are checked during the manual pass.

## Security and trust boundaries

- No scraping, external URL request, browser automation, or public ingestion was added.
- No background collection, scheduling, alerts, or prediction logic was added.
- No checkout, affiliate redirect, or prominent listing-link behavior was added.
- No retailer credentials, secrets, environment variables, or `.env` files were added or modified.
- No “best time to buy,” investment-style recommendation, or live-price claim is made.
- The browser consumes only the existing read-only same-origin pricing endpoint.

## Known limitations

The display is backed by sparse deterministic sample observations. It does not model continuous price movement, tax, rebates, coupons, memberships, location-specific totals, currency conversion, or production freshness guarantees. The lightweight SVG intentionally provides a compact directional aid rather than interaction-heavy charting. Timestamps are shown in UTC for deterministic presentation.

## Deferred live-provider work

A later milestone may connect a production provider behind the Milestone 36 repository boundary. That work must preserve exact catalog-to-listing mappings, validation, source disclosure, freshness semantics, credentials in an appropriate secret store, and a clear distinction between observed and live values. It is not part of this UI milestone.

## Deferred price alerts

Alerts, thresholds, notifications, scheduled comparisons, and “best time to buy” recommendations remain deferred. They require separate persistence, consent, delivery, reliability, and trust design.

## Rollback notes

Revert the Milestone 37 commit to remove the comparison-drawer integration, price trend component/helpers/tests, structured client error-code preservation, and this document. No route, generated route tree, schema migration, environment file, external service, background process, or new dependency requires cleanup.
