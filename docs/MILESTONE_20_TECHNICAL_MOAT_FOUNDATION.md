# Milestone 20: Technical Moat Foundation

## Goal

Milestone 20 adds the first deterministic technical moat layer: a Compatibility Rule Engine v1 and a Build Confidence Score. The app now explains whether a recommended PC build is technically safe or risky without relying on LLM output for hardware validation.

## Compatibility Rule Engine v1

The rule engine lives in `src/lib/compatibility.ts` and evaluates each build through structured rules. Each rule returns a `CompatibilityRuleResult` with:

- `id`
- `label`
- `severity`: `pass`, `warning`, or `fail`
- `message`
- `affectedPartIds`
- `suggestedFix`
- `checkedPartCategories`

Rules covered in v1:

- CPU socket vs motherboard socket
- RAM type vs motherboard memory type
- GPU length vs case max GPU clearance
- Motherboard form factor vs case supported form factors
- Estimated system wattage vs PSU wattage and headroom
- Cooler socket support
- Cooler physical case fit, including air cooler height and AIO radiator support
- GPU vendor PSU guidance

## Build Confidence Score

Every generated or recalculated build now includes `confidenceScore`:

- `score`: 0-100
- `label`: High, Medium, or Low
- `summary`
- pass, warning, and fail counts

The score is deterministic and derived from rule results:

- Warnings reduce confidence.
- Failing checks reduce confidence more heavily.
- Passing all checks returns a high-confidence build.

## UI Changes

The recommendation UI now surfaces:

- A dedicated confidence stat on the build card
- A concise Build Insight summary from the confidence result
- Key compatibility findings, including passing checks and any risk items
- Compatibility confidence in swap previews
- Compatibility checks in exported build plans

## Compatibility With Existing Data

Saved builds are recalculated when loaded from persistence so older saved build JSON can receive the new `compatibilityChecks` and `confidenceScore` fields.

## Notes

- The implementation is deterministic and rule-based.
- No secrets were added.
- The project does not currently define a test script, so Milestone 20 verification uses the production build.
