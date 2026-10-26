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

# R6 slice 5: hand-curated case fans for style matching — 2026-10-25

Closes the R4 fan-coverage gap for UC-01 (white or black show builds) without third-party data. BuildCores OpenDB was rejected (see `docs/engineering/REUSE_DECISIONS.md`).

## Data

`src/data/curatedFans.ts`: **14 lit case fans** from 5 manufacturers, white and black, 120 and 140 mm. Every value was read on 2026-10-25 from the manufacturer's own product page, linked per entry (`sourceUrl`, `verifiedAt`). No prices. No values were taken from search snippets or third-party sites.

| Manufacturer | Entries (part number) | Page |
|---|---|---|
| Lian Li | UNI FAN SL-INF 120 White/Black single (UF-SLIN120-1W / -1B), SL-INF 140 White/Black single (UF-SLIN140-1W / -1B) | lian-li.com/product/uni-fan-sl-infinity/ |
| Corsair | iCUE LINK RX120 RGB White/Black single (CO-9051021-WW / CO-9051017-WW) | corsair.com product pages |
| NZXT | F120 RGB Core White/Black (RF-C12SF-W1 / -B1) | nzxt.com/products/f120-core-rgb-1 |
| ARCTIC | P12 PWM PST A-RGB White/Black single (ACFAN00254A / ACFAN00231A) | arctic.de product pages |
| be quiet! | Light Wings 120mm PWM White/Black 3-pack (BL100 / BL076), 140mm PWM White/Black 3-pack (BL102 / BL078) | bequiet.com/en/casefans/4132, 3452, 4133, 3453 |

Fields: size, dimensions exactly as published, thickness (mm), color, lighting type and connector, fan connector, fans per package, max rpm, max airflow (CFM), max noise (dB(A)), and stated requirements. **Left unknown (`null`) on purpose:**
- Corsair max airflow: the same page lists both 74.2 and 73.5 CFM. Static pressure and weight ("0kg") are inconsistent too, so they aren't recorded.
- ARCTIC noise in dB(A): the page gives only 0.3 sone.
- NZXT fans per package: not stated on the page.
- Weights in general are not recorded (be quiet!'s "weight incl. fixed cables" doesn't say whether it's per fan or per pack).

Stated requirements are kept as notes. Corsair needs an iCUE LINK System Hub. NZXT lighting uses a 4-pin NZXT RGB connector and needs an NZXT RGB lighting connector.

## Code

- `src/lib/v3/appearance-catalog.ts`: `AppearanceProfile` no longer wraps a `Part`. Seed parts and curated fans both become profiles with their own `catalogSourceId` (`seedParts:` / `curatedFans:`), provenance (`local_seed_catalog` / `manufacturer_page`), `sourceUrl` and `verifiedAt`. Fans are **not** `Part`s: `Part.price` is required and fans would otherwise need a fake $0, and fans aren't one of the eight Build slots.
- `src/lib/v3/candidate-matcher.ts`: a lighting signal (lit, RGB, ARGB, LED…; "unlit" or "no lighting" don't match). A photo can't tell RGB from ARGB, so any lit catalog fan matches. Candidates carry `catalogSourceUrl` and `catalogVerifiedAt`. The fan explanation says a photo can't tell these models apart and that a chosen fan stays a style note with no Build total.
- `src/components/image-candidate-review.tsx`: fan cards show "manufacturer page", a "Specs from manufacturer page" link with the verification date, and "Not a Build slot; no compatibility check".
- `image-build.ts` is unchanged. Fans were already skipped when building slots, so a chosen fan is kept only in the photo review and never changes parts, price or compatibility.

## Verification

- Tests: `src/data/curatedFans.test.ts` (5) covers manufacturer-domain URL and date on every entry, unique IDs and part numbers, sizes match the published dimensions, no price field, conflicting values stay null, white/black × 120/140 coverage, a white lit photo matches white fans only as appearance-only candidates with source links, and unlit fans don't match. `candidate-matcher.test.ts` was updated (fans now have coverage, and the source link and "not a Build slot" text render).
- Gate: lint 0, typecheck passed, **158 tests in 22 files** passed, build passed.
- Browser: the `og.png` local fixture path still renders case and GPU candidates with "Local Catalog" sources. **Fan cards were not checked in the browser**, because the fixture contains no fan observation and adding one would invent image content. The server-rendered review test covers them until a real image provider is connected.

## Limitations

- 14 entries is a style-matching sample, not broad coverage. Manufacturer pages change, so `verifiedAt` marks when each value was last true.
- Fans don't enter the Build, the shopping plan or compatibility rules. Showing a chosen fan in Studio is not built.

# R6 slice 6: per-session image analysis limit and retention note — 2026-10-25

## Implemented

- `src/lib/v3/image-rate-limit.server.ts`: `ImageSessionLimiter`, an in-memory sliding window, **3 analyses per minute and 15 per 24 hours per session**. It is checked before the existing process-wide cap (12/min in `image-analysis.server.ts`, kept as a global cost guard).
  - Session key: signed-in user → this browser's `aipc_image_session` cookie (random UUID, HttpOnly, SameSite=Lax, path `/api/image-analyses`, 1 day) → `cf-connecting-ip` / `x-forwarded-for` → one shared bucket. A browser without the cookie gets one on its first response.
  - Over the limit: `429 { error: { code: "SESSION_RATE_LIMITED" } }` with `Retry-After`. The provider is not called. The message tells the user roughly how long to wait and that they can continue manually.
  - Requests that never reach the provider give their slot back: `IMAGE_AI_NOT_CONFIGURED`, and `RATE_LIMITED` from the global cap. A provider-side 429 shares the `RATE_LIMITED` code, so it is also given back.
  - Tracked keys are capped at 10,000, oldest dropped first.
- `src/lib/api-router.ts`: `/api/image-analyses` resolves the key, reserves, calls the analyzer and returns errors with the cookie and `Retry-After` headers. The limiter can be injected for tests.
- `src/routes/start.$mode.tsx`: a **Retention** note on the Image page. It says AIPC never stores the photo, the resized copy or the file name; the copy is sent with OpenAI response storage off (`store: false`) and OpenAI's own policies still apply; only the text findings stay in the tab's draft and are kept with the build if saved; and it states the per-session limits. Each claim was checked against the code: the client sends only the resized blob, the server never reads a file name, and the draft keeps `imageStored: false`.
- Reuse decision recorded in `docs/engineering/REUSE_DECISIONS.md`: no rate-limit library now; a platform binding or shared store at deployment.

## Verification

- `src/lib/v3/image-rate-limit.test.ts` (5 tests) covers: 3/min and 15/day windows with a fake clock and per-session isolation; `Retry-After` of 60 s; release happens exactly once; key priority (user > cookie > IP > shared) and a malformed cookie being ignored; over HTTP, the 4th request in a minute gets 429 `SESSION_RATE_LIMITED` with `Retry-After: 60` and the analyzer runs only 3 times; and unconfigured-provider requests set the cookie but don't use the allowance.
- Gate: lint 0, typecheck passed, **163 tests in 23 files** passed, build passed.
- Browser (`http://127.0.0.1:5175/start/image`, no provider configured): the Retention note renders. Four Analyze clicks in a row all returned 503 "not configured", none 429, so unconfigured requests aren't counted. The live 429 path is verified by tests only (no provider credentials here).

## Limitations

- In-memory and per process or isolate: restarts reset it, and on serverless each isolate counts separately. It also doesn't stop a client that drops cookies and rotates IPs. The global cap still bounds total cost. A durable limit is a deployment task.
- The shared fallback bucket (no cookie, no IP header) mostly applies to local or test traffic.

# R6 slice 7: exit-review gaps closed — 2026-10-25

Closes the three small gaps from `R6_EXIT_REVIEW.md`.

1. **Delete in v3 My Builds** (`src/routes/my-builds.tsx`, CSS). A two-step confirm ("Deletes this build, its parts list and any saved photo findings. This can't be undone.") calls the existing `DELETE /api/builds/:id`. If the active tab's draft pointed at the deleted save, its `savedBuildId`/`savedVersion` are cleared, so the next save creates a new build instead of silently recreating the old ID. Browser: blank build saved → My Builds → Delete → Delete permanently → "Deleted “Untitled build”", empty list, draft link cleared. The Supabase store also deletes the build's feedback rows. Whether `owned_parts` rows cascade depends on the schema's foreign key and is unverified here.
2. **Look lock survives save** (`build-document-save.test.ts`). An image draft with two visual priorities, one locked, plus an unresolved GPU round-trips through the store: lock states, values, unresolved note, unselected PSU and revision are all kept.
3. **Local deliverable and rollback** (`docs/engineering/LOCAL_DELIVERABLE_AND_ROLLBACK.md`). Covers running locally, data compatibility (the JSONB envelope, no SQL migration, pre-v3 pages ignore the envelope and drop it on re-save), and rollback steps without history rewrites: use legacy pages, `git revert` one slice, run the pre-v3 branch in a separate worktree, or a separately approved data cleanup.

Gate: lint 0, typecheck passed, **164 tests in 23 files** passed, build passed.
