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

### Slice 6 (in progress): reference-reconstructed part models — 2026-10-25

- Installed with user approval: Python 3.12.10 (winget, per-user, installer hash verified) and img2threejs v2.0.0 cloned to `~/.claude/skills/img2threejs` (tag → commit `a669e9a`, Claude Code only, no npx installer). It is listed as installed in `REUSE_DECISIONS.md` only after this note (the row still says pending).
- O11 Dynamic EVO White: the img2threejs checklist ran through intake, suitability (conditional), admission, assessment, 9-item detail inventory, material evidence (4 regions, 0.74–0.91), strict spec validation and the blockout factory. Rendered envelope is 467 × 459 × 285 mm vs published 465 × 459 × 285 (the I/O insert protrudes 2 mm; to fix). Sub-part proportions follow the reference image inside the published envelope (recorded as assumptions). No logo.
- Tier 1 silhouette IoU was 0.40: a white case on the white manufacturer background defeats mask extraction. Divine Eye flagged reconstruction mode (objectness 0.75, pHash 0.75). **User decision (Option A):** IoU is advisory for white-on-white manufacturer references, recorded with that evidence in the spec; aspect, scale, symmetry and all other gates stay enforced. The blockout pass gate now passes.
- Working files (references, spec, renders, review harness) live in the session scratchpad, not the repository.
- Next: blockout multi-angle check, comparison sheet and review; the six remaining O11 passes; the MSI white GPU through the same pipeline; mm-spec models for the other parts; wiring into the scene with the "Reference reconstruction · dimensions from manufacturer specs" label.
