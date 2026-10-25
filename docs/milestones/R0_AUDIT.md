# R0 audit and v3 execution plan

Status: complete locally on `rebuild/image-to-build-v3` (2026-10-25). Source of truth for intent: supplied v3 PRD. Observed baseline and risks: `docs/engineering/BASELINE_AUDIT_v3.md`. File-level choices: `docs/engineering/REUSE_DECISIONS.md`.

## R0 exit evidence

- Existing worktree was clean at start; origin and branch verified; a new local branch was created without rewriting history.
- Baseline: 106/106 tests pass with writable temporary directory; typecheck passes; production build passes; lint fails on existing line-ending-heavy findings. The first test run failed before tests executed because the system temp path denied rename.
- Domain, route, catalog, AI, persistence, pricing and schema paths were inventoried. No current 3D or image-analysis implementation was found.
- No frontend deletion, remote write, deployment, database operation or production-data migration was performed.

## R1–R7 bounded slices

| Batch | Smallest runnable slice and exit check | Dependency / main risk |
|---|---|
| R1 — shell and entry | New responsive home/navigation with working Image (local preflight/preview), Describe, Import and Blank screens; legacy `/consult` and save access retained. A blank draft opens a 2D Studio shell. No fake AI success. | First define a versioned Build adapter and route handoff. Route-local state in `index.tsx` and `consult.tsx` may otherwise diverge. |
| R2 — shared Build + 3D skeleton | Fixed draft renders all eight 2D slots and client-only representative 3D anchors with dashed callouts, including empty/unresolved slots. Standard/Exploded/Review; preview and confirm one GPU replacement updates both views once. | Requires a proposal/expected-revision contract, explicit completeness, and a rendering-library compatibility check. Asset and WebGL failures must leave 2D working. |
| R3 — image observations | One curated uploaded image passes file/security checks, private lifecycle handling and a server-validated observation schema; regions and uncertainty display, with manual fallback. | Depends on privacy/storage decisions and server rate limits. No hidden part identities. Can proceed alongside R2 once Build contracts settle. |
| R4 — candidates | Curated appearance catalog returns bounded case/fan/GPU options; user confirms, rejects or leaves unresolved; catalog IDs and evidence remain distinct. | Depends on R3 observation schema and catalog identity rules; seed breadth is limited. |
| R5 — photo draft and goals | Reviewed observations produce a partial Build; user can lock look traits and preview/confirm one budget/performance substitution through shared rules; shopping summary updates. | Requires R2 state transaction and R4 review outcomes. Incomplete draft must remain valid. |
| R6 — trust and persistence | Versioned legacy/v3 save round-trip, uncertain export/report, price/source disclosures, privacy deletion, shopping links and independent failure fallbacks. | Current JSONB save has no revision field; migration fixtures and atomic commit design are critical. |
| R7 — local validation | Full checks, browser keyboard/mobile/scene fallback runs, representative image fixtures, performance measurements and limited user evaluation. Record evidence against PRD release criteria. | Existing lint baseline needs scoped normalization before it can gate release; validate a reference device before setting FPS threshold. |

## Next implementation slice

Begin R1 with the BuildDocumentV3 reader/adapter and a minimal shared draft handoff, then add an inspiration-first shell and four genuine entry screens. The Image screen can perform safe local preflight and clearly label analysis as unavailable until R3. A user starting Blank or Describe must reach an editable 2D draft without WebGL or AI. Keep existing routes accessible and verify save/load of a legacy fixture before moving route ownership.

Stop point: R0 is documentation and planning only, per the kickoff's first-run boundary.
