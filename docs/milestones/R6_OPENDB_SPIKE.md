# BuildCores OpenDB spike — 2026-10-25

Branch: `rebuild/image-to-build-v3`. Goal (CLAUDE.md step 0): close the R4 fan-coverage gap and UC-01, and get real dimensions for fit rules, by mapping a small set of OpenDB cases, GPUs, coolers and fans into the existing `Part` shape behind an adapter.

**Outcome: stopped at the license check. No OpenDB records were copied into this repository and no adapter was written.** Everything below was read from the public GitHub repository (README, NOTICE, LICENSE history, JSON schemas and directory listings) through the GitHub API.

## License (blocking)

| Date | Commit | Change |
|---|---|---|
| 2025-04-12 | `bbf317f` | Initial commit, `LICENSE.txt` = ODC Attribution License (ODC-By 1.0). |
| 2026-10-05 | `80c21e1` "Introduce prospective CC BY-NC-SA licensing" | `LICENSE.txt` replaced with CC BY-NC-SA 4.0 for new data; ODC-By text moved to `docs/licensing/`. Parent `ef7e601` is the last ODC-By snapshot. |
| 2026-10-09 | `50059f5` "apply CC BY-NC-SA notice to all OpenDB data" | `NOTICE.md` now says CC BY-NC-SA covers "existing records, updates, and future additions". |

- Current terms: non-commercial only. Commercial use needs a separate written grant (`docs/licensing/COMMERCIAL_AGREEMENT.md`, unsigned template; requests go through a licensing inquiry). The guide names advertising, affiliate revenue and paid access as things to disclose.
- This app has Stripe checkout, a paid Build Pro plan and affiliate click tracking, so it fails the "license allows commercial use" test in CLAUDE.md "Reuse before building".
- The README still says "existing permissions remain valid", while `NOTICE.md` claims all data. ODC-By 1.0 grants are perpetual for data received under them, so a snapshot pinned at `ef7e601` may still be usable under ODC-By. That conflicts with the maintainers' current notice, though, so it is a legal and business decision. It is not an engineering default.

## Technical findings (for whichever license path is chosen)

- Categories exist for every slot we need, including **`CaseFan` (3,512 records)**. Also `PCCase` 3,804, `GPU` 3,865 and `CPUCooler` 2,424 (counts from `open-db/<Category>` on `main`, 2026-10-25). One JSON file per product, named by UUID v4 (`opendb_id`).
- Fit fields, all in **mm**:
  - case: `max_video_card_length`, `max_cpu_cooler_height`, `max_psu_length`, `dimensions_mm{depth,width,height}`, `supported_motherboard_form_factors`, `supported_power_supply_form_factors`, `expansion_slots`
  - GPU: `length`, `case_expansion_slot_width`, `total_slot_width`
  - cooler: `height`, `radiator_size`, `fan_size`, `cpu_sockets`
  - fan: `size`
- Appearance fields: `color[]`, `lighting[]`, `metadata.manufacturer_color`, case `side_panel` / `has_transparent_side_panel`, fan `led`.
- Unit trap: `weight` is **pounds for cases** but **grams for GPUs, coolers and fans**. Fan airflow is CFM, noise is dB and static pressure is mmH₂O.
- Identity and provenance: `metadata.part_numbers[]` (MPNs), `general_product_information.manufacturer_url`, retailer SKUs (Amazon, Newegg, Best Buy, …), `identifiers` (versioned snapshot with canonical identifiers and retailer listings), and `metadata.last_manually_spec_verified_at`. These map onto our identity-evidence and catalog-provenance split without invention.
- No price data (stated in the README). Our price rules are unaffected.
- Required attribution wording under the current license: "Data from BuildCores OpenDB (https://github.com/buildcores/buildcores-open-db), licensed under CC BY-NC-SA 4.0. Source release: [identifier]. Changes: [description]." ODC-By would need its own attribution notice.

## Planned adapter (not started)

Once a license path is approved: `src/lib/catalog/opendb-adapter.ts` maps a pinned record set into `Part`, keeping `opendb_id`, MPNs and `last_manually_spec_verified_at` as provenance, converting case weight from pounds, leaving price `null`, and staying separate from `seedParts`. Include `LICENSE`/`NOTICE` files and attribution with any copied data. Fit rules in `compatibility.ts` would read the mm clearances and still report geometry as unverified.

## Decision needed

1. Ask BuildCores for a commercial license (describe Build Pro, Stripe and affiliate revenue), or
2. Approve a pinned ODC-By snapshot at `ef7e601` after legal review, or
3. Drop OpenDB and look for another source with commercial-use terms (manufacturer spec pages entered by hand, or another open dataset).

Until then, fan identity stays unresolved and the catalog stays at `seedParts`.
