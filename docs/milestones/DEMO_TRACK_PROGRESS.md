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
- Observed gap: when the AI said a GPU, fans or motherboard were *not present* (empty case), candidate review still listed those slots as "Unresolved". Fixed in slice 10.
- Not verified: production/hosted environment, rate-limit behaviour against the real provider, cost per photo, photos from users' own builds. E2E stays keyless (7 flows + sample, keys blanked).

### Slice 10: "Not in photo" in candidate review — 2026-10-26

- Absence is now an explicit structured-output field, not parsed from wording. The model's absence wording varied ("no GPU installed", "visible: no", "visible fan count: 0").
- `src/lib/v3/image-contract.ts`: new required `absentParts` in the strict JSON schema, limited to `gpu`, `cooler`, `fan`, `motherboard` (hidden parts can't be listed). `createImageAnalysisResult` drops it for `poor` photos and dedupes it. It defaults to `[]` for the dev fixture and older saved analyses.
- Prompt (`image-analysis.server.ts`): list a part only when the area where it would sit is plainly visible; leave the list empty if the part could be hidden, out of frame or obscured.
- `candidate-matcher.ts`: new set status `not_in_photo`, shown even with no observation for that part, with no candidates. The explanation says the photo shows no such part installed and the Build slot stays open (fans: no slot sentence, since they aren't a Build slot). It deliberately doesn't claim the build needs the part.
- Candidate review shows **Not in photo** and hides "Keep unknown" for those sets; "Enter model manually" stays.
- `image-build.ts`: an absent part leaves its slot open (unselected) instead of marking it "needs review", unless the user wrote a manual note.
- Live recheck (local dev, `gpt-4.1-mini`):
  - Both empty-O11 photos returned `absentParts: [gpu, cooler, fan, motherboard]`.
  - The populated `og.png` build returned `[]` (no false absence).
  - UI flow for the white front photo: four "Not in photo" sets, and the Studio went from **Unresolved 2 → 0**.
  - One MSI recheck hit the app's own `SESSION_RATE_LIMITED` (3/min, shared local guest session), as designed; it wasn't retried.
- Tests: `src/lib/v3/absent-parts.test.ts` (4):
  - schema requires the field
  - poor-quality drop, default, rejects `psu`
  - "Not in photo" status, explanation, rendered label and hidden button
  - the draft leaves absent slots open, and a manual note still flags the slot
- Gate: lint 0, typecheck passed, **208 tests in 32 files** passed, build passed, **E2E 8/8**.

## Week 4

### Slice 11: performance check and adaptive scene quality — 2026-10-26

- **Bundles (production build):** the 3D scene is its own lazy chunk, `BuildScene` 1.30 MB / 393 KB gzip (three, R3F, drei, postprocessing), fetched only when the Studio shows 3D. Main entry 416 KB / 128 KB gzip; Studio route 49 KB / 15 KB gzip. With WebGL disabled, none of the 3D chunk is downloaded (checked in headless Edge with WebGL off).
- **Frame rate, white showcase sample in 3D**, measured over 5 s with `requestAnimationFrame`:

  | Renderer | Tier | fps | median / p95 frame |
  |---|---|---|---|
  | Software (SwiftShader, headless Edge), worst-case stand-in for weak hardware | before: always full | 1.6 | 720 / 750 ms |
  | Same | after: light tier, entered automatically | **8.9–9.5** | 104–111 / 118 ms |
  | NVIDIA RTX 5080 (D3D11 via ANGLE, headless Edge) | full, kept | **144** (display cap) | 6.9 / 7.0 ms |

- **Adaptive quality** (`BuildScene.tsx`), using drei `PerformanceMonitor`, which was already a dependency.
  - If the scene can't hold ~30 fps (bounds 30/55), it switches once, for the session, to a light tier: 1× pixel ratio instead of up to 1.5×, plain floor instead of `MeshReflectorMaterial`, no SSAO, no depth of field, no multisampling, glass without the extra transmission pass, and contact shadow rendered once.
  - Bloom (RGB glow) and vignette stay, so the light tier looks almost the same.
  - The tier is exposed as `data-scene-quality` on the scene region. Fast hardware never leaves the full tier.
- In software rendering the switch takes ~15–25 s, because the monitor needs ten sampling windows of rendered frames; on real weak GPUs (10–25 fps) it takes about 3–5 s.
- Gate: lint 0, typecheck passed, 208 tests passed, build passed, E2E 8/8. Screenshots: both tiers of the same view.

### Slice 12: 2D fallback without WebGL — 2026-10-26

- **Before** (checked in headless Edge with `--disable-webgl --disable-3d-apis`): no crash, no page errors, and no 3D code downloaded. But the fallback was a grid of eight buttons that only said "Selected", parts couldn't be swapped without 3D, the disabled 3D view still looked active, and the disclosure mentioned "dashed callouts" that weren't shown.
- **Now**:
  - `src/components/slot-grid-2d.tsx`: the Studio's 2D layout, used both with WebGL off and when the user picks 2D view.
    - Each slot card shows the part name, its price, "Price unknown" or "Already owned", and "Reference reconstruction" where it applies.
    - Clicking a card opens the **same replace card** the 3D focus uses, under the grid, so swaps go through the same preview/confirm path.
  - Without WebGL:
    - The 3D button is disabled, with the reason as a tooltip.
    - The toolbar reads "2D layout" and the note says "3D needs WebGL, which is off in this browser. Every build action works here in 2D."
    - The disclosure drops the dashed-callout sentence.
  - The 2D path has its own styles (`.v3-scene-2d`) so the error-boundary fallback styles no longer leak into the replace card.
- **Polish found on the way** (pre-existing): the Studio overflowed sideways by 137 px at 390 px wide, because long part names stretched the single-column grid. `.v3-studio-layout>*{min-width:0}` fixes it; overflow is now 0.
- E2E: `e2e/no-webgl.e2e.ts` (2 tests):
  - With WebGL off: sample → disabled 3D button, no canvas, eight cards with prices and reconstruction tags. A GPU swap to the ASUS PRIME through the 2D replace card gives 8/8, pass, $3,044.96, and **no 3D module request**.
  - At 390 px wide: no horizontal overflow.
- Gate: lint 0, typecheck passed, 208 tests passed, build passed, **E2E 10/10**. Screenshots: before/after with WebGL off, the 2D replace card, and phone width.

### Slice 13: demo-path polish and 3D E2E — 2026-10-26

- Walked the demo path in headless Edge (home photo upload with the keyless fixture → observations → candidate review → draft preview → Studio 3D → focus GPU → exploded → shopping plan) and fixed what showed:
  - **Home hero squeeze.** After a photo is analysed, the observations, review and draft preview were stuck in the right half of the hero with the left half empty. The hero now becomes one wide column (max 980 px) once results exist (CSS `:has(.v3-observations)`).
  - **Console 404 on every page.** There was no favicon, so the browser's `/favicon.ico` request failed. Added `public/favicon.svg` (the header's "A" mark) and linked it in `__root.tsx`; the walk now logs no console errors.
  - **Over-bright interior.** The interior fill light (6 → 4) blew the white O11 to flat white and made a bloom blob on the generic GPU's polished top plate. The light is lower and that plate is brushed (roughness 0.3 → 0.6); the O11 now shows panel shading and the blob is gone (RGB glow stays).
- E2E: `e2e/demo-path-3d.e2e.ts`. Software WebGL is enabled for this file only. It covers sample → 3D scene canvas with a quality tier → reconstruction disclosure → click the GPU's 3D label → part isolated with "Show full build" → swap to the ASUS PRIME in the focus card → label updates → Esc → the shopping plan's GPU row shows the ASUS at $919.99.
- Gate: lint 0, typecheck passed, 208 tests passed, build passed, **E2E 11/11**.

### Week 4 summary

- Performance: adaptive quality tier (slice 11). Software rendering 1.6 → ~9 fps; RTX 5080 keeps the full tier at 144 fps. The 3D chunk (393 KB gzip) loads only when 3D is shown.
- 2D fallback without WebGL (slice 12): every part, price and reconstruction tag in 2D, swaps through the same replace card, no 3D download; phone-width overflow fixed.
- Polish (slice 13): home hero layout after analysis, favicon/console error, scene lighting.
- E2E grew from 8 to 11 flows: no-WebGL swap, phone width, 3D demo path.
- Still open after the demo track (R7, per CLAUDE.md): E2E for lookalike correction (#2), old-format restore (#9), unauthorized access/deletion (#10); Focus/Isolate keyboard and mobile review; the curated image fixture set and visual regression; the user study. A real-GPU scene check on weaker hardware than the RTX 5080, and a hosted deployment, are not done.


## Visual redesign round

### Slice A: the photo's appearance reaches 3D — 2026-10-26

- **Before:** a photo read as "white case, glass side panel, 5 blue-lit fans, white AIO, white GPU" opened a Studio of amber and green wireframe boxes labelled "Review match". Nothing in 3D looked like the photo.
- **Photo sample:** `e2e/fixtures/white-build-sketch.png`, a drawing we made (not a photograph, not a product image). It comes with a keyless dev fixture (`createWhiteSketchFixture` in `src/lib/v3/dev-image-fixture.ts`); fixtures are now looked up by file name (`devImageFixtures`).
- **Appearance placeholders** (PRD §9.3 level 2), in `src/lib/v3/photo-appearance.ts`:
  - `photoAppearance(document)` reads only visible, non-unknown observations. It covers **unresolved** case, GPU, cooler and motherboard slots that have an observation of their own.
  - Traits read: body colour (own observation, else the theme colour), glass/window side panel, fan count (digits or words), light colour, and AIO vs air cooler.
  - Hidden slots and slots without observations keep the empty-slot style. Selected slots never use it.
  - The scene draws the case placeholder with the observed colour, glass or a solid side, and up to 6 lit fans (3 front, then the shroud). The front mesh turns see-through when fans are present.
  - GPU and motherboard placeholders are the generic shapes in the observed colour. An AIO is a pump head with a ring plus a radiator under the roof with three lit fans.
  - Labels (3D callout, 2D card, scene disclosure) say **"Appearance from photo · model not confirmed"** and never a model name. The callout tooltip and 2D card give the trait line (e.g. "White · Glass side panel · 5 fans · Blue light").
  - Placeholders get no amber wireframe box; the "not confirmed" state is on the label.
- **Generic part models use the part's catalog colour.** A white catalog cooler is no longer silver, and a selected AIO is drawn as an AIO.
- **"Use suggested parts"** (`suggestParts` in `src/lib/v3/image-build.ts`):
  - It takes the top-ranked candidate per category and skips ones the user excluded.
  - It shows a change list first: what each slot becomes, the match label, price, effect on appearance, total (known + unknown prices, not counted), compatibility (incomplete count and rule findings) and the slots still open.
  - Confirm goes through the existing `confirmImageBuild` revision check; Cancel changes nothing.
  - Weak matches still read "Weak visual match · appearance only" (`candidateMatchLabel`, shared with the review cards).
  - The review component now takes its review state from the flow, so the suggestion and the cards share one state.
- **Scene lighting found on the way:**
  - Bloom threshold 1 → 1.6, so lit white panels stop glowing while emissive RGB (2.2+) still blooms.
  - With a white motherboard, the interior fill light moves towards the glass (z 0.1 → 0.65) at half intensity, because it blew the board out to a white blob.
  - The front ring lightformer is softer (1.2 → 0.5) because the glass mirrored it over the interior.
- **Known gaps** for the next slices:
  - After a case is confirmed, its reference model has no fans, so the photo's 5 fans disappear. Fans are not a Build slot; slice D adds fan models.
  - Top-ranked white cases tie on colour, so the alphabetical first (Corsair 4000D White) wins. The white showcase cases have no `style` field from the manufacturer pages to break the tie.
  - The selection outline is still green until slice C.
- Tests: `src/lib/v3/photo-appearance.test.ts` (4 tests). E2E `e2e/photo-suggested-parts.e2e.ts`: photo sample → change list (weak label, unresolved board, incomplete, unknown price) → confirm → 3/8 selected, case and GPU `data-color="white"` in 3D and 2D, board labelled as from the photo.
- Gate: lint 0, typecheck passed, 212 tests in 33 files passed, build passed, **E2E 12/12**.

### Slice A2: case front panel, honest ties, photo fans on a confirmed case (2026-10-26)

Asked for after the slice A review: the three white cases tied on colour and the alphabetical first (Corsair 4000D) won, though the photo looks like an O11.

- **Case appearance fields** (`caseAppearance` in `src/data/showcaseParts.ts`), read on 2026-10-26 from each case's own product page, with the quoted wording, link and date:
  - Lian Li O11 Dynamic EVO White: front **glass** ("Front and side tempered glass panels"), layout **dual-chamber** ("Dual-chamber layout…").
  - NZXT H5 Flow White: front **mesh** ("Ultra-fine mesh on the top, front, and side panels"); layout not described, so unknown.
  - Corsair 4000D Airflow White: front **unknown**. The page says "High-airflow optimized steel front panel" without saying mesh or perforated. Layout unknown.
- **Matching** (`src/lib/v3/candidate-matcher.ts`):
  - A case "front panel material" observation scores against the stated material.
  - A confident observed mismatch drops the candidate, like colour does.
  - An unknown on the manufacturer page counts neither way.
  - A "dual-chamber" layout observation scores only against a stated dual-chamber case.
  - Signals read e.g. "Front panel: glass (manufacturer page, verified 2026-10-26)".
- **Image prompt** (`image-analysis.server.ts`): when the case front is visible, add a "front panel material" observation (glass / mesh / perforated / solid), otherwise omit it; add "layout: dual-chamber" when a separate rear chamber is visible.
- **Ties are shown, not resolved by name.**
  - `equallyLikelyCandidates(set, review)` returns the non-excluded top candidates that share the best score.
  - The review shows "N options equally likely. The photo cannot tell … apart, so none is picked for you."
  - "Use suggested parts" picks nothing for a tied category unless the user already chose one there. Its row reads "N options equally likely", lists the names, and says "Choose one in the review; nothing is picked by name". The slot stays drawn from the photo until then.
  - On the current catalog the two white GPUs (MSI, ASUS) and the white fans also tie, so they now ask the user too.
- **Photo fans on a confirmed case** (`photoFans` in `photo-appearance.ts`, `FanSet` in `BuildScene.tsx`):
  - When the case is selected and the photo counted fans, the reference case draws them (count, frame colour, light colour).
  - The case callout reads "5 fans · Appearance from photo".
  - The scene disclosure adds "Fans (5): Appearance from photo, a style note, not a Build part."
  - A stopgap until slice D's fan models.
- **Samples** (drawings, keyless dev fixtures):
  - `e2e/fixtures/white-build-sketch.png` stays the straight side view, where nothing shows the front, so the cases tie.
  - New `e2e/fixtures/white-build-glass-front.png` adds a three-quarter front face with a pillarless glass front.
- **Result on the glass-front sample:**
  - Cases: O11 (score 4, possible match) first, then 4000D (2, weak; front unknown). The H5 Flow is dropped by its mesh front.
  - The user picks the MSI GPU from the two tied options, then "Use suggested parts" gives O11 + MSI + Corsair AIO.
  - In the Studio, the O11 reference model shows the three blue-ring front fans through its glass.
- Tests:
  - `photo-appearance.test.ts` (now 7): glass front → O11 first with the front-panel signal; tie → 3 equally likely, and excluding one leaves 2; suggest never picks a tied case but keeps a user's earlier choice; manufacturer fields as stated; `photoFans` after confirm.
  - E2E `photo-suggested-parts.e2e.ts` (now 2 tests):
    - glass front → O11 first → GPU "2 options equally likely" → pick MSI → change list → confirm → 3/8, white case and GPU, "5 fans · Appearance from photo".
    - side sketch → case "3 options equally likely" in the review and the change list.
- Gate: lint 0, typecheck passed, 216 tests in 33 files passed, build passed, **E2E 13/13**.

### Slice B: review page re-layout (PRD §4.3, 2026-10-26)

Before: upload, a long list of every observation with reasons, a candidate list where every card repeated the same disclaimers, then two build buttons ("Use suggested parts", "Preview Build draft").

- **Two columns** (`.v3-review-layout`):
  - The photo sits on the left (sticky) with its observation regions outlined. Hovering or focusing a part card outlines that part's regions in blue.
  - The parts are on the right. Below 900 px the columns stack.
  - On the home page the hero collapses to one column while a review is showing (CSS `:has`).
- **One tag line per part** (`observationTagLine` in `src/lib/v3/observation-tags.ts`), e.g. "5 fans · White · Blue LED rings". "Why" expands each observation's evidence, origin and confidence. Theme and lighting share an "Overall look" card.
- **Part cards** (`src/components/image-candidate-review.tsx`):
  - A text state chip, so status is not colour alone: Top match, Your choice, Choose one, Kept unknown, Your note, Not in photo, No catalog match.
  - The top option has one primary "Use this"; "Why this match" holds the signals and the manufacturer source.
  - The rest sit under "Other options (n)". A tie of 2 or 3 is listed with secondary buttons only; a longer tie is folded, so it doesn't read like a ranking.
  - Exclude / Restore, Keep unknown and the manual note are in a "More" menu.
- **The similarity disclaimer appears once**, at the top of the parts column (not per card).
- **One bottom button, "Build it in 3D".**
  - It opens the change list (`suggestParts`): the user's "Use this" choices are kept, open parts get the top match filled in, and ties, "keep unknown" and manual notes are never filled.
  - Rows say "Your choice" or "Top match, filled in"; confirm reads "Confirm and open Build Studio".
  - The old "Preview Build draft" path is gone; its rules live on in the change list.
  - `CandidateReview` gained `kept`, so an explicit "keep unknown" differs from "not decided yet".
- Tests:
  - New `src/lib/v3/review-layout.test.ts` (4): tag lines; your choice / top match / tie / none; kept and noted parts never filled; card shape (one Use this up front, Other options, More menu, a folded 5-way tie, a single disclaimer).
  - `candidate-matcher.test.ts` was updated to the new card.
  - E2E: `image-to-build.e2e.ts` now opens the folded 5-way GPU tie and uses "Use this" → "Build it in 3D". `photo-suggested-parts.e2e.ts` checks the photo regions, the single disclaimer, the tag line, "Top match", "Why this match", the hover outline and the change-list decision labels.
- Gate: lint 0, typecheck passed, 220 tests in 34 files passed, build passed, **E2E 13/13**. At 390 px wide the review has no sideways scroll.

### Slice B follow-up: untick a filled-in row (2026-10-26)

The user accepted "Build it in 3D" filling open parts, and asked for a safeguard.
- Every change-list row marked "Top match, filled in" has a checkbox, ticked by default.
- Unticking re-runs `suggestParts(…, declined)`. The row stays in the list, struck through, and reads "Top match, not filled in" and "Not filled in; stays unconfirmed, drawn from the photo (…)". The total and compatibility update; confirming leaves that slot unconfirmed.
- Rows from the user's own "Use this" have no checkbox.
- Tests:
  - `review-layout.test.ts` adds the declined case: unresolved slot, other rows unchanged.
  - The glass-front E2E unticks the cooler: 2 of 8 in the list, "2 / 8" in the Studio, and the cooler is drawn from the photo.
- Gate: lint 0, typecheck, 221 tests, build, E2E 13/13.
