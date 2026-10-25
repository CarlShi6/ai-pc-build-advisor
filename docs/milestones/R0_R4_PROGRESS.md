# AIPC v3.0 progress checkpoint

Branch: `rebuild/image-to-build-v3`. Local worktree only; preserve all existing uncommitted changes. No push, merge, deploy, or R5 work.

## Task 1 — repository lint: complete

- Existing repo-wide line endings were normalized to LF and `.gitattributes` now requests LF on checkout.
- Existing Prettier findings were fixed by ESLint's formatter. A Hook initialization and empty type alias were simplified without changing behavior; established shared UI exports were explicitly allowed by the React Refresh lint rule.
- Gate: `npm run lint` 0 errors / 0 warnings; `npm run typecheck`, 113 tests in 15 files, and `npm run build` passed on 2026-10-25.

## Task 2 — R0–R2 verification: complete

- Browser on local dev server `http://127.0.0.1:5175/`: home plus Image, Describe, Import and Blank entry pages inspected.
- Blank draft showed eight empty 2D/3D slots and persistent dashed connectors. GPU selection stayed a preview until confirmation, then changed 3D and 2D together from 0/8 to 1/8. Exploded slider changed from 55% to 100%; WebGL geometry visibly moved. 2D fallback retained the chosen GPU.
- Orbit drag moved projected slot labels; wheel movement changed projection and reverse wheel restored it. Testing found Reset camera only remounted controls, leaving the camera rotated. `BuildScene.tsx` now remounts the Canvas for reset; the CPU label returned to its initial canvas-relative position (420, 210) after reset.
- Seven screenshots for review are under `C:/Users/carls/.codex/visualizations/2026/10/25/01a1722c-8cd5-73f1-bc32-9f91e4191d83/`, named `AIPC_R2_home.png`, `AIPC_R2_image.png`, `AIPC_R2_describe.png`, `AIPC_R2_import.png`, `AIPC_R2_blank.png`, `AIPC_R2_studio_standard.png`, and `AIPC_R2_studio_exploded.png`.
- Gate after camera fix: lint, typecheck, 113 tests, and production build passed.

## Task 3 — R3 image observations: implemented; live provider unverified

- `src/lib/v3/image-input.ts`, `image-contract.ts`, `image-analysis.server.ts`, `image-client.ts`, and `/api/image-analyses` connect the picture to the existing server-only OpenAI configuration. The browser sends a resized, metadata-free copy only after the user clicks Analyze; server independently checks bytes, type, dimensions, and size, strips supported metadata, and uses a bounded in-memory request. No original or processed image is stored or published.
- Strict structured observations record evidence, origin (`observed` / `inferred` / `unknown`), quality, optional normalized regions, and all eight part identities as unknown. The model is told to treat image text as data and cannot output hidden CPU/PSU/storage categories in the accepted schema.
- The Image entry supports selected, preparing, analyzing, ready, failure, retry, remove, and manual continuation states. Local request cancellation prevents stale results from replacing a newer file.
- `src/lib/v3/image-analysis.test.ts` covers MIME/magic/dimensions, metadata stripping, schema boundaries, server request validation, and the missing-key fallback. Browser upload of the repository's `public/og.png` showed a local preview and a clear `IMAGE_AI_NOT_CONFIGURED` error; `AIPC_R3_missing_key.png` captures the state. No real provider success is claimed because this local environment has no OpenAI key.
- Gate: lint, typecheck, 119 tests in 16 files, and production build passed after R3 on 2026-10-25.

## Task 4 — R4 candidate review: implemented; live provider path unverified

- `src/lib/v3/appearance-catalog.ts` derives visible appearance fields and provenance from the existing canonical `seedParts` catalog. No product identities or specifications were invented. The current catalog has no fan entries, so fan findings display `No catalog coverage` and remain unresolved.
- `src/lib/v3/candidate-matcher.ts` retrieves up to five canonical alternatives per visible category, uses stated color, style, cooler type, or legible marking evidence, and keeps visual match, identity evidence, catalog spec coverage, and compatibility status separate. An unsupported case appearance remains unresolved. Appearance alone never becomes a verified SKU.
- `src/components/image-candidate-review.tsx` adds evidence cards, alternate choice, exclude/restore, keep unknown, and manual model notes. A chosen planning option retains the matched observation IDs, photo evidence, and catalog source ID. These choices remain in local review state and do not mutate the authoritative Build; translating reviewed choices into a Build is the R5 boundary and was not started.
- `src/lib/v3/candidate-matcher.test.ts` checks ambiguous alternatives, catalog gaps, visible-marking uncertainty, rendered review information, and choose/replace/exclude/unknown/manual state without Build mutation. The R4 component appears after a successful image analysis. A live success screenshot and provider response could not be verified because this environment has no OpenAI credential; the browser instead verified the missing-credential fallback in Task 3.
- Final gate on 2026-10-25: `npm run lint` passed with 0 errors; `npm run typecheck` passed; 124 tests in 17 files passed; `npm run build` passed. One test invocation initially failed before test collection because the sandbox Temp location rejected Vitest file renames; rerunning with `TEMP` and `TMP` set to a writable local artifact folder passed all tests. The production build emits existing large-chunk and Nitro/Wrangler warnings but exits successfully.
- Final browser check: `http://127.0.0.1:5175/` loaded with all four entry links. Screenshot `AIPC_R4_home_final.png` is in the same artifact folder as the R2/R3 screenshots. The local dev server and in-app browser Preview remain open.

## Remaining work / resume point

- To live-verify R3 and the R4 interactive cards, configure the existing server-only `OPENAI_API_KEY` or `AI_PROVIDER_API_KEY` in the local environment and restart the dev server. Use an actual supported PC photo; review the observations and candidate actions without assuming exact hidden hardware.
- The canonical seed catalog lacks fan products and has limited appearance metadata. Expanding it requires verified source data; do not synthesize fan models or specifications.
- R5 and later are outside this request. Do not apply reviewed image candidates to a Build until the planned proposal, full-build diff, compatibility check, and explicit user confirmation flow are implemented.
- Keep all current uncommitted changes; no push, merge, deploy, or destructive repository action was performed.
