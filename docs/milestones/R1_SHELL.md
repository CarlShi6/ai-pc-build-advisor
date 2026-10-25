# R1 — Inspiration-first shell and entry paths

Status: implemented locally on `rebuild/image-to-build-v3` (2026-10-25). This is the first runnable vertical slice after R0, not completion of the v3 product.

## Delivered

- `/` is a new responsive inspiration-first home with four entry paths and clear early-access language. The prior visual decision workspace remains at `/legacy-workspace`; `/consult`, `/build`, `/compare`, `/cart` and checkout routes remain.
- `/start/image` accepts JPEG/PNG/WebP up to 10 MB, checks file signatures, previews locally, and lets the user continue into an empty manual draft. It explicitly says image analysis and storage are not connected. No photo data enters Build state or the server.
- `/start/describe` records a goal, description and budget in an editable draft. It does not invent part recommendations or claim AI interpretation.
- `/start/import` previews exact seed-catalog matches and keeps original text. Unknown or duplicate-category lines are not silently selected. The user confirms before the draft is created.
- `/start/blank` opens an eight-slot draft with no selected parts.
- `/studio` is a 2D workspace using one session-scoped `BuildDocumentV3`; it shows selected/unselected/unresolved slot states, source-aware incomplete status, part selection preview, explicit confirmation, removal, seed-price disclosure and compatibility findings. Preview does not mutate the active draft.
- `/my-builds` loads existing saved Builds through the current API and adapts them for the Studio without rewriting stored rows. New v3 draft saving remains for R6; the UI states that current drafts stay in the browser tab.

## Contract choices

`src/lib/v3/build-document.ts` is a migration bridge. The existing `Build` remains the only selected-part authority; slot status is derived from it plus explicit unresolved import claims. `revision` increments on local selection/removal, but server-enforced expected-revision commits and durable decision history are R2/R6 work. `src/lib/v3/draft-session.ts` carries this document across the new routes in `sessionStorage`. The uploaded image itself is not stored in the draft.

## Verification

- `npm run typecheck`: pass.
- `npm test -- --reporter=dot` with `TEMP`/`TMP` pointed at the workspace: 14 files, 110 tests passed. Four new tests cover blank-draft nonmutation, legacy identity preservation, exact import matching, and duplicate-slot ambiguity.
- `npm run build`: passed after final edits; client, SSR and Nitro bundles generated.
- Scoped ESLint of new TS/TSX and moved legacy route with the existing `prettier/prettier` rule disabled: pass. Full-repository lint remains blocked by the R0 line-ending baseline.
- Browser click-through at `http://127.0.0.1:5174/` confirmed home navigation, blank draft, exact-match import review, unknown-part retention and the shared Studio. The earlier sandboxed server timeout was resolved by running the local dev server directly. R2's separate 3D interactions are recorded in `R2_STUDIO_3D.md`.

## R2 handoff

R2 adds local proposal/confirm guards and a lazy client-only scene against this same document. Durable expected-revision commits, decision history, normalized storage and save/load round-trip fixtures remain for R6 before changing persistence writes.
