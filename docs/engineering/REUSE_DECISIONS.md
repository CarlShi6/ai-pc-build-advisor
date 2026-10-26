# V3 reuse decisions (R0)

Decisions are provisional until each R1/R2 vertical slice passes its contract tests. “Reuse” means retain the implementation with focused extension; “adapt” means preserve working logic behind a new interface; “replace” means rebuild the UI or integration layer without deleting domain data.

| Module and exact path | Decision | Reason / next action |
|---|---|---|
| `src/types/build.ts`, `src/types/parts.ts` | Adapt | Keep existing Build/Part fields readable; add versioned slots, identity provenance, completeness and revision in a v3 envelope. Do not infer hidden SKU identity. |
| `src/lib/compatibility.ts`, `src/lib/validation.ts`, `src/lib/validation.test.ts` | Reuse + adapt | Tested deterministic rules are valuable. Expose `unknown`/`not_checked` and required-slot completeness separately; add incomplete-draft and physical-fit evidence cases. |
| `src/lib/build-advisor.ts`, `src/lib/substitution-engine.ts` | Adapt | Preserve recommendation and replacement mechanics; route all mutations through a shared proposal/diff/expected-revision commit service. Remove duplicate recalculation entry points through a facade. |
| `src/lib/product-trust.ts`, `src/lib/product-trust.test.ts` | Reuse + adapt | Existing source/freshness disclosures and safe URL logic are useful. Expand provenance to photo observation, user confirmation, imported claims and verified identity. |
| `src/data/seedParts.ts`, `src/data/expandedParts.ts`, `src/lib/product-search/` | Adapt | Keep canonical IDs and catalog lookup; add appearance attributes and explicit candidate ranking. Seed coverage is bounded; no exact-match claims from resemblance. |
| `src/lib/pricing/`, `src/types/pricing.ts` | Reuse | Preserve price observation validation and source timestamps. Treat `best-buy-mappings.ts` empty map as a hard limit on verified live SKU coverage. |
| `src/lib/persistence/`, `src/lib/supabase/`, `docs/supabase/schema.sql` | Adapt | Preserve auth, ownership and saved Build access. Add a versioned JSON adapter and image-lifecycle storage with additive migrations only after round-trip fixtures. |
| `src/lib/api-router.ts`, `src/lib/apiClient.ts`, `src/types/api.ts` | Adapt | Keep current endpoints working; introduce image and revisioned Build endpoints at this boundary with runtime validation. |
| `src/lib/ai/` | Adapt | Keep provider boundary and failure handling; vision observation schema is new and separate from authoritative catalog/compatibility results. |
| `src/routes/index.tsx`, `src/routes/consult.tsx`, `src/routes/build.tsx`, `src/routes/dashboard.tsx`, `src/components/top-bar.tsx`, `src/styles.css` | Replace gradually | Current navigation and large route-local workspaces do not express the image-first journey or one cross-route Build state. Keep functional legacy routes until migrated. |
| `src/components/ui/` | Reuse selectively | Existing accessible Radix primitives can support the new design system; audit each component's visual and keyboard behavior rather than wholesale copying layout. |
| `src/components/build-card.tsx`, `src/components/compare-drawer.tsx`, `src/components/comparison-table.tsx`, `src/components/current-offer-panel.tsx` | Adapt | Preserve useful interaction and price content, but bind to the common Build/slot selectors and proposal service. |
| `src/lib/decision-workspace/journey-state.ts` and tests | Adapt | Keep stale-request sequencing and operation gating; move authoritative revisions into a domain transaction, not only route refs. |
| 3D scene and image-analysis modules | Build new | No implementation/dependency found. Defer specific rendering package/version until R2 compatibility check. |
| Checkout/monetization routes and `src/lib/stripe.server.ts` | Defer | Keep existing paths working; redesign purchase gating only after the flagship decision flow and truthful trust states work. |

## External open-source candidates (2026-10-25)

| Source | License | Decision | Notes |
|---|---|---|---|
| [BuildCores OpenDB](https://github.com/buildcores/buildcores-open-db) | **CC BY-NC-SA 4.0 (non-commercial) since 2026-10-05**, applied to all data, existing records included, by `NOTICE.md` on 2026-10-09. ODC-By 1.0 before that (last ODC-By commit `ef7e601`). | **Rejected (2026-10-25)** | The data license is now CC BY-NC-SA 4.0, which doesn't allow commercial use. We won't seek a commercial license and won't use the older ODC-By snapshot (`ef7e601`). Don't copy any OpenDB data. Spike notes: `docs/milestones/R6_OPENDB_SPIKE.md`. Catalog gaps (case fans first) are filled from manufacturer pages by hand instead. |
| [docyx/pc-part-dataset](https://github.com/docyx/pc-part-dataset) | MIT (code); data scraped from PCPartPicker | **Reject** | Data provenance conflicts with the no-unauthorized-scraping principle (PRD 13.2, legacy PRD 3.3). |
| Grounding DINO / OWLv2, CLIP/SigLIP + pgvector | Apache-2.0 / MIT (verify per checkpoint) | **Defer** | Region detection and appearance embeddings need hosted GPU inference. Revisit after the real image provider is connected and attribute matching proves insufficient (PRD Appendix B). |
| Playwright (`@playwright/test` 1.64.0) | Apache-2.0 | **Adopted (R7 slice 1, 2026-10-25)** | E2E browser tests for PRD §19.3 flows. Pinned exact, run in local Edge (`channel: "msedge"`) without a bundled browser download. See `docs/milestones/R7_PROGRESS.md`. |
| `@react-three/postprocessing` 3.2.0 + `postprocessing` 6.39.5 (pmndrs; brings `n8ao` 2.x for SSAO) | MIT / Zlib / ISC | **Adopted (demo track week 1, 2026-10-25)** | Studio-look Studio scene: SSAO (N8AO), bloom on emissive RGB parts, light depth of field and vignette. Mature, React Three Fiber 9 peers match (fiber 9.8.2, three 0.186.1). Pinned exact. |
| drei `Environment` + `Lightformer`, `ContactShadows`, `MeshReflectorMaterial`, `Edges` (already a dependency, drei 10.7.9) | MIT | **Reused** | Studio light rig built from lightformers instead of drei's HDRI presets, which download HDR files from a CDN at runtime. No HDRI asset or extra license is shipped. `AccumulativeShadows` was not used for now (heavier); `ContactShadows` is enough for the demo. |
| Rate limiting: `rate-limiter-flexible` (ISC), `@upstash/ratelimit` (MIT), Cloudflare Workers rate-limiting binding | Permissive / platform | **Not adopted now; revisit at deployment** | R6 per-session image limit (2026-10-25) is about 70 lines in `src/lib/v3/image-rate-limit.server.ts`, next to the existing in-memory process cap. A library's memory backend would be just as non-durable on Workers isolates, so it would add a dependency without fixing durability. At deployment, use the host's rate-limit binding or a shared store (e.g. Upstash Redis) behind the same `ImageSessionLimiter.reserve` interface. |
| Open LLM VRAM calculators (e.g. gguf-llm-vram-calculator) | Check per repo | **Defer to P1** | Reference formulas for the Local AI Workstation Lab only. |

## Guardrails

1. One Build document and one revision govern 2D, 3D, AI suggestions, saves and export.
2. Scene manifests and image analysis are evidence/presentation inputs, never authoritative Build mutations.
3. Replacement preview is read-only. Commit requires user confirmation and an expected revision.
4. Any legacy record must remain readable before new saves are written.
