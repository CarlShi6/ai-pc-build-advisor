# R6 exit review against PRD §20 (R6) and §25 — 2026-10-25

Branch `rebuild/image-to-build-v3` at `98df876` (R6 slice 6). Evidence is code, tests (163 in 23 files, full gate passing) and browser checks recorded in `R0_R4_PROGRESS.md`, `R5_PROGRESS.md` and `R6_PROGRESS.md`. Status key: **Met**, **Partial** (works, but evidence or scope is short of the item), **Open** (not built), **Deferred** (postponed by an explicit decision).

## R6 batch (PRD §20)

| R6 task | Status | Evidence / gap |
|---|---|---|
| Stabilize source provenance | Met | Seed prices labeled as seed (shopping plan). Fans carry manufacturer URL and verification date (slice 5). Photo evidence, catalog source ID and identity basis stay separate (R4/R5). |
| Compatibility review | Partial | Absent categories report `notChecked`, and an incomplete build never shows pass (slice 2). §12.1 asks for versioned findings (rule ID, version, evidence, missing inputs, next action); `CompatibilityWarning` has only `id`, severity, message, affected parts and suggested fix. |
| Saved Build migration | Met (mock) | v3 envelope inside the existing JSONB, legacy rows read as `legacy` (slice 1). Revision check on save (slice 3). The Supabase path is untested against a real project. |
| Report / export | Met | Copy Markdown, Markdown file and JSON with unknowns and disclosures (slice 2). CSV (named in §12.4) is not offered. |
| Shopping links | Met | Official page or retailer search links for selected slots only, labeled as references (slice 2). Click tracked as shopping intent (slice 4). |
| Analytics events | Met | Nine `v3_` funnel events, counts and enums only (slice 4). Logs only, no store or dashboard. |
| Privacy and deletion controls | Partial | Metadata stripped, photo never stored, retention note, per-session and global limits (R3, slice 6). **v3 My Builds has no Delete action**: the API and store support it, but only legacy `/consult` exposes it. That is the only way to remove saved photo findings. Limits are in-memory (durable limits are a deployment task). |
| **Exit:** an image-first user can finish a clear, decision-ready workflow with accessible fallback | Partial | Image (fixture) → review → draft → Studio → replace → save → export works in the browser, and manual or 2D paths work without AI or WebGL. Not met: a real provider run (**Deferred**, CLAUDE.md), and accessibility (keyboard, reduced motion, mobile), which is an R7 item. |

## §25 Definition of Done

### Build and AI

| Item | Status | Evidence / gap |
|---|---|---|
| Four entry paths function | Partial | Image, Describe, Import and Blank all reach an editable draft. Describe doesn't recommend parts yet; EP-06's "requirements wizard" is P0 (CLAUDE.md next step 2). |
| Image preflight/upload states with privacy controls | Met | R3 states and limits; retention note (slice 6). |
| Observations mark visible vs unknown on curated fixtures | Partial | Schema enforces origin and unknown hidden parts (R3 tests). Only one dev fixture (`og.png`); the PRD §19.3 fixture set is R7. |
| Candidate list: select, alternatives, keep unresolved | Met | R4, plus fan candidates (slice 5). |
| Reviewed candidates become a Build only after confirmation | Met | R5 proposal → confirm; stale proposals rejected. |
| Saved image-born Builds keep visual priorities and unknowns | Met (code), Partial (test) | `readImageContext` keeps `visualPriorities`, and unresolved notes round-trip (slice 1 test). The save test uses an empty priority list; a locked, non-empty case is untested. |
| No identity silently verified from visual similarity | Met | All candidates are `appearance_only` or `visible_marking`, never verified (R4/slice 5 tests). |
| Replace preview and confirm use safe domain transactions | Met | `build-proposal.ts` with revision checks; save-level revision check (slice 3). Commits are client-side; there's no server confirm endpoint. |
| Compatibility, price and performance disclosures grounded | Met | Shopping-plan and optimization-preview disclosures (R5/slice 2). |

### 3D

| Item | Status | Evidence / gap |
|---|---|---|
| Rotatable / zoomable scene | Met | R2 browser check. |
| Eight anchors and dashed connectors | Met | R2. |
| Selected / unselected / unresolved shown separately | Met | R2/R5. |
| Standard, Exploded, Review **and Focus/Isolate** | Partial | First three work. **Focus/Isolate is Open** (R7 list). |
| Replace in 3D updates 2D and revision identically | Met | Scene click selects the slot, and the shared proposal path updates both (R2/R5 browser checks). |
| Falls back to 2D without data loss | Met | R2 fallback check. |
| Geometry labeled; no physical-fit claim | Met | "Illustrative layout" copy. |
| Reduced motion, keyboard and mobile interaction | Open | No `prefers-reduced-motion` handling or keyboard scene navigation; mobile not tested. R7. |

### Engineering / deployment

| Item | Status | Evidence / gap |
|---|---|---|
| R0 audit and reuse plan | Met | `BASELINE_AUDIT_v3.md`, `REUSE_DECISIONS.md`. |
| Baseline and new tests pass | Met | 163/163, lint 0, typecheck, build. |
| Privacy, retention, deletion, cost/abuse controls **verified** | Partial | Notice and limits exist. Deletion UI is missing in v3; durable limits and provider-side retention are verified only at deployment. |
| No external asset used outside its license | Met | No third-party meshes or images added. OpenDB rejected on license. Fan data is facts with source links. |
| E2E image-to-Build and failure/manual fallback run | Partial | Manual browser runs with the fixture and the missing-key fallback. **No automated E2E** (Playwright is R7). |
| V1 flows measured in a small user study | Open | R7. |
| Build/report usable without AI and WebGL | Met | 2D view and shopping plan work with the provider off and WebGL off. |
| No live-price or physical-fit claims without evidence | Met | Seed-price labels and fit caveats. |
| Local deliverable and rollback instructions recorded | Open | No v3 run/rollback note. Only `ARCHITECTURE_v3.md` mentions rollback in general terms. |
| No push, merge or deployment without approval | Met | All commits local. |

## Verdict

**R6 exit: substantially met for a fixture-backed local build, with three small R6 gaps:**

1. A Delete action in v3 My Builds (privacy and deletion).
2. A saved-build test with locked, non-empty visual priorities.
3. A local deliverable and rollback note.

Optional within R6 scope: versioned rule findings (§12.1) and CSV export.

**Not R6, but P0 before release** (already CLAUDE.md next steps 1–2):
- EP-05 "Preserve the Look" and "Balanced" intents. The PRD marks them P0 core, with acceptance criteria such as "Keep the white case never selects a black case without explicit override".
- EP-06 Describe requirements wizard or recommendation.

**R7 scope** (open §25 items): Focus/Isolate, reduced motion, keyboard and mobile, Playwright E2E (the §19.3 list), curated fixture set, performance profile, and the 8–12 person study.

**Deferred by decision:** a live image provider run (CLAUDE.md: deferred until deployment).

## Follow-up (2026-10-25, R6 slice 7)

The three small R6 gaps are closed: Delete in v3 My Builds, a locked visual priority round-trip test, and `docs/engineering/LOCAL_DELIVERABLE_AND_ROLLBACK.md`. Versioned rule findings and CSV export stay optional.

## Recommended order

1. Close the three small R6 gaps (one short slice).
2. EP-05 Preserve the Look / Balanced, then EP-06 Describe recommendation. Both are P0, and R7's E2E and user study should test them.
3. R7: Playwright E2E for the §19.3 flows first (it guards everything after), then Focus/Isolate plus accessibility, the fixture set, performance, then the user study.

Entering R7 before step 2 is possible, but the E2E suite and user study would then cover an incomplete P0 feature set and need redoing.
