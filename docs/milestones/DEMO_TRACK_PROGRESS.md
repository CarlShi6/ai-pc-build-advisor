# Demo track progress (4 weeks, before R7 user testing)

Plan and rules: CLAUDE.md "Demo track (4 weeks)". Branch `rebuild/image-to-build-v3`, local commits only. Screenshots are kept outside the repository (session scratchpad) and shared with the user per slice.

## Week 1

### Slice 1: home page is the photo entry — 2026-10-25

- `src/components/image-start-flow.tsx`: the whole photo → observations → candidate review → Build preview → confirm flow moved out of `start.$mode.tsx` unchanged (same privacy and retention notes, limits, fixture button, funnel events, explicit confirmation). It adds drag-and-drop on the drop zone and an inline budget when the host page has none.
- `src/routes/index.tsx`: the hero is now the headline plus a large **Upload a PC photo** drop zone (PRD §4.2 primary CTA). Describe / Import / Start from scratch are a "No photo?" link row. The four-card grid and decorative tower art are gone. Privacy and retention notes fold into "Your photo stays private · how analysis works".
- `/start/image` uses the same component, so existing links and E2E tests keep working.
- E2E: new "home hero upload runs the same image → Build flow". **7/7 passed.** Gate: lint 0, typecheck passed, 174 tests in 25 files passed, build passed.
- Known rough edge (week 4 polish): after analysis, the review cards stay in the hero's right column, which is narrow on desktop. PRD §4.2's sample/demo mode for users without a photo is not built yet; the week 3 white showcase build is the natural sample.

### Slice 2: Studio 3D studio look — 2026-10-25

- Libraries: `@react-three/postprocessing` 3.2.0 and `postprocessing` 6.39.5 (pinned exact; MIT / Zlib, plus `n8ao` ISC), recorded in `REUSE_DECISIONS.md`. The studio light rig uses drei `Lightformer`s inside `Environment`, so no HDRI file is downloaded at runtime.
- `src/features/build-3d/BuildScene.tsx` (same props, slots, layout, interactions and dashed callouts):
  - dark grey background with fog, a reflective floor (`MeshReflectorMaterial`) and `ContactShadows`, key, rim and interior lights
  - postprocessing: N8AO SSAO, bloom (threshold 1, so only emissive RGB parts glow), light depth of field and a vignette
  - a case built from metal panels, a dark front, a PSU shroud and a **tempered-glass side panel** (`meshPhysicalMaterial` transmission), with RGB front fans from the photo's fan count
  - PBR part shapes: PCB motherboard with heatsinks, metal CPU, air-tower cooler with RGB ring, GPU shroud with backplate, three fans and an RGB strip, RAM sticks with RGB tops, M.2 storage, PSU
  - empty or unresolved slots stay faint placeholder volumes with grey or amber outlines, never fake parts; the selected part gets a thin outline
- `src/lib/v3/scene-presentation.ts`: black, white and silver now map to realistic material colors (they were the old green theme's tints).
- `src/styles.css`: the scene toolbar, mode buttons and disclosure float over a taller 640 px canvas; callouts are dark glass chips with a status-colored edge. Mobile falls back to the stacked layout.
- Gate: lint 0, typecheck passed, 174 tests in 25 files passed, build passed. E2E **7/7** (includes the 2D-view edit flow).
- Screenshots: fixture build and a full eight-part build. They were rendered in headless Edge with SwiftShader WebGL; a real GPU will look smoother.
- Notes: part geometry is still generic and illustrative (`geometryAccuracy: "illustrative"`); millimetre-accurate reference reconstructions are week 3. The lazy-loaded `BuildScene` chunk is now about 1.27 MB (postprocessing included); it loads only when the 3D view opens. Performance check and reduced-motion handling are week 4.

## Week 2

### Slice 3: single-part Focus/Isolate and label links — 2026-10-25

- `src/lib/v3/scene-focus.ts` (new, pure): slot layout moved out of the scene, plus `focusOffset`, `slotPosition(slot, mode, explode, focusSlot)` and `isDimmed`. Unit-tested in `scene-focus.test.ts` (4 tests).
- `src/features/build-3d/BuildScene.tsx`:
  - Clicking a part (or its 3D label) selects and **focuses** it. The part eases out of the case towards the viewer (it snaps under `prefers-reduced-motion`), while every other part, the case, its glass and RGB fade to ghosts.
  - **Show full build** (chip), **Esc**, or clicking empty space returns to the full view. The case is isolated by dimming only, never moved. Dashed callouts follow the moved part; dimmed callouts and labels fade.
  - Dimming remounts materials, because three.js only recompiles `transparent` on a new material. The interior fill light moved deeper into the case and softens during focus, so a pulled-out part isn't blown out.
  - New optional props `focusSlot`, `onFocus`, `onClearFocus`, `focusCard` (slice 4) and `partLink`.
- **Label links:** each 3D label now carries a part link. It is a manufacturer product page when the catalog has a validated one (`getValidatedOfficialUrl`), otherwise the existing retailer search, labeled "Search newegg.com". **No seed part has a manufacturer URL today**, so every label currently shows the search link. The week 3 white showcase parts will carry verified manufacturer URLs. No BuildCores data is used.
- Gate: lint 0, typecheck passed, **178 tests in 26 files** passed, build passed. E2E 7/7. Focus has no E2E yet (the default E2E browser has no WebGL); it is planned with the week 4 E2E pass.

### Slice 4: replace card beside the focused part — 2026-10-25

- `src/lib/v3/replace-options.ts` (new, pure): for a slot, every other catalog part becomes a normal `proposePartSelection` preview. Each option carries:
  - the seed price difference
  - compatibility before → after, where a partial build is always "Incomplete" and never "pass"
  - trait impacts and lock conflicts (from EP-05)
  - **the rule findings the swap would add**, so a new warning is explained rather than just counted

  Options sort with lock-safe parts first, then closest seed price, and the list is capped at 4 with a "more in the parts panel" note. Tested in `replace-options.test.ts` (3 tests).
- `src/components/part-replace-card.tsx`: a dark glass card positioned by the scene next to the focused part, on whichever side has room.
  - It shows the current part and its link (manufacturer page or labeled retailer search), then the options.
  - Choosing one shows **PREVIEW · NOT APPLIED** with seed total, compatibility, look impact and any new findings. **Confirm** commits through `confirmPartSelection`, or through `confirmWithLockOverride` behind an explicit tick when a locked look would change. **Back** returns to the list.
  - Stale previews are rejected with a message. The footer repeats "seed prices, not live offers… physical fit isn't verified".
  - After confirming, the part stays focused, so the new part is shown in place.
- `src/routes/studio.tsx`: passes the card as `focusCard`, keyed by slot and revision so it resets after each change. The existing 2D parts panel is unchanged and remains the keyboard and no-WebGL path.
- Browser (full 1440p build → click the GPU label): the card listed "NVIDIA GeForce RTX 5070 Ti (reference specifications) · −$50 seed · warning · 1 finding". The preview showed $2,492 → $2,442, "pass · 0 findings → warning · 1 finding" and the finding "GPU length or case clearance data is missing." The 3D label still read RTX 4070 Ti Super (not applied). After **Confirm** the label became RTX 5070 Ti and the stats total $2,442.
- Gate: lint 0, typecheck passed, **181 tests in 27 files** passed, build passed. E2E 7/7. The in-scene card has no E2E yet (it needs WebGL in the E2E browser); planned for week 4.

## Week 3

### Slice 5: white showcase parts from manufacturer pages — 2026-10-25

- `src/data/showcaseParts.ts`: **8 white parts**, every value read on 2026-10-25 from the manufacturer's own product page, with prices from the manufacturer's own store. No third-party data, no BuildCores.

| Slot | Part (part number) | Key published specs | Price |
|---|---|---|---|
| Case | Lian Li O11 Dynamic EVO White (O11DEW) | 465 D × 285 W × 459 H mm; GPU 426, cooler 167, PSU 220 mm; 360 mm radiator | **Unknown** (no price on lian-li.com) |
| Case | NZXT H5 Flow White (CC-H52FW-01) | 465 H × 225 W × 430 D mm; GPU 410, cooler 170, PSU 200 mm | $94.99 (nzxt.com) |
| Case | Corsair 4000D Airflow White (CC-9011201-WW) | 466 × 453 × 230 mm; GPU 360 (340 with front AIO), cooler 170, PSU 220 mm; 360 mm front radiator | **Unknown** (no case price on corsair.com) |
| GPU | MSI RTX 5070 Ti 16G GAMING TRIO OC WHITE (G507T-16GTCW) | 338 × 140 × 50 mm; 300 W; 16-pin; 750 W PSU | $1,249.99 (us-store.msi.com) |
| GPU | ASUS PRIME RTX 5070 White OC (PRIME-RTX5070-O12G-WHITE) | 304 × 126 × 50 mm; 2.5 slot; 16-pin; 750 W PSU; board power not listed | $919.99 (eshop.asus.com) |
| Cooler | Corsair iCUE LINK TITAN 360 RX RGB White (CW-9061021-WW) | 360 mm radiator; 450 mm tubing; LGA1851/1700, AM5/AM4; size printed without units | $199.99 (corsair.com) |
| Memory | Corsair VENGEANCE RGB 32GB DDR5-6000 CL30 White (CMH32GX5M2B6000C30W) | 2 × 16 GB, XMP; no module dimensions | $657.99 (corsair.com) |
| PSU | Corsair RM850x SHIFT White (CP-9020274-NA) | 850 W, 80+ Gold, ATX 3.1, 140 mm fan; no PSU length | $189.99 (corsair.com) |

  Prices are labeled **"Manufacturer store price, verified 2026-10-25"**, not "MSRP". No page calls its price an MSRP; these are the list prices shown on each manufacturer's own store (none showed a strikethrough sale). Fields a page didn't state clearly are left out: ASUS board power, NZXT radiator support, unitless cooler size, RAM module size, PSU length. The rules then report "not enough data".
- **Unknown prices** (`Part.priceStatus: "unknown"` plus `priceSource`): excluded from totals (`calculateBuildTotal`, `priceCoverage`). Studio shows "+ N unknown prices, not counted". The shopping plan shows "Unknown / Price unknown" and "7 of 8 slots priced · 1 price unknown". The replace card shows "price unknown" instead of a $0 difference. The optimizer never ranks or diffs against an unknown price.
- `src/lib/v3/catalog.ts`: `v3Catalog` = `seedParts` + showcase parts, used by the Studio part lists, import matching, photo review and image drafts. **The pre-v3 pages still use `seedParts` only**, so legacy totals are unaffected.
- Photo review: a white case in a photo now matches the white showcase cases as appearance-only candidates, with their manufacturer page as the source.
- Tests: `src/data/showcaseParts.test.ts` (10) covers:
  - manufacturer domains for product and price URLs, verification date, unique part numbers, no BuildCores
  - unknown price excluded from totals, published mm values matching the printed text, unitless sizes kept without mm
  - v3-only catalog, the GPU clearance rule passing from published figures, the missing NZXT radiator figure not passing
  - shopping plan prices, sources and the "7 of 8 priced" summary, no ranking on unknown prices, white photo matching

  Three older tests were updated because white parts now exist: the "unsupported color" test uses pink, the white lock now offers only white cases (H5 Flow White is the only cheaper one), and an impossible pink lock is explained.
- Browser (Import of 8 exact names → Studio): 8/8, **Pass**, "$3,374.96 + 1 unknown price, not counted". The white case renders in the studio scene, and labels for the showcase parts read "Manufacturer page ↗". The shopping plan shows each source and "7 of 8 slots priced · 1 price unknown". The fix for "All 8 slots priced" (it was wrongly shown with an unknown price) is in this slice.
- Gate: lint 0, typecheck passed, **191 tests in 28 files** passed, build passed. E2E 7/7.
- Not done yet in week 3: 1:1 millimetre part models (waiting on the img2threejs approval and Python), the white showcase demo configuration as a one-click sample, and real image recognition (needs `OPENAI_API_KEY`, to be requested from the user).

### Slice 6: reference-reconstructed part models in the scene — 2026-10-26

- **img2threejs v2.0.0, full checklist, two parts** (installed with user approval: Python 3.12.10 via winget; tag v2.0.0 = `a669e9a` in `~/.claude/skills/img2threejs`, Claude Code only):

  | Part | References (manufacturer gallery) | Passes | Final review | Parts / triangles | Envelope vs published |
  |---|---|---|---|---|---|
  | Lian Li O11 Dynamic EVO White | lian-li.com front + side views | 8/8 credited | vision 0.79, fidelity 0.78 | 34 / 408 | 467 × 459 × 286 vs 465 × 459 × 285 mm (glass border print stands ≤1.3 mm proud) |
  | MSI RTX 5070 Ti GAMING TRIO OC WHITE | msi.com fan side, three-quarter and back views | 8/8 credited | vision 0.80, fidelity 0.79 | 22 / 3,576 | 338 × 140 × 49.7 mm card; the 120 mm PCIe bracket adds height |

  Each run went through intake, suitability (conditional: white on white), admission, assessment, detail inventory, material evidence and strict validation. Then blockout → structural → form → material → surface → lighting → interaction → optimization, each with renders, Tier 1, multi-angle, pass gate, comparison sheet and a recorded review, plus part coverage (0 errors), action-ready, emission and plugin gates.

  Sub-part placements were measured on the manufacturer images (0.79 mm/px for the O11, 0.394 mm/px for the MSI) inside the published envelope and recorded as assumptions. Brand marks, hub logos and printed text are not modelled.
- **What the passes changed.**
  - O11: glass border print and frameless corner, pillar seam, slot covers, the I/O ports where the reference shows them, hex-zone tones at the reference's measured mean colours, near-neutral glass.
  - MSI: fans as flattened discs, because v2.0.0's endpoint cylinders are hard-coded to 8 segments (octagons). Each fan is an outline / ring / blade disc / hub stack, layered so the rims don't z-fight; shroud lips and end cap; albedo calibrated render-vs-reference.
  - After export, the MSI card measured 47.7 mm thick, so the backplate moved 2 mm and the final pass was re-reviewed (now 49.7 mm).
- **Documented deviations** (also in the specs and `REUSE_DECISIONS.md`):
  1. **Silhouette IoU advisory** for white-on-white references (user decision, Option A). It was needed for the O11 (IoU 0.40, Divine Eye objectness 0.75–0.84). The MSI passed IoU outright (0.91).
  2. **Textureless exemption in the orchestrator.** The v2.0.0 spec validator exempts evidence-backed `textureless` materials from the texture-map bar, but the pass orchestrator didn't. `tools/reference-models/harness/i2t.py` applies the validator's own rule there; the skill itself is untouched.
  3. The review harness applies the spec's exposure intent (1.35), because the generator's renderer config has no exposure field.
- **Spec-envelope models** (no image pipeline): NZXT H5 Flow White and Corsair 4000D Airflow White cases, and the ASUS PRIME RTX 5070 White, built in `src/lib/v3/reference-models.ts` from the published millimetres plus features each manufacturer page states:
  - H5 Flow: mesh top and front, perforated PSU shroud, ultra-clear glass.
  - 4000D Airflow: steel high-airflow front, tempered glass; no shroud, because the page doesn't mention one.
  - ASUS PRIME: "three Axial-tech fans", evenly spaced, because no pitch is published.

  Cooler, RAM and PSU publish no usable millimetres, so they stay illustrative.
- **In the app.** `reference-models/<slug>/object-sculpt-spec.json` (local paths removed) → `tools/reference-models/export_reference_models.py` → `src/data/referenceModels.generated.ts`, as plain millimetre boxes and discs with material colour, roughness, metalness and transmission. Nothing from img2threejs ships.
  - `BuildScene` draws a selected part's reference model at mm/150 through the same dim-aware materials, so Focus/Isolate still works. GPU models rotate into the flat GPU slot (fans down, top edge to the glass, bracket at the rear). A focused GPU eases round to show its fans.
  - Labels:
    - The focus card shows **"Reference reconstruction · dimensions from manufacturer specs"**, or "Illustrative geometry".
    - The scene disclosure names the reconstructed slots and says neither kind verifies physical clearance.
  - Fixed in passing: the Studio's slot-detail preview showed "Price difference +$0" for an unknown price. It now shows "Unknown", and the preview total adds "+ N unknown".
- Tests: `src/lib/v3/reference-models.test.ts` (7):
  - every white case or GPU with published mm has a model, and nothing else does
  - labels and accuracy
  - case envelopes within 1% of the published figures; GPU length, thickness and card height within 1–2%
  - credited passes
  - scene sizing and axes
  - which build slots render reconstructions
- Gate: lint 0, typecheck passed, **198 tests in 29 files** passed, build passed, **E2E 7/7**.
- Browser: before/after screenshots of the eight-part white build (scene, focused GPU, focused case) and the H5 Flow + ASUS PRIME variant. Headless Edge with SwiftShader.
- Tooling in `tools/reference-models/harness/` (excluded from ESLint): review page, renderer, pass runner, advisory Tier 1, orchestrator wrapper, WebP→PNG. Manufacturer reference images are **not** committed.
- Still open in week 3 after slice 6: the white showcase one-click sample (slice 7, below); real image recognition (ask before `OPENAI_API_KEY`).

### Slice 7: white showcase one-click sample — 2026-10-26

- Home page "No photo?" row: **Try the white showcase sample**. One click creates a fresh local draft and opens the Studio. Nothing is saved until the user presses Save; the funnel records `v3_draft_created` with source `sample`.
- `src/lib/v3/showcase-sample.ts`: eight parts.
  - Five white showcase parts from manufacturer pages: O11 Dynamic EVO White, iCUE LINK TITAN 360 RX White, MSI RTX 5070 Ti Gaming Trio OC White, VENGEANCE RGB DDR5-6000 White, RM850x SHIFT White.
  - Three seed parts: ROG Maximus Z790 Hero WiFi, Core i7-14700K, 990 PRO 2TB. The catalog has no white motherboard, CPU or SSD, and the Studio subtitle says so: "Sample build · white parts from manufacturer pages; motherboard, CPU and SSD are seed parts. Swap anything; nothing is saved until you save."
- New draft source `sample` (`DraftSource`); it survives the save/restore envelope.
- Result in the Studio: 8/8 slots, rules **Pass**, and "$3,374.96 + 1 unknown price, not counted" (the O11 has no manufacturer price). The case and GPU show as reference reconstructions.
- Tests: `src/lib/v3/showcase-sample.test.ts` (4):
  - all slots and categories, rules pass
  - five white parts, unknown price kept unknown
  - case and GPU reconstructed
  - fresh draft each time, and the source survives a save round trip

  E2E: `e2e/showcase-sample.e2e.ts` covers home → Studio, with the heading, seed-parts note, 8/8, pass, unknown price and reconstruction label.
- Gate: lint 0, typecheck passed, **202 tests in 30 files** passed, build passed, **E2E 8/8**. Before/after screenshots of the home page and the sample Studio were shared.
- Still open in week 3: real image recognition (ask before `OPENAI_API_KEY`).

### Slice 8: separate image AI from the advisor — 2026-10-26

- User decision before adding a key: `AI_PROVIDER=openai` must turn on image recognition only.
- `src/lib/config.server.ts`: new server-only `ADVISOR_AI_PROVIDER` (`advisorAiProvider`). `src/lib/ai/advisor-provider.ts` now reads it instead of `AI_PROVIDER`, so the advisor chat stays on mock unless it is set to `openai` separately (with a key). Image analysis still reads `AI_PROVIDER` plus `OPENAI_API_KEY` / `AI_PROVIDER_API_KEY` and `AI_PROVIDER_MODEL`.
- `.env.example` documents both switches; `playwright.config.ts` blanks `ADVISOR_AI_PROVIDER` like the other AI settings, so E2E never calls a provider.
- Tests: `src/lib/ai/advisor-provider.test.ts` (2): image AI on → advisor mock; advisor on → OpenAI only with a key.
- No key has been configured. Next: the user adds `AI_PROVIDER`, `OPENAI_API_KEY` and `AI_PROVIDER_MODEL` to `.env.local` themselves; then verify that the dev server reads them and run real photos.

### Slice 9: real image recognition verified (local dev) — 2026-10-26

- Setup: the user put `AI_PROVIDER=openai`, the key and `AI_PROVIDER_MODEL=gpt-4.1-mini` in `.env.local` of the main checkout. That file also holds unrelated live keys (Supabase service role, Stripe, Best Buy with `PRICE_PROVIDER=bestbuy`), so it was **not** copied. The v3 dev server was restarted with only the four image-AI variables exported from it; the key was never printed or written elsewhere. `ADVISOR_AI_PROVIDER` unset, so the advisor stays mock. No code change was needed: `image-analysis.server.ts` already worked as built.
- API checks (`POST /api/image-analyses`, 3 images, all HTTP 200 in 6.6–7.6 s, `provider: openai`, structured output valid):
  - Lian Li O11 side view, empty case: white metal, side panel removed, tower; no GPU, cooler, fans or motherboard installed.
  - MSI GPU three-quarter view: only the legible "GEFORCE RTX" and msi marks were transcribed; it did not guess "5070 Ti".
  - `public/og.png` (dark build): upright silhouette, glass side, mesh front, green lighting, one rear fan; board form factor marked inferred, medium confidence.

  All eight part identities stayed unknown in every result, and no SKU was guessed.
- UI checks (home hero upload → **Analyze image** → observations → candidate review → draft → Studio), headless Edge, 2 photos:
  - `og.png`: observations in 6.1 s, labelled "AI visual observations · review required" (6 observations). The case got appearance-only alternatives; GPU, fans and motherboard stayed unresolved with "Keep unknown". The Studio showed a reference-photo draft, 1/8, Incomplete.
  - O11 white front view: 8 observations in 5.6 s. The candidates were all three white cases as "Weak visual match · appearance only", each saying photo similarity doesn't verify the SKU; it didn't claim the case is an O11. Confirming the first (4000D White, no price) gave "$0 + 1 unknown price, not counted".

  One imprecision: it called the front glass "the left side panel". The review step is there for exactly this.
- Observed gap (not fixed): when the AI says a GPU, fans or motherboard are *not present* (empty case), candidate review still lists those slots as "Unresolved". A follow-up could show "not in photo" instead.
- Not verified: production/hosted environment, rate-limit behaviour against the real provider, cost per photo, photos from users' own builds. E2E stays keyless (7 flows + sample, keys blanked).

