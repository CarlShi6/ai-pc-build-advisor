# Milestone 34: MVP Validation and Production Hardening

## Goal

Validate and harden the existing public MVP journey from landing page to recommendation, advisor guidance, part comparison, replacement, shopping list, and purchase-reference handoff. This milestone focuses on trustworthy state transitions, recoverable failures, bounded runtime inputs, useful product telemetry, and repeatable regression coverage.

## Core-flow Bugs Fixed

- Compare requests now carry a request identity so a slow response for an older category cannot overwrite the currently open category.
- Closing the compare panel invalidates in-flight compare work instead of allowing closed state to be repopulated later.
- Advisor-driven needs are committed only after the matching build and purchase details refresh successfully. A failed refresh keeps the previous needs and build together.
- Replacement actions now have an immediate in-flight guard, preventing rapid duplicate clicks from starting multiple usage and replacement operations.
- Affiliate destinations are validated before opening, and navigation no longer waits for non-critical click tracking to complete.
- Empty advisor submissions are disabled instead of sending a no-op request.

## State-consistency Improvements

- Initial recommendation loading ignores results after unmount or after a newer retry begins.
- Compare loading, results, errors, and completion state are applied only by the latest request.
- Failed advisor prompts are retained separately for retry without duplicating the user's chat message.
- A failed needs refresh leaves both the displayed needs and recommended build unchanged.
- Replacement success updates the build, cart preview, employee summary, usage state, saved-build identity, feedback identity, and compare state as one completed transition.

## Loading and Empty States

- The initial recommendation continues to show a dedicated loading panel and now transitions to an actionable failure state.
- Compare continues to distinguish loading, error, and insufficient-alternative states.
- Advisor generation disables prompt actions and shows recommendation work in progress.
- Existing empty states for build parts, purchase references, recommendation summary, saved builds, and shopping list remain intact.

## Error Handling and Retry Behavior

- API requests time out after 12 seconds instead of hanging indefinitely.
- Read-only requests retry once for transient transport and server failures.
- Idempotent recommendation, compatibility, and cart-preview requests opt into one transient retry.
- Initial build failures have an in-place retry action.
- Compare failures have an in-panel retry action.
- Advisor failures retain the failed prompt and expose a retry action without appending a duplicate user message.
- Invalid or unsafe purchase URLs are blocked with user-visible feedback.
- Analytics delivery remains best-effort and never blocks product behavior.

## Analytics Instrumentation

The MVP emits bounded, typed first-party events to `/api/analytics/events`. Request bodies over 8 KiB are rejected before normalization, event properties are limited to primitive values, key and value lengths are capped, and arbitrary nested data is discarded.

- `landing_cta_clicked`
- `consultation_load_succeeded`
- `consultation_load_failed`
- `consultation_load_retried`
- `advisor_request_started`
- `advisor_request_succeeded`
- `advisor_request_failed`
- `advisor_request_retried`
- `compare_opened`
- `compare_load_succeeded`
- `compare_load_failed`
- `compare_load_retried`
- `replacement_started`
- `replacement_succeeded`
- `replacement_failed`
- `replacement_blocked`
- `shopping_list_opened`
- `affiliate_link_opened`

The server currently writes accepted events as structured logs. No external analytics vendor or persistent analytics store is introduced.

## Validation Utilities

- Recommendation inputs are normalized and bounded before reaching build-selection logic.
- Returned builds are checked for required identity, parts, finite prices, unique primary categories across both owned and selected parts, total consistency, compatibility metadata, and confidence score range before entering client state.
- External purchase URLs are restricted to HTTP and HTTPS.
- Analytics event names and properties are allow-listed and normalized.

## Automated Tests

Vitest regression coverage verifies:

- Recommendation input normalization and invalid-budget rejection.
- Generated build acceptance and inconsistent-total rejection.
- Rejection of owned and selected parts that share a primary category.
- Safe purchase URL acceptance and executable-scheme rejection.
- Analytics allow-listing and property sanitization.
- API-level 400 behavior for invalid recommendation input.
- API-level acceptance of supported analytics events.
- API-level rejection of analytics request bodies over 8 KiB.

## Manual QA Checklist

- [x] Landing page build call to action navigates correctly.
- [x] Initial recommendation and purchase references load successfully.
- [x] Advisor send and response states remain usable with the configured provider.
- [x] Retrying a failed advisor prompt keeps a single user chat message and does not duplicate it.
- [x] Rapid keyboard switching from CPU to GPU compare finishes with GPU-only alternatives and no stale CPU results.
- [x] GPU compare opens with a populated Quick Verdict and alternatives.
- [x] Replacement preview and confirmation update build total, compatibility, usage, and purchase references together.
- [x] A rapid replacement double-click applies one replacement and consumes one swap.
- [x] Shopping list opens and remains usable at desktop and 390px widths.
- [x] An invalid executable-scheme purchase URL shows the intended visible error and opens no tab.
- [x] Saved build load, rename, delete, and feedback paths complete successfully.
- [x] No console warning or error occurs during the exercised core flow.

## Known Limitations

- Retailer prices, availability, and purchase metadata remain demo/reference data rather than live inventory.
- Analytics events are emitted to structured server logs only. The MVP endpoint has an 8 KiB request cap and bounded normalized fields, but no endpoint-specific authentication or durable rate limiter; deployment-level abuse controls, durable storage, dashboards, consent controls, and external analytics integrations remain future work.
- The app still uses local/mock fallbacks when production AI or persistence services are not configured.
- Automated browser end-to-end coverage is not introduced in this milestone; the core journey is covered by build checks, unit/API regression tests, and manual QA.
- Authentication and checkout remain the existing mock/development implementations where production providers are unavailable.
- `npm audit --omit=dev` reports one low-severity advisory in Vite's development-server `esbuild` dependency after all non-breaking audit fixes; production output is not served by the Vite development server.

## Deferred Price-history Functionality

Price-history collection, persistence, charts, alerts, trend analysis, and retailer price monitoring are explicitly deferred. This milestone does not implement price-history functionality.
