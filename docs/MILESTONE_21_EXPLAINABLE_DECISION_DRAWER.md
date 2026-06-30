# Milestone 21: Explainable Decision Drawer

Milestone 21 upgrades the existing Compare Drawer into an Explainable Decision Drawer. The drawer now helps beginners understand which selected part is the better decision, not only which part has stronger raw specs.

## Decision Metadata

The drawer computes structured metadata for compared parts:

- `bestValue`
- `bestPerformance`
- `bestBudgetFit`
- `beginnerFriendly`
- `compatibilityImpact`
- `totalPriceAfterSwap`
- `recommendationReason`
- `tradeOffSummary`

The metadata type lives in `src/types/build.ts` as `PartDecisionMetadata`.

## Deterministic Logic

Core decision logic lives in `src/lib/decision-metadata.ts` and does not use LLM-generated reasoning.

Inputs include:

- Existing part price and owned-part pricing rules
- Build total and build budget
- Part value and performance scores
- Category-specific numeric specs when explicit scores are unavailable
- Power draw or wattage differences
- Compatibility Rule Engine v1 results
- Build Confidence Score after the candidate swap

Each compared part is evaluated as a candidate swap against the current build. The helper calculates the new total, compatibility status, warning/fail counts, confidence score, value score, performance score, and beginner risk. Winners are then selected for best value, best performance, best budget fit, and beginner friendliness.

## Drawer UI Changes

The drawer now opens as a decision-oriented comparison experience:

- Header copy now frames the drawer around part decisions.
- The Compare tab starts with a decision guide.
- Compared parts show badges such as Best Value, Best Performance, Best Budget Fit, and Beginner Friendly.
- The table includes recommendation reason, trade-off summary, total after swap, and compatibility impact before raw spec rows.
- Swap preview shows the same decision badges and concise rule-based explanation before replacement.

The previous spec comparison table remains available so users can still inspect the underlying part data.

## Compatibility And Swap Flow

Compatibility impact is based on candidate builds evaluated through the deterministic compatibility rule engine. Swap preview still uses the existing replacement callback, so confirming a replacement continues to update total price, compatibility warnings, confidence score, purchase references, and usage state through the established flow.

## Notes

Milestone 21 intentionally avoids LLM-generated decision logic. Catalog-provided recommendation text may still appear as fallback copy, but the badges, totals, compatibility impact, and trade-off summaries are computed locally from app data.
