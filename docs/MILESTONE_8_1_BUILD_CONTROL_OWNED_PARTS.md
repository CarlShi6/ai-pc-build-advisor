# Milestone 8.1: Build Control, Owned Parts, and Comparison Polish

Milestone 8.1 keeps the app B2C-first while adding clearer limits around build changes, support for parts the shopper already owns, and easier-to-read comparison details.

## Replacement Limit Rules

Hardware replacements are now tracked separately from AI questions.

| Plan | Hardware replacements |
| --- | --- |
| Free | 3 replacements per build |
| Build Pro | 25 replacements per build |

Previewing swaps, searching parts, and comparing parts do not consume replacement usage. Usage is consumed only when the shopper confirms an actual replacement. If the replacement limit is reached, the drawer keeps search/compare/preview available but blocks the final replace action with an upgrade prompt.

## AI Consultation Limit Rules

AI-style advisor requests keep the existing Milestone 8 usage controls.

| Plan | AI consultation limit |
| --- | --- |
| Free | 5 AI questions per day |
| Build Pro | 50 AI questions per build |

If no AI provider key is configured, the advisor still uses the mock fallback. Compatibility, pricing, part replacement, purchase references, and cart guidance remain rule-based.

## Owned Part Behavior

Parts can now be marked as already owned. Owned parts:

- Show an "Already owned" label.
- Count as `$0` in the build total.
- Still participate in compatibility checks using the available or estimated specs.
- Are excluded from purchase links, or shown as "Already owned - no purchase needed."

This lets a shopper build around hardware they have at home without distorting compatibility checks or the remaining purchase budget.

## Custom Part Behavior

The Part Explorer search tab includes an "Add part I already own" flow. The shopper can enter a brand, model, category context, color, estimated specs, and optional notes.

Custom parts are local-only mock data for this milestone. They are not saved to an account, synced across sessions, or fetched from outside retailers.

If local search has no match, the drawer offers:

- "Add this as a custom part"
- "External retailer search coming later"

## Comparison Delta Behavior

Part cards and the Compare tab now include beginner-friendly deltas beyond price:

- Price difference, such as "Cheaper by $220" or "Adds $180"
- Gaming score difference
- Productivity score difference
- Power draw difference
- Capacity or VRAM difference when relevant
- Color match or mismatch
- Estimated build total after replacing the part

Preview and compare stay free to use. Only confirmed replacement consumes replacement usage.

## Compatibility Warnings UI Changes

Compatibility warnings are now more compact:

- If all checks pass, the page shows a small green status card.
- If warnings exist, each warning appears as a compact row with severity, affected parts, and a short fix path.
- Longer explanations and fix actions live under a "View details" expander.
- Beginner-facing copy uses "Needs review" where the issue may not be definitively broken.

## Future Live Retailer Search Notes

Live retailer search is intentionally out of scope for this milestone. A future version can connect the custom/search flow to retailer APIs or affiliate feeds, but should keep these safeguards:

- Do not let retailer data override rule-based compatibility checks.
- Keep owned parts at `$0` and clearly separate them from purchase recommendations.
- Track affiliate clicks before opening purchase links.
- Continue showing the affiliate disclosure near purchase actions.
- Avoid consuming replacement usage for browsing, searching, previewing, or comparing.
