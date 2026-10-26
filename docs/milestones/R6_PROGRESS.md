# AIPC v3.0 R6 checkpoint (slice 1: save round trip) — 2026-10-25

Branch: `rebuild/image-to-build-v3`. Existing uncommitted changes preserved. No push, merge, deploy, or database operation.

## Problem

Build Studio could open a saved Build, but a v3 draft could not be saved. Drafts lived only in `sessionStorage`; source, unresolved slots, the original pasted text, and image-review context were lost when the tab closed. Saved builds also reopened under a regenerated name, because both persistence stores rebuild `build` from its parts (`build-advisor.recalculateBuild`) and drop every other field.

## Implemented

- `src/lib/v3/build-document.ts`: `StoredDraftEnvelope` (`v3Draft`) is carried inside the existing `saved_builds.build` JSON. **No SQL migration.** `toSavedBuildPayload` writes it; `fromLegacyBuild` reads it back and still treats builds without it as `legacy`. On read the envelope is re-validated: unknown sources are rejected, negative or invalid revisions reset to 0, non-slot or non-string unresolved notes are dropped, unresolved notes for slots that now hold a part are dropped, `imageContext` is discarded unless `imageStored === false`, and image `plannedSelections` survive only while that exact part is still in the slot. `sourceInput` is capped at 20,000 characters.
- `src/lib/persistence/draft-envelope.ts` plus `mock-store.ts` / `server-store.ts`: `withDraftEnvelope` carries the envelope across the store's rebuild (on save, and on Supabase row read) and refuses envelopes over 200,000 serialized characters.
- `src/routes/studio.tsx` (and two CSS rules in `styles.css`): **Save build / Save changes** in the Studio header with status text (Not saved yet / Saving… / Saved to My Builds / Unsaved changes / error). Later saves update the same saved Build (`savedBuildId`), so they don't take another Free slot. The bottom note now says the reference photo is never stored.
- `src/routes/my-builds.tsx`: reopening uses the saved Build's name instead of the regenerated one.
- `src/lib/v3/build-document-save.test.ts`: 6 tests. They cover the mock-store round trip (source, revision, unresolved, completeness, part IDs, no envelope leaking into the Studio build), legacy fallback, slot filled elsewhere, malformed envelope, image context pruning and `imageStored` guard, and the oversized-envelope refusal.

## Verification

- Browser, local dev server `http://127.0.0.1:5175/`: Import of 3 catalog lines plus 1 unknown PSU line → Studio → **Save build** (`POST /api/builds/save` 200) → cleared the tab's draft → My Builds → Open in Studio. Name, `import` source, 3/8 selected, the PSU still unresolved as "Some mystery 1000W PSU", the original parts list, and "Saved to My Builds" all restored.
- The new and existing `build-document` tests ran in a cloud workspace using Node type-stripping and a minimal `vitest` shim (6/6 and 4/4 passed). The cloud workspace had no npm registry access, so **`npm run lint`, `npm run typecheck`, the full Vitest suite, and `npm run build` were not run.** Run them locally before committing.
- Mock persistence is in-memory: dev-server hot reloads of persistence modules clear saved builds. This is expected and is not a regression.

## Observed, not changed

- On a freshly loaded page, the first click on a client button sometimes does nothing (seen on Save build and Open in Studio before hydration finished). Worth a hydration and loading check during R7.
- Supabase path: the envelope rides in the existing JSONB column and is untested against a real project here.

## Next R6 slices

1. Export or report for an incomplete draft, showing unresolved and unknown states (not `pass`). Done in slice 2 (Studio shopping plan with Markdown and JSON report).
2. Price and source disclosures plus shopping links from the Studio for selected slots only. Done in slice 2.
3. Revision check on save (reject a stale tab overwriting a newer save). Done in slice 3, below. Privacy deletion is still open.

# R6 slice 3: revision check on save — 2026-10-25

## Problem

Two tabs could open the same saved Build. Whichever tab saved last silently replaced the other's save, because the save endpoint overwrote by `id` with no version check.

## Implemented

- `src/lib/persistence/save-version.ts`: the saved record's `updatedAt` is its save version. `assertSaveVersion` throws `SaveConflictError` (code `SAVE_CONFLICT`) when the caller's expected version no longer matches. `nextSaveTimestamp` always moves the version forward, even for two saves in the same millisecond.
- `SaveBuildInput` / `SaveBuildRequest` carry an optional `expectedUpdatedAt`. Both stores check it before writing. The Supabase update also filters on `updated_at = <checked version>`, so a save that lands between the read and the write matches no row (`PGRST116`) and is reported as a conflict, not applied. **No SQL migration.** A save without `expectedUpdatedAt` stays unchecked, so legacy routes and tabs opened before this change behave as before.
- `src/lib/api-router.ts`: a conflict returns `409 { error: { code: "SAVE_CONFLICT", message } }`. Other save failures keep their existing 403.
- `src/lib/v3/build-document.ts`: `BuildDocumentV3.savedVersion` (tab state only, not stored in the envelope). `fromSavedBuild` opens a saved record with its version and saved name; My Builds uses it.
- `src/routes/studio.tsx` (plus one CSS rule): saves send `expectedUpdatedAt` and store the returned version. On a conflict the status explains that the build was saved elsewhere and offers **Open saved version** (replaces this tab's draft with the newer save) or **Overwrite with this tab** (re-fetches the latest version and saves against it). Both choices are explicit, and neither happens automatically.
- Tests: 4 in `build-document-save.test.ts` (open-with-version, stale save rejected and the newer save kept, explicit overwrite stays one saved slot, unversioned saves unchecked, strictly increasing versions). 1 in `api-router.test.ts` (409 `SAVE_CONFLICT` over HTTP).

## Verification

- Gate: lint 0, typecheck passed, **149 tests in 20 files** passed, build passed (existing chunk-size, `"use client"` and Wrangler warnings only).
- Browser, `http://127.0.0.1:5175/`, two tabs. Tab A: Blank → Save build. Tab B: My Builds → Open in Studio → case NZXT H5 Flow → Save changes (200). Tab A: case Corsair 4000D Airflow → Save changes → **409**, conflict message and both buttons shown. **Open saved version** loaded tab B's NZXT case and showed "Saved to My Builds". Then tab A saved again (200), making tab B stale. Tab B: Lian Li O11 Dynamic EVO → Save → 409 → **Overwrite with this tab** → GET latest → POST 200. My Builds still listed one build.

## Limitations

- Post-build feedback also bumps a saved Build's `updatedAt`, so feedback added elsewhere makes the next Studio save report a conflict even though the parts didn't change. Overwriting is safe in that case, because feedback is stored separately.
- The Supabase conditional update is untested against a real project here. The mock store checks and writes synchronously, so it has no race window.
- A deleted saved Build is still recreated by a later save from an open tab (existing behavior, unchanged).

# R6 slice 4: v3 funnel analytics — 2026-10-25

## Implemented

Reuses the existing pipeline (`trackAnalyticsEvent` → `POST /api/analytics/events` → structured `product_analytics` log line). No new dependency.

- `src/lib/analytics.ts`: nine allow-listed v3 event names.
- `src/lib/v3/funnel-analytics.ts`: typed `funnel.*` helpers plus property builders. They send only enums, counts and slot/category names: `source`, `selected_count`, `unresolved_count`, `empty_count`, `complete`, `quality`, `observation_count`, `review_status`, `format`, `link_kind`. **Never** image bytes, file names, observation or summary text, pasted lists, descriptions, manual notes or part names. The existing per-tab `session_id` joins the steps of one funnel.

| PRD §19.1 step | Event | Fired from |
|---|---|---|
| image submitted | `v3_image_submitted` (`fixture`) | Analyze click, or Load local fixture (`fixture: true`) — `start.$mode.tsx` |
| analysis completed | `v3_image_analysis_completed` / `v3_image_analysis_failed` (`error_code`) | analysis result; superseded or cancelled requests send nothing |
| candidate reviewed | `v3_candidate_reviewed` | each choose/replace/exclude/unknown/manual change |
| draft created | `v3_draft_created` | image draft confirmation; Describe/Import/Blank create |
| saved / exported | `v3_build_saved` (`first_save`), `v3_build_save_conflict`, `v3_report_exported` (`markdown_copy` / `markdown_file` / `json_file`) | Studio save; shopping-plan Copy, Markdown and JSON. A failed clipboard copy is not counted. |
| shopping intent (only when evidenced) | `v3_shopping_link_opened` (`slot`, `link_kind`) | an actual click on an official or search link |

- `src/lib/v3/funnel-analytics.test.ts`: 4 tests. They cover occupancy counts (unresolved is never complete), fixture flag and count-only analysis summary, no manual notes in review events, and all steps sent through the endpoint with one `session_id` and no free text. Each sent event also passes the server normalizer.

## Verification

- Gate: lint 0, typecheck passed, **153 tests in 21 files** passed, build passed.
- Browser (`http://127.0.0.1:5175/`): Import of "Intel Core i7-14700K" plus "Some mystery 1000W PSU" → Create reviewed draft → Save build. Captured `v3_draft_created` and `v3_build_saved` (`source: import`, `selected_count: 1`, `unresolved_count: 1`, `complete: false`, `first_save: true`, same `session_id`), and both `POST /api/analytics/events` returned 202. Neither event contained the pasted text. Copy report was blocked by the pane's clipboard policy, so no export event was sent (intended).
- Not checked in the browser: image submit/analysis/review events (needs a file upload in the pane), file downloads and link clicks. These are covered by the unit tests only.

## Limitations

- Events go to the server log only. There is no analytics store or dashboard yet, so funnel rates must be computed from logs.
- The legacy routes' `shopping_plan_*` and `affiliate_link_opened` events are unchanged. v3 events use their own `v3_` names, so the two funnels don't mix.
