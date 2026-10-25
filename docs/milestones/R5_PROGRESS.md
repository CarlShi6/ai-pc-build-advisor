# AIPC v3.0 R5 checkpoint — 2026-10-25

Branch: `rebuild/image-to-build-v3`. All R0–R4 work and existing uncommitted changes were preserved. No push, merge, deploy, or destructive repository operation was performed.

## Phase 1 — AI integration verification

- Inspected the existing server-only `/api/image-analyses` route, byte/MIME/dimension limits, metadata removal, OpenAI Responses image input, strict JSON schema, local parsing, missing-key errors, and client request cancellation. The provider must now be explicitly configured as `AI_PROVIDER=openai` before the route transmits an image.
- No `OPENAI_API_KEY`, `AI_PROVIDER_API_KEY`, `.env`, or `.env.local` was present in this local environment. The browser returned `IMAGE_AI_NOT_CONFIGURED` when Analyze was clicked. No successful real API response occurred; live image recognition, structured output, candidate matching, and review actions are **not verified against real AI**.
- Exact local server configuration: set `AI_PROVIDER=openai`; set **one** server-only key, preferably `OPENAI_API_KEY` (or existing alias `AI_PROVIDER_API_KEY`); optionally set `AI_PROVIDER_MODEL=gpt-4.1-mini`; restart the dev server. Keep keys out of `VITE_` variables and client bundles. Use a supported PC image and verify its returned evidence and uncertainty before marking the live path complete.
- OpenAI documentation checked: [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). A direct PowerShell localhost request was denied by the execution environment's socket permissions; browser and injected-handler tests supplied the local route evidence.

## Phase 2 — R5 implemented

- `src/lib/v3/image-build.ts` turns reviewed canonical candidates into an explicit Build draft proposal. The preview lists all eight slots, catalog total, rule findings, and visual differences. Only the final **Confirm and open Build Studio** action writes the active draft. A changed active Build rejects a stale image proposal.
- `src/lib/v3/build-document.ts` stores reference image ID, observations, candidate reviews, locked visual priorities, and planned selection provenance with the authoritative Build. The image bytes are not stored. Replacements and removals update the same Build state and preserve provenance boundaries.
- `src/components/image-candidate-review.tsx` now passes review choices to the draft proposal. The page supports choose, replace, exclude, keep unknown, manual note, preview, cancel, and final confirmation. Unchosen visible case/GPU categories remain unresolved; hidden CPU, memory, storage, and PSU remain unselected.
- `src/lib/v3/scene-presentation.ts` derives illustrative case layout/color, lighting, GPU orientation, and fan accents from confirmed Build parts plus visible priorities. `BuildScene.tsx` uses generic geometry and explicitly labels it illustrative; it never claims exact asset geometry or physical clearance.
- `src/lib/v3/visual-optimization.ts` uses existing canonical catalog parts and `proposePartSelection` for cost or performance alternatives. Locked visible traits constrain candidates. The Studio preview shows separate price, rule, visual, performance-evidence, and physical-fit caveats before the existing revision-checked confirmation. Seed prices are shown as seed prices, not live offers.
- `src/lib/v3/dev-image-fixture.ts` provides a clearly labeled development-only sample for the repository's `public/og.png`. It does not call AI and is excluded from the production path.
- `src/lib/v3/image-build.test.ts` exercises review → proposal → confirmation → unresolved/empty slots → style cues → ordinary replacement → price/rule/occupancy synchronization, stale revisions, visual locks, and illustrative scene cues. `image-analysis.test.ts` also checks explicit provider configuration.

## Phase 3 — validation and screenshots

- Browser fixture path verified: image selected; deterministic observations and regions rendered; candidate choose, replace, and exclude worked; full Build preview listed two chosen parts and six unselected slots; final confirmation opened Studio; 3D and 2D showed the same parts; a cost-oriented GPU replacement changed the Build total from `$758` to `$708` and updated both the 2D slot and 3D callout. The photo identity remained explicitly unverified.
- Screenshots in `C:/Users/carls/.codex/visualizations/2026/10/25/01a1722c-8cd5-73f1-bc32-9f91e4191d83/`: `AIPC_R5_upload_fixture.png`, `AIPC_R5_recognition_fixture.png`, `AIPC_R5_candidates_fixture.png`, `AIPC_R5_build_preview_final_fixture.png`, `AIPC_R5_generated_3d_final_fixture.png`, and `AIPC_R5_missing_key.png`. All success-path screenshots use the **local fixture**, not a real model response.
- Final quality gate: repository lint 0 errors, typecheck passed, **130 tests in 18 files passed**, production build passed, and `git diff --check` passed. The final preview explicitly warns when a chosen catalog case style differs from a locked visual observation.

## Remaining verification

- With a valid server credential and a real PC photo, verify actual provider success, observation regions, structured response parsing, candidate ranking, and the complete R5 browser path. Record that evidence separately from fixture results.
- The seed catalog still has no fan product entry and limited visual metadata. Keep fan identity unresolved until verified catalog records are added.
- Exact 3D assets and measured dimensions are unavailable for these catalog entries; the Studio uses generic geometry and cannot certify clearance.
