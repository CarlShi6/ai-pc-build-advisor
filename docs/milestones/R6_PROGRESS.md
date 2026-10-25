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

1. Export or report for an incomplete draft, showing unresolved and unknown states (not `pass`).
2. Price and source disclosures plus shopping links from the Studio for selected slots only.
3. Revision check on save (reject a stale tab overwriting a newer save), then privacy deletion.
