# AIPC v3.0 baseline audit (R0)

Date: 2026-10-25. Scope: local repository inspection only. Source documents: `AIPC_v3.0_Rebuild_Kickoff_Prompt.md` and `AIPC_Engineering_PRD_v3.0_Image_to_Build_Rebuild.md` supplied for this work. This audit records observed code separately from proposed v3 behavior.

## Repository and safety

- Path: `C:\Users\carls\Documents\ChatGPT\AI装机助手\ai-pc-build-advisor` (existing worktree for `CarlShi6/ai-pc-build-advisor`).
- Starting branch: `milestone-40-visual-decision-workspace`, HEAD `d9a3703`. Initial `git status --short --branch` showed no changed or untracked files.
- Remote: `origin` points to `https://github.com/CarlShi6/ai-pc-build-advisor.git`. No remote operation was performed.
- R0 branch created locally: `rebuild/image-to-build-v3`. The existing branch and history are intact. No database was contacted or migrated.
- During checks, Vite touched generated `src/routeTree.gen.ts` without changing its Git blob (working file hash equaled HEAD). Tests generated `.audit-tmp/node-compile-cache`. Both were verified as check artifacts and the worktree was clean again before these documents were added.

## Actual stack and scripts

`package.json` defines TanStack Start / React 19 / TypeScript / Vite 7, Tailwind 4, Vitest, ESLint and Prettier. Supabase, OpenAI and Stripe are dependencies. `package-lock.json` and `bun.lock` both exist; the audited commands used the installed `node_modules` and npm scripts. Available scripts: `dev`, `build`, `build:dev`, `preview`, `test`, `typecheck`, `lint`, `format`. Cloudflare/Nitro build output is configured through `vite.config.ts` and `wrangler.jsonc`.

## Baseline checks

| Command | Result | Interpretation |
|---|---|---|
| `npm test -- --reporter=dot` | Initially 13 suites failed before tests ran with `EPERM` renaming Vitest SSR files in the sandbox's system temp directory | Environment/temp-path failure, not 13 proven test failures. |
| Same command with `TEMP` and `TMP` set to a repository-local temporary directory | 13 files, 106 tests passed | Baseline tests pass under a writable temp path. The temporary cache was removed afterward. |
| `npm run typecheck` | Passed | Existing TypeScript compilation is sound. |
| `npm run lint` | Failed: 27,505 findings (27,497 errors, 8 warnings) | 27,496 errors were reported as automatically fixable; output was dominated by Prettier `Delete ␍` line-ending findings on Windows. Do not bulk-format the legacy tree as part of R0. Other lint findings remain to be classified after line-ending normalization. |
| `npm run build` | Passed | Client, SSR and Nitro/Cloudflare bundles generated. Warnings include ignored dependency `use client` directives and overridden Wrangler `main`/`assets`. No deployment occurred. |

## Existing product and gaps

- File routes are in `src/routes/`: `/` (`index.tsx`) is the current visual decision workspace; `/consult` is the older guided build flow; `/build`, `/compare`, `/cart`, `/dashboard` and checkout routes remain. The root app and router live at `src/routes/__root.tsx` and `src/router.tsx`.
- The home workspace already previews replacement, recalculates compatibility, confirms locally, tracks an in-memory revision and supports saved Builds. Its canonical `Build` is held in route-level React state (`src/routes/index.tsx`). `/consult` has a separate route-level `Build` state and replacement flow (`src/routes/consult.tsx`); a shared persisted/session state across these routes is not yet established.
- `src/types/build.ts` represents a Build as `parts: Part[]`, plus price and compatibility summaries. It has no explicit eight-slot occupancy, unresolved identity, evidence, scene, durable revision or decision ledger fields. `src/types/parts.ts` includes categories and some source fields but no image-identity confidence hierarchy.
- Deterministic compatibility rules exist in `src/lib/compatibility.ts`; replacement and suggestions exist in `src/lib/build-advisor.ts`, `src/lib/substitution-engine.ts` and `src/lib/product-trust.ts`. They need adaptation for incomplete image drafts and explicit unknown versus checked results. In particular, old `pass` summaries must not imply a missing required slot has passed validation.
- Proposal/confirmation exists as UI state in `src/routes/index.tsx` (`refinementProposal`, replacement preview, `buildRevisionRef`). There is no shared, server-enforced expected-revision commit interface or persisted decision ledger. `src/lib/build-advisor.ts` and `src/lib/product-trust.ts` both export a Build recalculation path; consolidate through one domain facade rather than duplicating rules.
- Catalog seed data is in `src/data/seedParts.ts` and `src/data/expandedParts.ts`. Product search and mocked retailer adapters are in `src/lib/product-search/`. Price provenance and history live in `src/lib/pricing/` and `src/types/pricing.ts`; `src/lib/pricing/best-buy-mappings.ts` deliberately has an empty verified production SKU map. A live-price claim is therefore unsupported for general catalog items.
- Persistence uses `src/lib/persistence/types.ts`, `mock-store.ts`, `server-store.ts` and `index.ts`; HTTP endpoints are dispatched from `src/lib/api-router.ts`. The SQL reference schema is `docs/supabase/schema.sql`, with `saved_builds.build` and `build_needs` stored as JSONB. This permits an additive envelope, but old rows and clients need a versioned reader/writer and round-trip tests. The mock and Supabase stores must share that contract.
- No Three.js, React Three Fiber, Babylon, glTF scene, WebGL canvas or eight-anchor scene was found in `package.json` or `src/`. The current visuals are 2D. Image upload/observation/candidate-review services are also absent.
- UI complexity is concentrated in `src/routes/index.tsx` and `src/routes/consult.tsx`, with route-local state and large components. These are integration and regression risks for the redesign.

## Saved-Build and schema risk

Current saved rows carry the old Build JSON shape. A destructive SQL rewrite is unnecessary and risky. First add a versioned v3 document adapter at the application boundary: read absent version as legacy, preserve original selections and unknown fields, derive explicit slot states, and write only after a user-confirmed mutation. Keep a copy of the legacy payload when converting in memory. Add fixture tests for old mock and Supabase-shaped rows, including a save/load/export round trip. Only consider additive SQL columns for indexed metadata or image ownership after those contracts are tested; use separate, reversible migrations and backup procedures. Current `recalculateBuild` on load may normalize old records, so migration tests must check identity and selection preservation, not only totals.

## v2.0 assumptions contradicted or unverified

- The v2-derived PRD language that suggests a reusable canonical Build service overstates the current shape: there is a Build type and deterministic functions, but no shared revisioned transaction service.
- A functional 3D implementation cannot be retained: no 3D dependency or scene was found.
- Existing saves do not already encode unresolved/photo evidence states.
- Price history and a Best Buy pilot exist, but production verified Best Buy mappings are empty; broad live-price coverage is unverified.
- The older `docs/SKILL.md` describes milestone 6 and preserving the Lovable layout. It is stale against the current milestone-40 code and the user's v3 direction; it is historical context, not the product requirement for this rebuild.

## Next decision

Proceed to the small R1 slice in `docs/milestones/R0_AUDIT.md` after reviewing this audit. Maintain the existing routes while introducing the new shell and shared Build adapter. R0 intentionally changes documentation only.
