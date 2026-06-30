# Milestone 22: Dynamic Substitution Engine

## Summary

Milestone 22 adds a deterministic Dynamic Substitution Engine that proactively recommends replacement parts when the current build has budget pressure, compatibility risk, tight power headroom, overkill selections, cheaper same-tier options, or beginner-risk concerns.

## Implementation

- Added `src/lib/substitution-engine.ts`.
- Added structured substitution types and metadata to `src/types/build.ts`.
- Integrated substitutions into the live advisor build card as `Smart Substitutions`.
- Integrated the best category-specific swap into the Compare Drawer as `Recommended Swap`.
- Reused the existing replacement flow so applied substitutions recalculate build total, compatibility checks, confidence score, purchase references, and decision metadata.

## Deterministic Inputs

The engine only uses local deterministic data:

- Current build parts, budget, target use case, total, compatibility checks, and confidence score.
- Seed catalog parts.
- Existing candidate-build recalculation and compatibility rules.
- Part prices, performance scores, power draw, availability, tags, and category specs.

No LLM-generated reasoning is used for core substitution decisions.

## Substitution Types

- `budgetAlternative`: Cheaper part that keeps practical performance close enough.
- `performanceUpgrade`: Higher-performing option when budget and compatibility allow it.
- `sameTierSubstitute`: Similar tier with a cleaner overall budget or risk fit.
- `beginnerSafeSubstitute`: Lower-risk choice for beginners based on compatibility, power, price, availability, or cooling complexity.
- `compatibilitySafeSubstitute`: Swap that improves compatibility status, warning count, fail count, or confidence score.

## Returned Metadata

Each suggestion includes:

- Original and substitute part IDs.
- Category and substitution type.
- Price delta and total after swap.
- Confidence score after swap.
- Compatibility impact.
- Performance impact.
- Budget impact.
- Beginner-risk impact.
- Recommendation reason.
- Trade-off summary.

## UI Behavior

The Build Card shows the top smart substitutions with quick review and apply actions.

The Compare Drawer shows a category-specific recommended swap when one exists for the selected part. Users can preview it or apply it directly through the existing swap flow.

After applying a substitution, the app refreshes the build state through the same replacement path used by manual swaps.
