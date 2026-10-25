# AIPC (AI PC Build Advisor) — v3 rebuild

Local rebuild of `CarlShi6/ai-pc-build-advisor` on branch `rebuild/image-to-build-v3`.
The flagship journey is: reference PC photo → AI observations → catalog candidates → user confirmation → editable Build draft → 3D/2D Build Studio → compatibility-aware substitutions → save, export and shopping plan.

## Source of truth

- `docs/product/AIPC_Engineering_PRD_v3.0_Image_to_Build_Rebuild.md`: product and engineering requirements (R0–R8 batches, §25 Definition of Done).
- `docs/product/AIPC_v3.0_Rebuild_Kickoff_Prompt.md`: safety rules and working method.
- `docs/PRODUCT_PRD_2026_CN.md` is earlier product thinking. Where its priorities conflict with the v3 PRD, the v3 PRD wins (local AI workstation work is P1, after the flagship flow).
- `docs/SKILL.md` and `docs/MILESTONE_*.md` describe the pre-v3 app. They are history, not current requirements.

Read these before starting work. They record where the rebuild stands:
`docs/engineering/BASELINE_AUDIT_v3.md`, `ARCHITECTURE_v3.md`, `REUSE_DECISIONS.md`, and `docs/milestones/R0_AUDIT.md`, `R0_R4_PROGRESS.md`, `R5_PROGRESS.md`, `R6_PROGRESS.md`.

## Non-negotiable rules

- Local only. Do not push, merge, deploy, force-push or rewrite history. No `git reset --hard`, `git clean -fd`, or destructive database or schema operations.
- Never discard uncommitted or untracked work. Check `git status` before changing code.
- One authoritative Build state (`BuildDocumentV3`). 2D, 3D, shopping plan and exports derive from it. Never treat a model response or the 3D scene graph as part-selection state.
- Every Build change goes through a proposal → preview → explicit confirm path (`src/lib/v3/build-proposal.ts`), which rejects stale revisions.
- Image AI produces observations, not identities. Hidden parts (CPU, PSU, storage, memory) stay unknown. Visual similarity never makes a part "verified".
- Keep these separate: occupancy (`selected` / `unselected` / `unresolved`), validation (`pass` / `warning` / `fail` / `not_checked`), identity provenance, price provenance and geometry accuracy. An incomplete build never reports an overall pass.
- Unknown is never zero. Unknown prices are `null`; tax and shipping are unknown, not $0. Seed catalog prices are labeled as seed prices, not live quotes.
- 3D geometry is illustrative and never proves physical fit.
- Manual and 2D flows must keep working without AI or WebGL.
- Do not invent product identities, specs or prices. For example, the catalog has no fan products; add them only from verified sources.
- Secrets stay server-only. Never use a `VITE_` prefix for keys.
- Real image AI is intentionally not connected yet (deferred until deployment). Use the dev fixture on the Image page. Do not claim the live provider path is verified.
- Never report a planned or mocked capability as implemented.

## Commands (Windows PowerShell 5: no `&&`)

```powershell
npm.cmd run lint; if ($?) { npm.cmd run typecheck }; if ($?) { npm.cmd test }; if ($?) { npm.cmd run build }
```

- Dev server: `npm.cmd run dev`. Earlier sessions ran it at `http://127.0.0.1:5175/`.
- If Vitest fails with `EPERM` renaming files in the system temp folder, set a writable temp first: `$env:TEMP="$PWD\.audit-tmp"; $env:TMP="$PWD\.audit-tmp"`. Don't commit `.audit-tmp`.
- Build warnings about chunks over 500 kB, ignored `"use client"` directives and Wrangler `main`/`assets` overrides already existed. They are not failures.
- Last known gate (end of R6 slice 2): lint 0, typecheck passed, 144 tests in 20 files passed, build passed.

## Stack and conventions

- TanStack Start, React 19, TypeScript, Vite 7, Tailwind 4 plus hand-written `v3-*` CSS in `src/styles.css`, Vitest, Three.js / React Three Fiber, Zod, Supabase, OpenAI SDK.
- File-based routes live in `src/routes/` (see `src/routes/README.md`). Do not edit `src/routeTree.gen.ts`.
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already adds the TanStack, React, Tailwind, tsconfig-paths and Nitro plugins. Do not add them again.
- Prettier (`printWidth` 100) is enforced through ESLint, and line endings are LF.

## Map of the v3 code

- Routes: `/` home (`index.tsx`), `/start/$mode` with Image, Describe, Import and Blank entries (`start.$mode.tsx`), `/studio` (`studio.tsx`), `/my-builds`. Legacy pages (`/legacy-workspace`, `/consult`, …) stay reachable during migration.
- Build domain: `src/lib/v3/build-document.ts` (BuildDocumentV3, slots, import matching, saved-draft envelope), `build-proposal.ts`, `draft-session.ts` (sessionStorage for the active tab).
- Image path: `image-input.ts`, `image-contract.ts`, `image-analysis.server.ts`, `image-client.ts`, `candidate-matcher.ts`, `appearance-catalog.ts`, `image-build.ts`, `dev-image-fixture.ts`. The UI is `src/components/image-candidate-review.tsx`.
- Studio: `src/features/build-3d/BuildScene.tsx`, `src/lib/v3/scene-presentation.ts`, `visual-optimization.ts`, `shopping-plan.ts` and `src/components/shopping-plan-panel.tsx`.
- Reused domain services: `src/lib/compatibility.ts` (rules), `product-trust.ts` (recalculation and trust labels), `build-advisor.ts`, `src/lib/persistence/*` (mock and Supabase stores), `src/lib/api-router.ts` (HTTP endpoints), `src/data/seedParts.ts` (catalog).

## Gotchas

- Both persistence stores rebuild a saved Build from its parts using `build-advisor.recalculateBuild`. That drops extra fields and regenerates the name. The v3 envelope survives through `src/lib/persistence/draft-envelope.ts`, and My Builds restores the saved name.
- Mock persistence is in memory, so a dev-server hot reload of persistence modules clears saved builds.
- On a freshly loaded page, the first click can be lost before hydration finishes (seen in R6). This is an open R7 item.
- When a slot is missing, compatibility rules return results that mean "not enough data". The shopping plan treats rules whose required category is absent as `notChecked`, not as warnings.

## Working method

For each batch: inspect → plan → implement → test → run the full gate → verify in the browser → record results in `docs/milestones/R*_PROGRESS.md`. Report files changed, what was verified, limitations and the next step.

## Current status and next steps (R6 Integration, Trust & Save/Export)

Done: R0–R5 (image path verified with the local fixture only); R6 slice 1 (v3 draft save and restore); R6 slice 2 (Studio shopping plan with Markdown and JSON report).

Next, in order:
1. Revision check on save, so a stale tab cannot overwrite a newer save.
2. v3 funnel analytics events: image submitted → candidate reviewed → draft created → saved/exported.
3. Per-session rate limit for image analysis (the current limit is process-wide) and a retention note on the Image page.
4. "Preserve the Look" and "Balanced" optimization intents. Today only reduce-cost and improve-performance exist (PRD §10.1).
5. Describe entry: reuse the existing `build-advisor` recommendation logic instead of leaving all part choices to the user.
6. R7: Focus/Isolate mode, reduced motion and keyboard support, Playwright end-to-end tests, the PRD §19.3 fixture set, and an 8–12 person user study.
