# Milestone 32: Compare-first UX Redesign

## Goal

Upgrade the compare drawer from a part browsing and replacement utility into a compare-first decision interface. The redesigned experience helps users decide which option to choose, understand the gains and losses, judge whether a price difference is worthwhile, and see how a replacement affects the full build.

This milestone preserves the existing part search, comparison selection, swap preview, and replacement behavior. It does not introduce retailer integrations, checkout, new external services, authentication changes, or database changes.

## Why Compare Is Now a Core Decision Tool

AI PC Build Advisor is intended to explain PC part decisions, not only organize compatible components. Similar GPUs and CPUs can appear interchangeable in a catalog while differing meaningfully in gaming fit, creator performance, price, power demand, platform requirements, and total-build value.

The compare system therefore treats the current build as decision context. It answers which option is recommended, why it fits, what changes relative to the current part, and whether that change is justified. Replacement remains the final action, but explanation and confidence come first.

## Main UX Changes

- A Quick Verdict is visible at the top of the drawer before the user opens the detailed comparison table.
- A decision summary places the current part beside the leading alternative.
- The summary surfaces part price, price difference, performance fit, value rating, full-build budget impact, power impact, and compatibility impact.
- Selected alternatives receive tradeoff-focused cards before the detailed specification table.
- GPU and CPU guidance uses category-aware copy for gaming, creator work, productivity, platform, PSU, case, memory, and cooler considerations.
- The swap preview now states the new total, budget position, compatibility result, and suggested next action.
- Successful replacement feedback repeats the new total, amount over or under budget, compatibility status, and next step after the drawer closes.
- Existing search, retailer-preview metadata, compare selection, swap preview, and replace actions remain available.

## Quick Verdict Behavior

The Quick Verdict evaluates the current part and visible alternatives using the existing deterministic decision metadata. It considers compatibility status, value, performance, budget fit, beginner risk, the full-build total, and any explicitly recommended compatibility or substitution option.

The verdict presents:

- The recommended option.
- A short reason for the recommendation.
- The workload or buyer profile it best serves.
- A direct assessment of whether the upgrade or downgrade is worth the price difference.

An incompatible option is not promoted over a safe current part. When the available data does not show a worthwhile improvement, the verdict can recommend keeping the current part. When the recommendation is an alternative, the user can open its swap preview directly.

## Decision Summary Behavior

The decision summary compares the current part with the leading alternative in two parallel cards. Each card shows:

- Part price and alternative price difference.
- Performance fit and measured difference where available.
- Value rating or derived value score.
- New full-build total and amount over or under budget.
- Listed power demand and change from the current part where available.
- Compatibility status and supporting-part impact.

GPU summaries call out available PSU and case checks. CPU summaries call out available motherboard, memory, and cooler checks. These statements reflect deterministic compatibility rules and do not claim validation when the underlying data is unavailable.

## Tradeoff Sections

The detailed compare view leads with one tradeoff card per selected alternative. Each card answers:

- What do I gain?
- What do I lose?
- Is the option better suited to gaming, creator work, productivity, or balanced use?
- Does it change PSU, case, motherboard, memory, or cooler compatibility according to available checks?
- Does the resulting build remain within budget?
- Is the price difference worthwhile?

The existing explainable comparison table remains below these cards for users who want retailer metadata, specification rows, scores, compatibility detail, and direct swap actions.

## Data Used

The compare-first interface reuses the existing `Build`, `Part`, and `PartDecisionMetadata` structures. It uses:

- Current build parts, total price, and budget.
- Deterministic compatibility checks, warnings, status, and confidence score.
- Part price and owned-part state.
- Category specifications and `specSummary`.
- Performance scores for gaming and productivity where available.
- Power draw, TDP, or wattage fields where available.
- VRAM, capacity, and CPU core metadata where available.
- `valueRating`, `valueScore`, or the existing derived value fallback.
- Retailer, stock, and purchase-reference metadata in the detailed table and cards.
- Existing substitution and recommended-replacement identifiers.

No separate persisted comparison model was introduced.

## Known Limitations

- Performance and value assessments are deterministic catalog guidance, not live benchmark results.
- Some categories or manually entered parts have limited specifications, so the interface may show category-level fit instead of a numeric difference.
- Power impact is shown only when comparable numeric wattage or TDP data exists.
- Compatibility coverage is limited to the app's current rules and available metadata; it is not a substitute for manufacturer documentation.
- Retailer prices, stock, and product references remain demo or local catalog data unless otherwise identified.
- The verdict does not use live retailer inventory, live pricing, inventory scraping, or external benchmark services.
- Advanced comparison content and replacement limits continue to follow the existing plan behavior.

## Future Improvements

- Add workload-specific benchmark sources and confidence ranges.
- Let users select the decision priority directly, such as gaming performance, creator performance, quiet operation, efficiency, or lowest total cost.
- Explain when a GPU change merits a PSU upgrade or when a CPU change requires a platform bundle in more detail.
- Compare total platform cost across CPU, motherboard, memory, and cooler changes.
- Preserve and share comparison decisions alongside saved builds.
- Add richer accessibility and narrow-screen treatment as part of a future visual-system pass.

## Scope Constraints

- No live retailer API.
- No checkout or payment flow.
- No inventory scraping.
- No new external services.
- No Supabase schema changes.
- No authentication changes.
- No full visual system redesign.
- No landing page redesign.
