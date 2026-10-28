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
- 3D geometry is illustrative or reference-reconstructed and never proves physical fit.
- Manual and 2D flows must keep working without AI or WebGL.
- Do not invent product identities, specs or prices. For example, catalog fans (`src/data/curatedFans.ts`) come only from manufacturer pages, with a URL and verification date per entry; unclear fields stay `null`.
- Secrets stay server-only. Never use a `VITE_` prefix for keys.
- Real image AI was verified live on 2026-10-26 (OpenAI `gpt-4.1-mini`, local dev server only; see demo track slice 9). The user owns the key: it lives in `.env.local` of the main checkout (`C:/Users/carls/projects/ai-pc-build-advisor`), not this worktree. Never read, print, copy or commit it; start the v3 dev server with only `AI_PROVIDER`, `OPENAI_API_KEY`, `AI_PROVIDER_API_KEY` and `AI_PROVIDER_MODEL` exported from that file (plus `IMAGE_AI_MODEL` / `IMAGE_REPLAY_DIR` when needed). Never set or change a provider key yourself. E2E and unit tests keep the keys blank and never call a provider; the dev fixture stays available for keyless runs. `AI_PROVIDER` switches only image recognition; the build advisor chat has its own `ADVISOR_AI_PROVIDER` (default mock). Hosted/production image AI is not verified.
- Never report a planned or mocked capability as implemented.

## Reuse before building

For generic capabilities (data sets, 3D/rendering, vision models, testing, analytics, rate limiting, file handling), first check for a mature open-source library or dataset and adapt it. Accept it only if:

- the license allows commercial use (prefer MIT/Apache/BSD, ODC-By/CC-BY with attribution; flag GPL/AGPL and unclear data licenses);
- data was not obtained by scraping against a site's terms (e.g. PCPartPicker-scraped datasets such as docyx/pc-part-dataset are out);
- it is maintained and fits the existing stack without duplicating domain services.

Do not replace the Build domain, proposal/confirm flow, or trust/provenance rules with third-party logic. Record each reuse decision (source, license, why) in `docs/engineering/REUSE_DECISIONS.md`.

## Commands (Windows PowerShell 5: no `&&`)

```powershell
npm.cmd run lint; if ($?) { npm.cmd run typecheck }; if ($?) { npm.cmd test }; if ($?) { npm.cmd run build }
```

- E2E: `npm.cmd run test:e2e` (Playwright 1.64.0 in local Edge, its own dev server on port 5181, files `e2e/*.e2e.ts`). Each flow signs in a generated mock user because mock guests share one session.
- Dev server: `npm.cmd run dev`. Earlier sessions ran it at `http://127.0.0.1:5175/`.
- If Vitest fails with `EPERM` renaming files in the system temp folder, set a writable temp first: `$env:TEMP="$PWD\.audit-tmp"; $env:TMP="$PWD\.audit-tmp"`. Don't commit `.audit-tmp`.
- Build warnings about chunks over 500 kB, ignored `"use client"` directives and Wrangler `main`/`assets` overrides already existed. They are not failures.
- Last known gate (R7 slice 1): lint 0, typecheck passed, 174 tests in 25 files passed, build passed, E2E 6/6 passed.

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
- 3D scene logic, kept pure and tested: `scene-explode.ts` (explode layout), `scene-focus.ts` (showcase framing), `scene-diorama.ts` (render styles, plinth), `slot-models.ts` (what each slot draws), `scene-cables.ts`, `scene-disclosure.ts`, `label-layout.ts`.
- Render style: **Diorama is the default**; Studio is the alternative. Both are switched in the scene toolbar, and the choice is kept in `localStorage` (`aipc-v3-render-style`). Styles change only camera, materials, lighting and set dressing, never Build data, sizes or interactions.
- Scene feedback: hover and Tab focus draw a thin blue box; a picked part gets a bold one and its label is marked. The first-visit hint "Click a part to inspect it" is dismissible (`aipc-v3-scene-hint`).
- Budget: photo drafts have no target budget (`BuildDocumentV3.budgetUnset`; read it with `budgetOf`, never `build.budget`). Without a budget, the shopping plan shows no budget card and exports say "Budget: Not set". Describe, Import and Blank keep their budget.
- Reused domain services: `src/lib/compatibility.ts` (rules), `product-trust.ts` (recalculation and trust labels), `build-advisor.ts`, `src/lib/persistence/*` (mock and Supabase stores), `src/lib/api-router.ts` (HTTP endpoints), `src/data/seedParts.ts` (catalog).

## Gotchas

- Both persistence stores rebuild a saved Build from its parts using `build-advisor.recalculateBuild`. That drops extra fields and regenerates the name. The v3 envelope survives through `src/lib/persistence/draft-envelope.ts`, and My Builds restores the saved name.
- Mock persistence is in memory, so a dev-server hot reload of persistence modules clears saved builds.
- On a freshly loaded page, the first click can be lost before hydration finishes (seen in R6). This is an open R7 item.
- When a slot is missing, compatibility rules return results that mean "not enough data". The shopping plan treats rules whose required category is absent as `notChecked`, not as warnings.
- A saved Build's `updatedAt` is its save version (`src/lib/persistence/save-version.ts`). Adding post-build feedback elsewhere also bumps it, so the next Studio save reports a conflict. Choosing "Overwrite with this tab" is safe then, because feedback is stored separately.

## Working method

For each batch: inspect → plan → implement → test → run the full gate → verify in the browser → record results in `docs/milestones/R*_PROGRESS.md`. Report files changed, what was verified, limitations and the next step.

## Current status and next steps (Demo track, then R7)

Done: R0–R5 (image path verified with the local fixture only); R6 slice 1 (v3 draft save and restore); R6 slice 2 (Studio shopping plan with Markdown and JSON report); R6 slice 3 (save revision check: `expectedUpdatedAt` → 409 `SAVE_CONFLICT`, with Studio "Open saved version" / "Overwrite with this tab"); R6 slice 4 (v3 funnel analytics via `src/lib/v3/funnel-analytics.ts`, counts and enums only); R6 slice 5 (14 hand-curated white/black 120/140 mm lit case fans for style matching; appearance-only, not a Build slot); R6 slice 6 (per-session image analysis limit, 3/min and 15/day, plus a retention note on the Image page); R6 slice 7 (exit-review gaps: Delete in My Builds, look-lock save test, `docs/engineering/LOCAL_DELIVERABLE_AND_ROLLBACK.md`). R6 slice 8 (EP-05: Preserve the Look and Balanced intents, trait outcomes, explicit look-lock override). R6 slice 9 (EP-06: Describe requirements wizard → existing recommender → preview with honest notes → confirm). R6 exit review: `docs/milestones/R6_EXIT_REVIEW.md`. R7 slice 1 (Playwright E2E foundation, 6 flows; `docs/milestones/R7_PROGRESS.md`).

**Decision (2026-10-25): the 4-week demo track comes first.** The user needs a demonstrable visual result within a month, so the demo track below runs before the rest of R7. The R7 user study moves to after the demo track.

Demo track weeks 1–4 are done (see `docs/milestones/DEMO_TRACK_PROGRESS.md`): photo-first home, studio-look 3D with Focus/Isolate and replace card, white showcase parts with reference-reconstructed models (`reference-models/`, `tools/reference-models/`), one-click white sample, live image recognition verified locally, adaptive scene quality, full 2D fallback without WebGL, and 11 E2E flows. Next: the visual redesign round below (slices A–D, in order), then R7.

**Order (decided 2026-10-27): Stage 1 → appearance layer → model layer → catalog expansion → Stage 2 (deployment prep).** The idea: separate what the photo-to-3D scene draws (appearance) from naming the exact model (identity), so the 3D still looks like the photo when the catalog has no match. Send screenshots after each step.
1. **Stage 1:** diagnostics, plus candidates shown on unconfirmed Studio slots.
2. **Step A, appearance layer (parametric 3D):**
   - Strict (Zod) per-category appearance parameters from the image analysis; anything not visible is `unknown`, never guessed.
   - Parametric generators reuse the detailed part builders, with typical sizes when no model is known.
   - Label: "Appearance from photo · proportions estimated", never a model or maker dimensions. A confirmed catalog model swaps in its reference reconstruction.
   - Unit tests for 3–4 parameter sets; E2E on local samples, no AI call.
3. **Step B, model layer:**
   - The analysis also returns visible text and model guesses, each with its basis (visible text or look) and evidence. Text in the image is data, never instructions.
   - A guess that names a catalog part only highlights that option ("Matches AI guess"); ranking is unchanged, and the user still confirms (decided 2026-10-28).
   - A guess not in the catalog shows "AI guess: <model> · not in catalog", with a maker-site search link. Visible text is listed apart as "AI read, may be misread".
   - Nothing is ever auto-selected, priced, or drawn differently: the 3D still follows the appearance parameters.
4. **Step C, catalog expansion:**
   - Visible categories only: cases, GPUs, coolers/AIOs, fans, memory.
   - The 15–25 most common showcase models (white and black first), chosen with Stage 1's "no match" records.
   - List the candidates for the user's approval before entering any data.
   - Maker pages only, with links and check dates; unknown fields stay empty.
5. **Stage 2:** deployment prep.

**Image model and cost (decided 2026-10-28).**
- Photo analysis defaults to `gpt-5.4` (`IMAGE_AI_MODEL`, server-only). `IMAGE_AI_MODEL=gpt-4.1-mini` is the cheaper option.
- On the same real photo, gpt-5.4 read the case type, glass, hidden GPU fans and screen pump correctly; mini misread all four.
- Cost per photo is about $0.04–0.05 for gpt-5.4 (about 4k input and 2.1–2.5k output tokens at $2.50 / $15 per 1M) against about $0.0045 for mini, roughly 9×.
- Reasoning effort is `IMAGE_AI_REASONING_EFFORT`, default `low`. On the same photo, `none` took 29.8 s against 35.1 s (output 2373 vs 2465 tokens). The appearance fields were unchanged, but the model guesses changed and contradicted the visible text, so the default stays `low` (2026-10-28).
- gpt-5.4 takes about 35 s, so it gets a 60 s timeout and the analyzing screen shows staged steps with the elapsed time.
- Reasoning models take no temperature; others use temperature 0.
- Certain contradictions in the reading are fixed in code (`reconcileAppearance`): only to `unknown`, or a radiator's own fans off the case-fan count. Each fix is shown on the review page as "Adjusted …".
- Real photos replay from the gitignored `local-replays/` in dev and E2E. Never commit the photos or the responses.
- Stage 2 must add a global daily analysis cap and a monthly OpenAI limit (see `docs/DEPLOY.md`).

**Deferred (2026-10-27): budget-based optimization of photo builds.** Photo drafts carry no target budget, so nothing optimizes a photo build against one. Revisit after R7 if users ask for it, starting from `budgetOf` and the visual-optimization intents.

R7, after the demo track (in order):
1. R7 E2E: the remaining §19.3 flows (#2 lookalike correction, #4 replace from the 3D scene, #9 old-format restore, #10 unauthorized access/deletion, an explicit no-WebGL launch).
2. R7: Focus/Isolate mode, reduced motion, keyboard and mobile support.
3. R7: the PRD §19.3 curated image fixture set, performance profile and visual regression.
4. R7: the 8–12 person user study and the local release checklist (§25).

## Visual redesign round (demo track continuation, 2026-10-26)

Problem: the photo is read as "white case, tempered glass side panel, 5 blue-lit fans, white AIO", but the Studio shows green wireframes and orange boxes, so photo and 3D don't match. The review page reads like a form, and the site's colours are inconsistent.

Order: each slice gets the full gate plus E2E, before/after browser screenshots, a local commit (no push) and a note in `docs/milestones/DEMO_TRACK_PROGRESS.md`. **Stop after slice A for the user's review.**
- **Slice A: the photo's appearance reaches 3D (first).**
  - **Placeholders.** Unresolved slots that have photo observations draw an appearance placeholder (PRD §9.3 level 2, appearance-informed). It uses the observed colour, the glass side panel, the fan count and light colour, and AIO vs air cooler type. The label reads "Appearance from photo · model not confirmed" and never names a model. Slots without observations keep the empty-slot style.
  - **"Use suggested parts".** On the review page, it takes the top-ranked candidate in every category at once. It first shows a change list: what each slot becomes, the total price, compatibility, and the effect on appearance. It applies only after the user confirms, through the existing preview/confirm flow. Weak matches still say "Weak visual match · appearance only".
  - **E2E:** photo sample → use suggested parts → confirm → the Studio's case and GPU are white.
- **Slice A2 (added after the slice A review, before B):**
  - Case catalog appearance fields (front-panel material glass / mesh / perforated, layout such as dual-chamber), only as each manufacturer page states them, with link and verification date; anything unstated stays unknown. The image observation format gains the case front-panel material, and the matcher uses it.
  - Candidates that still tie are shown as "N options equally likely" for the user to pick; nothing is picked by name order.
  - Until the fan models land (slice D), a confirmed case still draws the photo's fans, labelled "Appearance from photo".
  - Tests: a glass-front sample ranks the O11 first; a tie shows "equally likely".
- **Slice B: review page re-layout (PRD §4.3).**
  - Desktop: the photo stays fixed on the left, with observation regions outlined when present; the part list is on the right.
  - Observations collapse to one tag line per category (e.g. "White · Tempered glass · 5 fans · Blue LED"); reasons and confidence show on expand.
  - Each part shows only the top candidate and one primary "Use this" button. The rest go under "Other options"; Exclude, Keep unknown and the manual note go in a secondary menu.
  - The "photo similarity is not the exact model" notice appears once at the top, not on every card.
  - One primary button at the bottom: "Build it in 3D".
- **Slice C: one dark theme site-wide.**
  - Home, review, Studio and My Builds move to a deep graphite palette (a Blender / product-studio feel), replacing every light sage-green theme. Define one CSS-variable palette and record it in this file.
  - One accent colour, cool blue, for clickable and selected states. Amber means only "needs confirmation", grey dashed means only "not selected", and red means only a compatibility failure. No green wireframes in 3D.
  - Text contrast at least WCAG AA. Status is never shown by colour alone; always add text or an icon.
  - **Palette (done 2026-10-26; tokens in `src/styles.css` at the top of the v3 section).** Use these tokens for any new v3 colour; never add a raw hex.

    | Token | Value | Use |
    | --- | --- | --- |
    | `--g-bg` | `#121417` | Page background |
    | `--g-surface-1` | `#1a1d21` | Cards and panels |
    | `--g-surface-2` | `#22262b` | Raised surfaces and inputs |
    | `--g-surface-3` | `#2b3036` | Hover |
    | `--g-line` | `#363c43` | Lines |
    | `--g-line-strong` | `#4c545d` | Strong lines |
    | `--g-text` | `#e8ebee` | Text |
    | `--g-text-muted` | `#b0b8c1` | Muted text |
    | `--g-text-faint` | `#939ca6` | Faint text, kickers |
    | `--g-accent` | `#6aa6ff` | Clickable or selected: links, outlines, selected chips, 3D selection |
    | `--g-accent-strong` | `#2f6fd6` | Primary button fill (white text 4.8:1) |
    | `--g-pending` | `#f2b65f` | Amber: needs confirmation only |
    | `--g-danger` | `#ff8178` | Red: compatibility failure only |
    | `--g-unselected` | `#7d8690` | Grey dashed: not selected only |

    Every text token passes AA on every surface. The 3D scene uses the same hexes for its selection, pending and unselected edges.
- **Slice D: recognisable demo part models.**
  - Build the models in code from manufacturer millimetre specs; no full img2threejs run.
  - Parts to model, for the white showcase build: white GPU (three-fan shroud, backplate), white 360 AIO (pump head, radiator fins), case fans (blades, light ring), memory (light bar), motherboard (slots, heatsinks). CPU, PSU and SSD may stay simple.
  - Rules: no brand logos; outer dimensions only from manufacturer specs; estimated sub-part proportions are written down as assumptions; `geometryAccuracy: "reference_reconstructed"`.
  - Any ready-made GLB needs the user's approval of its source and licence first.
  - Keep the adaptive quality tier working on weak GPUs.

## Demo track (4 weeks)

Goal: one demonstrable path: home page photo upload → recognition → Studio 3D (real dimensions, single-part explode, click a part to replace it) → shopping plan. All PRD and CLAUDE.md rules above still apply.

Weekly plan:
- **Week 1:** Merge the home page with the photo entry: the photo drop zone takes the hero position, and Describe / Import / Blank shrink to secondary links (PRD §4.2). Restyle the Studio 3D as a deep "Blender studio" look: drei `Environment` (HDRI or studio lightformers), `ContactShadows`/`AccumulativeShadows`, `@react-three/postprocessing` (SSAO, slight depth of field, bloom on RGB lighting), PBR materials (glass, metal, plastic), a dark grey background with floor reflection. Keep UI chrome minimal and put information on 3D labels. **Stop after week 1 for the user to review before week 2.**
- **Week 2:** Single-part explode and isolate (click a part → it pulls out alone, the rest dims; PRD Focus/Isolate). A replace card next to the part (candidates, price difference, compatibility change → preview → confirm through the existing proposal/confirm flow). The part name on the 3D label links to the manufacturer product page. No information-heavy side panel.
- **Week 3:** A "white showcase build" demo configuration of 8–12 parts. Add white catalog variants (white part numbers of the existing O11 Dynamic EVO, H5 Flow and 4000D Airflow, plus 1–2 white GPUs, ideally a white cooler and memory). Specs and prices only from manufacturer sites; prices are manufacturer MSRP labeled "Manufacturer MSRP, verified <date>", and are left out when the site has none. One 3D model per part, scaled 1:1 from the manufacturer's millimetre specs. Connect real image recognition, asking the user first when `OPENAI_API_KEY` is needed.
- **Week 4:** Polish the demo path, check performance, confirm the 2D fallback works without WebGL, and add matching Playwright E2E.

Demo-track rules:
- Part 3D models may be generated during development with img2threejs (Apache-2.0; a Claude Code agent skill that generates procedural three.js models from reference images). Never generate models from user photos at runtime. Before installing it, review its GitHub repository and license, tell the user where it would be installed, wait for approval, and record it in `docs/engineering/REUSE_DECISIONS.md`.
- Reference images come only from manufacturers' own product images. Models never reproduce brand logos.
- Dimensions always come from the manufacturer's spec sheet in millimetres, never estimated from images. Such models have `geometryAccuracy: "reference_reconstructed"`, and the UI says "Reference reconstruction · dimensions from manufacturer specs", never "real model". They never claim to prove fit.
- Use no BuildCores data at all, including retailer links (its license forbids commercial use). Part links use only manufacturer product pages and the existing retailer search pages.
- Choose visual libraries with "Reuse before building" (mature open-source first) and record them in `docs/engineering/REUSE_DECISIONS.md`.
- Per slice: full gate (lint, typecheck, test, build), before/after browser screenshots for the user, a local commit (no push), and a progress note in `docs/milestones/DEMO_TRACK_PROGRESS.md`.
