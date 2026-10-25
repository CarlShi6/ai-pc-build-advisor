# AIPC — Engineering Product Requirements Document v3.0
## Image-to-Build & Interactive 3D PC Studio

> **Product:** AI PC Build Advisor (AIPC)  
> **Working product concept:** See a PC you love. Turn it into a build you can actually make.  
> **Document type:** Integrated Product + Engineering PRD  
> **Version:** 3.0 / Working implementation specification  
> **Date:** 2026-10-25  
> **Supersedes:** Engineering PRD v2.0 (2026-10-25)  
> **Repository intended for rebuild:** `CarlShi6/ai-pc-build-advisor`  
> **Decision:** Rebuild the product experience *inside the original project*, retaining useful domain services after an audit  
> **Development policy:** Local design/implementation planning only. **Do not delete existing history, force-push, deploy, merge, or push without explicit authorization.**  
> **Evidence status:** The repository's current local branch has **not** been inspected for this document. Existing implementation claims below are inherited from v2.0 and require a fresh local audit before coding.

---

# 0. Document Guide & Decision Log

## 0.1 What changed from v2.0

This is a **product-level pivot, not a feature patch**. AIPC's prior primary use case was to import or create a structured PC build, validate it, and inspect it in a 3D configuration view. The new flagship user journey starts even earlier: **visual inspiration**.

A user sees a PC in a social video, screenshot, or photo, but does not know its parts. AIPC helps identify *visible* characteristics, retrieve plausible real-world parts, generate a structured editable build draft, reconstruct an **illustrative or asset-backed** 3D representation, and move into trusted comparisons, compatibility checks, shopping decisions, and sharing.

**New in v3.0:**

1. Image-to-Build becomes a primary entry point alongside Build from Description and Import Parts List.
2. Visual product identification, similarity search, candidate ranking, ambiguity resolution, and user confirmation become first-class services.
3. The 3D scene becomes the **central build workspace**, not a disconnected visualization widget.
4. Build goals now explicitly support **Preserve the Look**, **Preserve Performance**, **Meet Budget**, or a custom weighting.
5. The data model distinguishes **observed / inferred / user-confirmed / verified** information.
6. The catalog separates **real component identity**, **visual appearance metadata**, and **3D asset coverage**.
7. V1 can succeed with representative geometry; exact reverse engineering and printable CAD are not claimed.
8. The existing application can be redesigned extensively without destroying trusted underlying systems.

**Retained from v2.0:** single canonical Build state; deterministic compatibility rules; full-diff proposals and confirmation; evidence and price provenance; persistent eight-slot logical model; dashed connector callouts even for empty slots; standard/exploded/review views; fallback and accessibility; saving/export; local AI workload roadmap.

## 0.2 Product and engineering decisions

| Decision | V3.0 commitment |
|---|---|
| Repo strategy | Same repository, fresh rebuild branch, never overwrite local uncommitted work |
| Rebuild scope | Redesign navigation, routes, page composition, UI components, AI entry paths and 3D shell; **selectively reuse** tested domain services |
| Product center | Inspiration-to-build with 3D interactive decision workspace |
| Primary V1 market | Consumer desktop PC builds, US / USD |
| Input modes | Image, natural language, text parts list, blank build |
| AI | Image interpretation, candidate generation, explanations, scoped proposal assistance |
| Exact part identity | Never inferred solely from visual resemblance |
| Source of compatibility truth | Validated specs + deterministic domain rules |
| 3D asset accuracy | Explicitly classified; illustrative models cannot certify physical fit |
| Purchasing | Decision support; no autonomous purchases |
| Public model export | Not required in V1; permission and geometry checks mandatory in later phases |
| Local AI workstation features | Separate P1/P2 expansion, not a reason to delay flagship consumer workflow |
| Monetization | Not a release prerequisite |

---

# 1. Executive Summary

## 1.1 Vision

**AIPC is an AI-assisted, visual-first PC building platform that turns inspiration into an editable, explainable, compatibility-aware PC configuration.**

**Core promise:** *See a PC you love. Turn it into a build you can actually make.*

## 1.2 Problem

PC inspiration often appears as photos, social posts, streams, or videos that contain little or no verified part information. Conventional parts planners expect a user to know the hardware models first. This creates a gap between **“I like this PC”** and **“I know what I can buy and assemble.”**

Related problems persist after parts identification:
- Visually similar parts have different sizes, prices, and capabilities.
- Much of a computer's hardware is hidden from a photo.
- Users struggle to compare substitutions without breaking an aesthetic.
- Traditional shopping lists make spatial relationships and missing parts hard to understand.
- AI recommendations can appear authoritative even when they rely on guesses or stale market data.

## 1.3 Proposed product

One connected workflow:

```text
INSPIRATION (photo / URL metadata / description / existing list)
    ↓
VISUAL ANALYSIS (what is actually visible?)
    ↓
CATALOG RETRIEVAL (candidate hardware and lookalikes)
    ↓
MATCH REVIEW (evidence, alternatives, uncertainty, user confirmation)
    ↓
EDITABLE BUILD DRAFT (verified / plausible / unresolved / empty)
    ↓
INTERACTIVE 3D BUILD WORKSPACE (standard / exploded / review)
    ↓
OPTIMIZE (preserve look / budget / performance / compatibility)
    ↓
CONFIRM CHANGES (diff + deterministic checks)
    ↓
SAVE / SHARE / EXPORT / SHOPPING PLAN
```

## 1.4 Differentiation hypothesis — not yet validated

**Visual inspiration → structured decisions → spatial exploration → executable build.**

The perceived competitor gap is a **hypothesis to validate**, not a factual claim of first-in-market status. AIPC should not market itself as “the first” without current competitor evidence. It may be differentiated by the *combination* of visual search, uncertain-identity review, compatibility-aware editing, and live 3D assembly linked to one Build state.

## 1.5 North-star outcome

**Decision-ready inspiration conversion:** a session begun from an image ends with a saved or exported Build whose part identities and uncertainties are transparent and whose applicable compatibility checks have been reviewed.

This is more meaningful than 3D views, clicks, or AI messages alone.

---

# 2. Users, Jobs to Be Done, and Use Cases

## 2.1 Primary persona: Inspiration-first builder

**Starting condition:** Sees an attractive PC photo but lacks a parts list.

**Job:** “Help me recreate this style in a PC I can afford and actually assemble.”

**Success:** Identifies a plausible case/layout, understands what cannot be learned from a photo, adjusts budget/performance, saves a concrete, explainable list.

## 2.2 Secondary persona: Experienced PC builder / modder

**Starting condition:** Knows many parts, wants style-matched substitution and spatial exploration.

**Job:** “Keep my preferred look while changing GPUs, coolers, fan layouts or chassis.”

**Success:** Confirms choices through comparison, rule checks, and a responsive 3D workspace.

## 2.3 Secondary persona: First-time / workload-oriented user

**Starting condition:** Provides intended use and budget instead of a reference photo.

**Job:** “Help me select and understand parts without requiring expert knowledge.”

**Success:** Receives guided recommendations, meaningful explanations, and an accurate record of unknowns.

## 2.4 Future persona: Local AI developer / small-team workstation buyer

Needs GPU VRAM, system memory, storage, power, PCIe and runtime feasibility. This is a later roadmap, not the flagship photo feature.

## 2.5 Core JTBD acceptance scenarios

- **UC-01:** From a photo of a white showcase build, retrieve case and fan candidates, show alternative matches, generate an editable Build draft, and inspect a representative 3D layout.
- **UC-02:** From an image with no readable GPU model, retain GPU as *unresolved* or propose suitable candidate(s), **without** asserting exact identity.
- **UC-03:** “Make it look similar but fit a $1,800 budget”: preserve user-selected visual priorities while proposing cheaper compatible components.
- **UC-04:** Replace a GPU in 3D; show full cost/compatibility/visual change preview before confirmation.
- **UC-05:** Build from text or start blank without using image AI or WebGL.
- **UC-06:** Follow a reference post containing a verified part list; import the stated parts as sourced text instead of pretending they were recognized from pixels.

---

# 3. Product Scope, Priorities & Release Strategy

## 3.1 Priority levels

- **P0 — V1 release critical:** required for a trustworthy flagship journey.
- **P1 — first expansion:** increases coverage and repeat use after baseline validation.
- **P2 — advanced:** richer geometry, maker tools and local AI specialization.
- **P3 — exploratory:** speculative business lines or complex automation.

## 3.2 Capability map

| Capability | Priority | V3.0 implementation interpretation |
|---|---|---|
| Fresh visual-first interface / information architecture | P0 | Rebuild UI while reusing domain APIs where possible |
| Image upload, preflight, preview, errors | P0 | One image; approved file types, privacy controls |
| AI visual observation schema | P0 | Capture visible features with crop/region and uncertainty |
| Catalog-backed visual matching | P0 | Bounded set of curated case, GPU, cooler, fan candidates |
| Candidate review and manual correction | P0 | Never auto-confirm ambiguous identity |
| Image-to-Build draft creation | P0 | Full unresolved/empty representation |
| Create from description / text parts import / blank build | P0 | Existing paths remain first-class |
| Canonical Build + proposals + revisions | P0 | Reuse/reconcile old domain implementation |
| Compatibility, completeness, evidence provenance | P0 | Distinct status dimensions |
| Interactive 3D standard / exploded / review | P0 | Representative geometry with logical slots |
| Dashed line labels for selected and empty slots | P0 | Persistent across scene rotation on desktop |
| 2D/3D sync and 2D fallback | P0 | Same domain state and actions |
| Preserve-Look / Budget / Performance suggestions | P0 | Rules-backed candidates; no unverified numerical promises |
| Save, compare, report, shopping plan | P0 | Honest price sources, revision snapshots |
| Consent, rate limits, image retention/delete | P0 | Protected uploads and operational hygiene |
| Support multiple images / social-source metadata | P1 | Legal and technical gating |
| Wider catalog and appearance embeddings | P1 | Measured coverage improvements |
| More accurate SKU-specific GLB asset variants | P1 | Rights, scale, placement verification |
| Style similarity explanation and controlled scoring | P1 | Validated with user feedback |
| Build sharing/inspiration gallery | P1 | Consent, moderation, provenance |
| 3D user-facing asset library and partial exports | P2 | Rights and geometry classification |
| Printable shell/adapter design workflow | P2 | CAD + measurements + manufacturing cautions |
| Local AI workstation planning | P1/P2 | Separate workflow and verification |
| Multi-GPU and small-team AI compute nodes | P2 | Further domain rules |
| Arbitrary photo → exact physical assembly | **Non-goal** | Not feasible without reliable source geometry |
| Fully automatic, verified per-SKU CAD reconstruction | **Non-goal** | No hidden structure claims |
| Autonomous third-party shopping or scraping | **Non-goal** | Terms, safety, price trust issues |
| General product reverse-engineering across categories | **Non-goal for AIPC** | Separate platform hypothesis after PC traction |

## 3.3 V1 success boundary

The V1 user can upload **one reference PC photo**, inspect visual findings, select/reject/keep unresolved suggested components, obtain an editable Build, view it in interactive 3D with persistent empty slots, replace a component, review compatibility and evidence, and save/export a decision. The same flow must remain usable in 2D when AI analysis or WebGL is unavailable.

V1 does **not** promise photographic reconstruction of the reference build, exact identity for hidden components, current prices for all results, or printable part geometry.

---

# 4. Product UX and Information Architecture

## 4.1 Top-level navigation

1. **Explore / Home** — primary “Build from an image” action with alternate inputs.
2. **My Builds** — saved and recently edited Builds.
3. **Build Studio** — 3D/2D workspace for editing, comparing and validating.
4. **Parts** — searchable, source-aware catalog and alternatives.
5. **Guides / Help** — interpretation limitations, basics, trust, 3D controls.

Do not create separate apps for image upload, configuration editor, 3D viewer and purchasing. Treat them as connected stages of the same Build journey.

## 4.2 Home / start page

Hero message: **See a PC you love. Build your version.**

Primary CTA: **Upload a PC Photo**. Secondary CTAs: **Describe Your Dream PC**, **Import Parts List**, **Start from Scratch**.

Support a sample image/demo mode for users who do not have a picture. Always label the sample Build as sample data. Avoid marketing claims about perfect identification or all-SKU pricing.

## 4.3 Image analysis and match review layout

Desktop: reference image and regions on left, recognized attributes and candidate chips/cards on right. User can review **Case → Visible GPU → Fans → Cooler → RAM / Motherboard (when visible) → Unknown components**.

For each candidate show:
- Candidate name, official identity when available.
- Why it matched (e.g. case front panel shape, side window, fan ring design).
- Source / catalog entry and visible visual evidence.
- Clearly labeled *confidence of appearance match*; **not** a probability of exact SKU identity unless calibrated.
- `Confirm`, `Try Another`, `Keep Unresolved`, `Not in Catalog`.

User must be able to proceed with unknowns.

## 4.4 Build Studio layout

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ AIPC     Build name         Inspiration / Specs / Compare       Save      │
├─────────────────┬─────────────────────────────────┬─────────────────────┤
│ Reference       │ Standard | Exploded | Review    │ Build summary       │
│ photo / goals   │                                 │ Budget / issues     │
│                 │ CASE ---------┐    ┌---- GPU    │ Selected part       │
│ Visual priorities                 [3D PC]         │ Candidate matches   │
│ ▣ Case          │ CPU ----------┘    └---- RAM    │ Replace / Compare   │
│ ▣ White theme   │ COOLER -------┐    ┌---- PSU    │ Evidence / warnings │
│ ▣ RGB layout    │ MB -----------┘    └---- SSD    │ Price provenance    │
│                 │                                 │                     │
│ Image / build   │ rotate | zoom | explode 0–100%  │ [Preview Change]    │
├─────────────────┴─────────────────────────────────┴─────────────────────┤
│ Build parts | Compatibility | Shopping | History | Export / Share        │
└───────────────────────────────────────────────────────────────────────────┘
```

This is an interaction specification, not a final visual design. Use a visually spacious desktop presentation rather than the previous text-heavy workbench. Visual direction: technical product studio, subtle animations, high-contrast information hierarchy, minimal persistent copy, and expandable detailed evidence.

**Required behavior:** selected part in 2D, 3D and details panel is the same; part replacement triggers a proposal before a domain mutation; the reference image is accessible without covering the 3D canvas.

## 4.5 Primary workspace modes

- **Standard:** assembled PC, default labels, editable slots.
- **Exploded:** synchronized spatial separation with controllable explosion degree; no Build mutation.
- **Review:** compatibility findings and unresolved claims linked to slots and evidence.
- **Focus/Isolate (sub-state):** display selected part and fade obstructing parts; preserve context.

A photo-inspired “visual fidelity” summary is an **additional panel**, not proof of exact matching.

## 4.6 Responsive behavior

- **Desktop:** full 3D scene, eight persistent logical slot callouts in normal unfiltered view, reference sidebar and candidate drawer.
- **Tablet:** smaller canvas, adaptive callouts, collapsible sidebars.
- **Mobile:** prioritized upload/match/Build flows, accessible slot list in place of requiring eight visible labels; optional 3D mode with easy disable.
- **Reduced motion:** snap or minimal transforms; keyboard support and descriptive 2D component list.

---

# 5. EP-00 — Existing-Repository Rebuild Audit & Safety

**Priority: P0. This must precede any destructive refactor.**

## Objective

Rebuild AIPC's *presentation and entry flow* in the same repository, preserving or migrating tested compatibility, structured parts, proposal and persistence behavior.

## Audit checklist

1. Confirm Git root, current branch, `git status`, untracked work, upstream refs and exact runtime.
2. Record a baseline commit hash; create a **new local branch** (suggestion: `rebuild/image-to-build-v3`) after preserving work.
3. Identify domains: Build, Part Catalog, identity resolver, replacement / compare, price providers, compatibility engine, persistence, auth, analytics.
4. Verify current dependencies and scripts rather than trusting this document. The v2.0 PRD listed TanStack Start, React 19, TypeScript, Tailwind, React Query, Supabase, OpenAI SDK, Zod and Vitest; these are **reported prior observations, not a live audit**.
5. Run current test/typecheck/lint/build baselines and record failures.
6. Inventory UI routes/components and identify replacement boundaries.
7. Inventory data tables and existing Build records. Create a migration/rollback plan *before* changing schemas.
8. Review secrets and upload storage policies before any image ingestion.
9. Write `docs/engineering/BASELINE_AUDIT_v3.md` and `docs/engineering/REUSE_DECISIONS.md`.

## Retain / replace / review decision matrix

| Subsystem | Default action | Rationale |
|---|---|---|
| Canonical Build state | **Retain / extend** | Prevent split-brain 2D/3D state |
| Compatibility rules | **Retain / test / extend** | Proven logic is an asset |
| Proposal, full-diff, confirm | **Retain / extend** | Safe mutation boundary |
| Provenance and price services | **Retain / audit** | Essential for user trust |
| Auth / persistence | **Audit and preserve data** | Prevent regression or loss |
| Old homepage / workbench UI | **Replace** | New visual-first product architecture |
| Design system / route composition | **Replace where needed** | Dense legacy experience not aligned with new flow |
| 3D viewer | **Build / re-architect** | Central workspace requires domain sync |
| Image analysis / visual retrieval | **New modules** | Not part of v2.0 baseline |
| Telemetry | **Extend / reconcile** | Track conversion and confidence failures |

Do not use `git reset --hard`, branch deletion, a new empty unrelated repository, destructive schema migration, or force push as part of this PRD's first batch. No remote changes without explicit authorization. The current repository must remain recoverable.

### Acceptance criteria

- Audit documents actual current local behavior and existing failures separately from new failures.
- Rebuild has a recoverable local starting point and stable baseline.
- An engineer can name exactly which legacy modules are reused, replaced or deferred.
- Previously saved Builds are not silently corrupted.

---

# 6. EP-01 — Image Input and Visual Understanding

**Priority: P0**

## US-101 — Upload and session creation

Requirements:
- Accept one reference image for V1 (`image/jpeg`, `image/png`, `image/webp`; validated by content rather than extension only).
- Validate a configurable compressed file-size and pixel-count cap; do not trust client preflight alone.
- Offer optional client-side resizing, EXIF location stripping, and a crop/rotate preview.
- Images are private by default; do not publish original uploads on share pages.
- The user can delete a reference image and initiate retention-policy cleanup.
- Show empty, processing, failure, rate-limited, unsupported and retry states.
- Treat image text, metadata and OCR-derived strings as **untrusted data**, never instructions.
- Uploaded image is not automatically an identifiable product or license to redistribute content.

## US-102 — Observation extraction

The vision model should produce **observations**, not unconstrained product claims:
- Case silhouette, orientation, side panel and visible structural markers.
- Theme/color/material, lighting type, visible fan positions and approximate count.
- Potential GPU/cooler/fan/board visual identifiers *if actually visible*.
- Occlusion and image-quality flags.
- Image regions or bounding boxes for evidence when model/provider supports them.
- `not_visible`, `uncertain`, and `contradictory` states.

**Non-visible parts (CPU, PSU, SSD, memory frequency, etc.) must remain unknown unless independently sourced.**

### Acceptance criteria

- An image with an occluded GPU must not yield an auto-confirmed exact GPU SKU.
- Poor-quality photos yield fewer, less assertive observations rather than fabricated identifiers.
- All visual assertions are traceable to an upload and optional evidence region.
- The UI indicates “AI estimate” rather than “verified product” for visual inference.

## US-103 — Multi-modal evidence rules

Product identity can come from the photo, text typed by the user, a caption explicitly provided by the user, or structured source documents. The system records each modality separately. A user-provided caption stating “RTX 5080” does **not** convert the GPU's photo-based identity into a visually verified model. Contradictions trigger review.

---

# 7. EP-02 — Appearance Retrieval, Candidate Ranking & Identity

**Priority: P0**

## 7.1 Catalog strategy

AIPC needs a **structured, curated PC part catalog**, not open-ended AI part inventions. For the first validated rollout, curate a bounded selection of common case shapes, GPU families, RGB fan systems and AIO coolers. Keep full spec coverage of CPU, motherboard, memory, storage and PSU for build feasibility where available, even if these are visually hidden.

Catalog schema must separate:
- `PartIdentity`: normalized model, brand, version, SKU, dimensions, socket, wattage, etc.
- `AppearanceProfile`: colors, geometry/shape tags, visual family, known photo references and visual embeddings when permitted.
- `CatalogProvenance`: manufacturer/user/retailer references, license and freshness.
- `VisualAsset`: exact or generic 3D asset, version, scale, anchor mapping, accuracy class and usage rights.

## 7.2 Retrieval pipeline

```text
Image observations → normalize features → retrieve candidate part families
→ filter by category / feasible dimensions when known
→ rank by appearance similarity and evidence quality
→ deduplicate near-identical variants
→ show 2–5 useful candidates per visible category
→ user selects / rejects / leaves unresolved
```

Candidate ranking should keep **visual similarity**, **identity evidence**, **data completeness** and **compatibility** as separate scores/signals. Do not collapse them into an opaque “92% exact match” unless there is a calibrated evaluation set validating such a probability.

## 7.3 Verified exact identity hierarchy (retained from v2.0)

1. Valid canonical ID in the user's existing Build or trusted import.
2. Verified manufacturer part identifier / approved SKU mapping.
3. Exact normalized identity with enough disambiguating attributes from reliable evidence.
4. Ambiguous candidate set requiring confirmation.
5. Unresolved identity.

Visual similarity alone **never** promotes a candidate to verified exact SKU.

## 7.4 Candidate review

Offer `Confirm this part`, `Show alternatives`, `Exclude`, `Keep unknown`, `Enter model manually` on each candidate. Confirmation creates a proposed identity state and then enters the Build through the normal confirmation workflow. Maintain both **the user's chosen candidate** and **the evidence on which it was proposed**.

### Acceptance criteria

- Lookalike components with different revisions stay distinct.
- An unrecognized case remains a visible unresolved case slot.
- High visual similarity does not imply confirmed actual owner hardware.
- Candidate ranking does not silently favor affiliate listings.
- Catalog unavailability does not block continuing to Build Studio.

---

# 8. EP-03 — Image-to-Build Draft & Unified Domain State

**Priority: P0**

## 8.1 Authoritative state principle

Exactly one canonical Build state controls 2D list, 3D scene, AI recommendations, compatibility, cost, shopping plan, persistence and exports.

**Never use the model's JSON response or 3D scene graph as authoritative part-selection state.**

## 8.2 Differentiate image evidence from user intentions

For image-born builds, store:
- `referenceImageId` and privacy status.
- `observations[]` tied to evidence regions.
- `candidateSets[]` and rank evidence.
- `visualPriorities[]`: e.g. white case, side window, vertical GPU, fan layout.
- `confirmedSelections[]` chosen by user.
- `assumedSelections[]` proposed by system solely to form a viable draft.
- `unresolvedSlots[]` and `emptySlots[]`.
- `requirements` (budget, performance, country, currency, intended workload).

A photo may initialize a **draft** with missing CPU, motherboard, storage and PSU. A build draft does not mean a complete, purchase-ready build.

## 8.3 Occupancy and identity are distinct

- Slot occupancy: `selected | unselected | unresolved`.
- Requirement: `required | conditional | optional`.
- Validation: `pass | warning | fail | unknown | not_checked`.
- Identity provenance: `verified | user_confirmed | model_inferred | imported_claim | unknown`.
- Geometry accuracy: `illustrative | reference_reconstructed | verified_asset`.

A confirmed candidate is confirmed as **the user's planned selection**, not necessarily identified as the exact original part shown in the photo.

## 8.4 All mutations follow the proposal pipeline

```text
Candidate action → domain proposal → full-build diff → rule check
→ explicit user confirm → expected-revision commit
→ recompute compatibility / cost → update 2D and 3D → decision ledger
```

Comparison, manual edits, image-derived selections and 3D slot actions call the same services.

## 8.5 Completeness and optimization

Do not call a build complete when required components remain empty or unknown. A style-preserving recommendation may select hidden components based on user goals, but those are **new proposed build parts**, not proof that they exist in the reference image.

### Acceptance criteria

- User can turn a photo into a draft with five or more unknown/unselected slots and still enter Studio.
- Canceling a candidate choice does not change the active Build.
- A stale image-analysis response cannot overwrite newer manual Build edits.
- Reopening saved Build reproduces the same selected/unknown identities; new asset versions only change presentation.

---

# 9. EP-04 — Interactive 3D Build Studio

**Priority: P0; flagship experience.**

## 9.1 Goals

The scene should help users understand layout, find missing components, interact with real build choices, inspect spatial relationships and preview substitutions. It is **not** required to exactly reconstruct an arbitrary uploaded photo in V1.

## 9.2 Essential V1 interactions (preserved from v2.0)

- Actual GPU-accelerated 3D scene; orbit, pan where sensible, zoom, reset camera.
- Standard, Exploded and Review modes.
- Eight logical slots: case, motherboard, CPU, cooler, GPU, memory, storage and PSU.
- Each logical slot has a **persistent 3D anchor and dashed connector line**, even if unselected.
- Unselected slots have ghosted placeholder geometry/card and `Add Part` action.
- Unresolved slots have *separate* visual treatment and `Review Match` action.
- Labels keep alignment during rotation; selected geometry and callout highlight together.
- Exploded parts interpolate with a 0–100% control; returning to assembled restores coordinates.
- Clicking a component reveals identity, alternatives, evidence, replacement and compatibility.
- Hidden/occluded components remain reachable from callouts/list.
- Existing Build actions and saved state survive failures in WebGL or asset loading.

## 9.3 Relationship to the reference photo

There are three explicit visual fidelity states:

1. **Generic layout:** stylized PC model sized and arranged by available part class/layout information.
2. **Appearance-informed:** case shape/colors/layout/fan positions chosen to resemble the reference when matching assets are available.
3. **Verified part geometry:** an appropriately licensed, measured exact asset with known scale and geometry mapping.

UI copy must not conflate **looks similar** with **is the exact SKU** or **physically fits**. A representative GPU box cannot certify actual clearance.

## 9.4 Scene Manifest

Scene metadata binds logical slots to anchors, transforms, asset keys, fallback meshes, exploded offsets, focus targets and license metadata. These manifests are **presentation-only** and versioned separately from Build domain records.

If an asset is missing, show fallback geometry, keep callout and preserve build operations.

## 9.5 Rendering approach

Candidate stack: Three.js + React Three Fiber + Drei where compatible, glTF/GLB assets, HTML/SVG overlay for projected callouts. Defer final library versions until the local repo audit. WebGL must initialize client-side only. Scene bundles are lazy-loaded; 2D operation is a first-class fallback.

## 9.6 Performance and interaction constraints

- Profile target desktop and mobile/reference machines before setting hard scene budgets.
- Aim for smooth interaction; provisional benchmark: **≥30 FPS** on an agreed reference laptop/desktop in an eight-slot representative scene.
- Avoid high-poly arbitrary model generation at V1 run time.
- Cache vetted shared assets and validate GLB sources.
- Restrict asset network requests to approved origins and paths.
- Avoid unnecessary state updates on every camera frame.
- Respect reduced motion and provide keyboard equivalents.

### Acceptance criteria

- Eight visible desktop callouts in normal full-view mode, including empty slots, without misleading overlap at tested widths.
- Each callout line follows its part anchor when camera rotates.
- A GPU click → Replace → Preview → Confirm updates both 2D list and 3D scene exactly once.
- Explode/assemble never mutates canonical Build data.
- Scene asset failure still permits part comparison and export.
- No element asserts exact physical clearance based only on illustrative meshes.

---

# 10. EP-05 — Visual Goals and Style-Preserving Recommendations

**Priority: P0 core, P1 refinement**

## 10.1 User goals

The user chooses an optimization intent:

- **Preserve the Look** — similar case silhouette, colors, cooling/RGB pattern.
- **Reduce Cost** — prioritize affordability, preserve explicitly locked visual traits.
- **Improve Performance** — target gaming/creator needs within constraints.
- **Balanced** — user-controlled tradeoff with clear explanations.

## 10.2 “Look lock” contract

`VisualPriority` captures a category (`case_shape`, `colorway`, `fan_layout`, `lighting`, `visible_gpu_aesthetic`, `cooler_position`, etc.), `weight`, whether it is `locked`, and its evidence source. Do not claim mathematically precise visual similarity without a validated human comparison study.

## 10.3 Alternative proposal

For each replacement, show separate impacts:

| Axis | Example representation |
|---|---|
| Visual | White exterior retained, fan-ring design changed |
| Hardware compatibility | Rules: 6 passed, 1 unknown; exact findings |
| Price | Difference when known, source and timestamp |
| Performance | Available benchmark evidence / unknown when unsupported |
| Physical fit | Checked dimensions, missing dimensions, unresolved clearance |

No recommendation may override a user-locked trait silently; impossible combinations must be explained with alternatives.

## 10.4 Context-aware AI role

Use LLM/vision selectively for input understanding, structured candidate descriptions and human-readable justifications. Source actual specs from catalog, compatibility from rule engine, prices from approved providers, and mutation outcomes from deterministic domain services. The AI is a planner/explainer, not the final authority.

### Acceptance criteria

- “Keep the white case” never triggers a black case selection without explicit override confirmation.
- “Make it cheaper” presents known tradeoffs, not fabricated price or FPS savings.
- AI response invalid schema or unavailable service falls back to rule-based/manual UI.

---

# 11. EP-06 — Import, Manual Build & Text Paths (retained)

**Priority: P0**

- Parse multiline or pasted parts lists into category, brand, model, quantity, optional user price.
- Preserve original text and warnings; classify unknown parts.
- Support exact-identity hierarchy and disambiguation queue.
- Let user start blank and add from slot cards.
- Support requirements wizard for users with no picture.
- Import preview must be confirmed before creating or modifying Build.
- Version-safe Build commit updates completeness, compatibility, budget, scene, shopping plan and decision ledger.
- CSV/JSON import can follow at P1.

AIPC must never require a reference image to access core PC planning.

---

# 12. EP-07 — Compatibility, Price Trust, Shopping, Save & Export

**Priority: P0**

## 12.1 Compatibility and completeness

Preserve separate statuses and versioned rule findings: rule ID, version, affected parts, result, evidence, missing inputs and next action. Physical-fit rules can pass only from supported dimensions, not visualized approximate mesh overlap. Power/headroom checks depend on actual catalog values and requirements.

## 12.2 Pricing

Retain explicit `seed`, `estimated`, `derived`, `stale`, `unavailable`, `unknown`, `user_provided`, and verified-current-offer provenance categories where supported by the existing domain. Report currency and timestamps. Tax/shipping unknown is not `$0`. Do not claim broad real-time pricing merely because a Best Buy pilot provider exists; v2.0 noted no verified production SKU mapping.

## 12.3 Shopping plan

List intended SKU, verified retailer reference if available, unresolved substitutes, known prices, unknown tax/shipping, compatibility warnings and evidence. Use external shopping links only from vetted sources; affiliate relationships must not secretly change recommendation order.

## 12.4 Save, export and share

- Save draft image-derived Builds without needing full identity resolution.
- Record selected items, requirements, appearance priorities, evidence summaries, revision and decision history.
- Export a readable Build report with uncertainties and fit/price disclosures.
- Shareable public Build pages are P1; only publish selected configuration and licensed media, never raw private reference images by default.
- Copy/CSV/JSON export remains useful without 3D asset bundles.

---

# 13. EP-08 — Privacy, Security, Licensing & Reliability

**Priority: P0**

## 13.1 Image privacy

Specify image retention and deletion policies before deployment, implement user-visible consent or notice for AI provider processing, and never imply private images are used for training without a documented basis. Strip metadata where possible, avoid public buckets, and protect access by session/user permissions. Provide a clear delete action and define retention for failed and abandoned jobs.

## 13.2 Input and model safety

- Validate actual MIME/magic bytes, dimensions and file-size ceilings.
- Reject or safely process malicious payloads and decompression bombs.
- Protect server endpoints against excessive requests and model costs.
- Never fetch arbitrary image URLs server-side without allowlisting/proxy and SSRF defense. Initial V1 can require file upload rather than URL ingestion.
- Sanitize captions and image-extracted text as data.
- Validate model JSON with runtime schemas (e.g., Zod).
- Never expose AI/provider secrets to the client.
- Avoid raw, untrusted GLB parsing paths; serve curated assets with known rights.

## 13.3 IP and downloadable models

Reference photographs can have third-party copyright. Manufacturer CAD, user-uploaded models, 3D assets and generated derivatives have different licenses. Showing reference imagery privately for matching does not imply the right to host/share/export the original or a proprietary 3D design. V1 does not provide downloadable manufacturer shell meshes by default.

## 13.4 Operational resilience

AI failure, inference timeout, empty catalog, rate limit, 3D load failure and price provider failure must be independently recoverable. Domain state changes only through validated transactions. Any third-party dependency degradation must not prevent viewing saved Builds or manually editing parts.

---

# 14. EP-09 — Optional Modding & Model Export Roadmap

**P2, subject to separate market discovery and license review.**

This retains the user's earlier idea of extracting shells, cases or accessories for rapid prototyping, **without making it a V1 engineering claim**.

## 14.1 Staged prototype roadmap

1. **View licensed modular part geometry:** exact or generic GLB, assembly and exploded view.
2. **Export eligible visual models:** GLB for visualization under asset-specific license checks.
3. **Editable accessories:** basic procedural non-critical mounts/panels with simple parameters.
4. **Manufacturing-oriented workflow:** STL/STEP export only if geometry is suitable and origin, measurement accuracy, units, tolerances, clearances and license are verified.

## 14.2 Distinguish formats

- **GLB/glTF:** visual mesh + scene transfer, not automatically manufacturable.
- **STL:** triangle mesh for print workflows; still requires manifold/watertight and dimensional verification.
- **STEP:** engineering geometry where available; cannot always be reliably derived from arbitrary AI meshes.

## 14.3 Maker safety note

Avoid promises that an AI-reconstructed part can safely replace structural, load-bearing, fire-rated, thermal or electrical components. User-facing design previews must distinguish exploratory visual meshes from engineered prototypes.

---

# 15. EP-10 — Local AI Workstation Lab (retained extension)

**P1 after flagship validation; advanced features P2.**

Users can supply model family, parameter count, quantization, context length, runtime, concurrent usage, OS, target latency and inference/fine-tuning intent. Output estimates: weights memory, KV cache, runtime overhead, VRAM/system RAM feasibility, storage, power, headroom and caveats. Distinguish *capacity* from *throughput*. Multi-GPU memory and compatibility require evidence-backed rules, not “sum VRAM” simplifications. The 3D Studio can later show GPU placement and cooling/PSU impact, but no scene mesh substitutes for board/case dimension checks.

---

# 16. Reference Data Contracts (implementation sketches)

> **Note:** Types below specify domain boundaries, not an instruction to recreate existing repository types. The baseline audit should map these to local schema and minimize duplication.

```ts
type EvidenceOrigin =
  | 'photo_observation'
  | 'user_statement'
  | 'imported_claim'
  | 'manufacturer_spec'
  | 'trusted_catalog'
  | 'derived_rule'
  | 'unknown';

type IdentityState =
  | 'verified_exact'
  | 'user_selected_candidate'
  | 'ambiguous'
  | 'unresolved';

type GeometryAccuracy =
  | 'illustrative'
  | 'reference_reconstructed'
  | 'verified_asset';

type SlotOccupancy = 'selected' | 'unselected' | 'unresolved';
type SlotRequirement = 'required' | 'conditional' | 'optional';
type ValidationStatus =
  | 'pass' | 'warning' | 'fail' | 'unknown' | 'not_checked';

interface VisualObservation {
  id: string;
  imageId: string;
  category: string; // e.g. case, GPU, fan, theme
  attribute: string; // e.g. colorway, visible-fan-count
  value: string | number | boolean | null;
  confidenceBand: 'high' | 'medium' | 'low' | 'unknown';
  visibleInImage: boolean;
  region?: { x: number; y: number; width: number; height: number }; // normalized 0–1
  explanation?: string;
  origin: EvidenceOrigin;
}

interface AppearanceCandidate {
  candidatePartId: string;
  category: string;
  rank: number;
  visualMatchBand: 'strong' | 'possible' | 'weak';
  matchedObservationIds: string[];
  missingEvidence: string[];
  identityState: IdentityState;
  catalogSourceIds: string[];
}

interface VisualPriority {
  key: string; // case_shape | colorway | fan_layout | ...
  desiredValue: string;
  weight: number; // normalized by recommendation engine
  locked: boolean;
  evidenceObservationIds: string[];
}

interface ImageBuildDraft {
  draftId: string;
  uploadId: string;
  analysisVersion: string;
  observationIds: string[];
  candidateSets: Record<string, AppearanceCandidate[]>;
  visualPriorities: VisualPriority[];
  unknownCategories: string[];
  userSelections: Record<string, string | null>;
  proposedRequirements: Record<string, unknown>;
}

interface SceneSlot {
  slotId: string;
  category: string;
  requirement: SlotRequirement;
  occupancy: SlotOccupancy;
  validation: ValidationStatus;
  canonicalPartId: string | null;
  proposedPartId?: string | null;
  identityState: IdentityState;
  assetKey?: string | null;
  geometryAccuracy: GeometryAccuracy;
  anchorId: string;
  findingIds: string[];
}

interface VisualAssetRecord {
  assetKey: string;
  catalogPartId?: string;
  geometryAccuracy: GeometryAccuracy;
  units: 'm' | 'cm' | 'mm';
  scaleVerified: boolean;
  licenseId: string;
  mayRender: boolean;
  mayRedistribute: boolean;
  mayDownload: boolean;
  version: string;
}

interface BuildOrigin {
  kind: 'image' | 'text' | 'manual' | 'description';
  referenceId?: string;
  draftId?: string;
}
```

**Mandatory invariants:**
1. `imageBuildDraft` is not the Build authority.
2. Photo observation confidence is distinct from exact part identity evidence.
3. A user's choice is a *planned part* even when the photo's original part remains unidentified.
4. 3D `geometryAccuracy` is never promoted to compatibility truth.
5. An unresolved component must not silently disappear or become an empty slot.
6. A fixed schematic layout must not imply verified exact fit.

---

# 17. Logical APIs & Jobs

The specific route names must be reconciled with current TanStack Start server handlers. Do not create parallel routes if existing actions already provide a suitable contract.

| Operation | Suggested logical contract | Notes |
|---|---|---|
| Upload image | `POST /api/reference-images` | Auth/guest session, content validation, private object key |
| Begin analysis | `POST /api/image-analyses` | Idempotency key; returns `analysisId` and state |
| Read analysis | `GET /api/image-analyses/:id` | No false completed status; source observation references |
| Retrieve candidates | `POST /api/part-matches` | Candidate set with scores/bands and evidence |
| Review candidate set | `POST /api/image-build-drafts/:id/review` | User selected / rejected / unresolved |
| Preview draft conversion | `POST /api/builds/from-image-preview` | Validation, unresolved slots, budget estimate when data known |
| Confirm draft | `POST /api/builds/from-image-confirm` | Revision-safe, idempotent, creates canonical Build |
| Preview change | Existing proposal endpoint preferred | Full-build changes and evidence |
| Confirm change | Existing confirm endpoint preferred | Domain-side validation and expected revision |
| Read Build | Existing Build endpoint preferred | 3D derives SceneSlot data from Build |
| Delete reference | `DELETE /api/reference-images/:id` | Session authorization, retention/cleanup semantics |

Async vs sync analysis is an implementation choice; UI must support processing/polling/timeout/partial candidates. Use temporary signed object references where needed and avoid leaking uploads in public URLs.

## 17.1 Example request/response (illustrative)

```json
{
  "referenceImageId": "image_123",
  "market": "US",
  "currency": "USD",
  "userGoal": "similar white build under 1800 USD"
}
```

```json
{
  "draftId": "draft_456",
  "analysisStatus": "needs_review",
  "observations": [
    {"category":"case","attribute":"colorway","value":"white","confidenceBand":"high","visibleInImage":true}
  ],
  "candidateSets": {"case": [{"partId":"catalog_case_A","matchBand":"possible"}]},
  "unknownCategories": ["cpu","storage","psu"],
  "userConfirmationRequired": true
}
```

No server response should invent a price, SKU, exact geometry or compatible status to fill a missing field.

---

# 18. Detailed Interaction State Machines

## 18.1 Image flow

```text
EMPTY → FILE_SELECTED → VALIDATING → UPLOADING → ANALYZING
 → OBSERVATIONS_READY → CANDIDATES_READY → REVIEWING
 → DRAFT_PREVIEW → USER_CONFIRM → BUILD_CREATED → STUDIO

Error branches: INVALID_FILE / UPLOAD_FAILED / MODEL_UNAVAILABLE /
               MATCH_EMPTY / RATE_LIMITED / EXPIRED / USER_CANCELLED
```

All failure branches retain a path to manual Build, retry and explain the limitation.

## 18.2 Component change flow

```text
SELECT_SLOT → SEARCH_CANDIDATES → SELECT_CANDIDATE
 → PREVIEW_PROPOSAL → [CONFIRM | CANCEL]
 → VALIDATE_EXPECTED_REVISION → COMMIT → SYNC_2D_3D

Stale Build → CONFLICT → REGENERATE_PROPOSAL
```

## 18.3 Scene fallback

```text
SCENE_LOADING → SCENE_READY
      ↘ FAILED_OR_UNSUPPORTED → 2D_EDITOR_AND_SLOT_LIST
```

The Build transaction is independent of renderer state and must not be undone just because the scene fails afterward.

---

# 19. Evaluation, Quality Gates & Analytics

## 19.1 Product metrics

**Primary:** `Image-to-Decision-Ready Build Conversion Rate`.

**Funnel:** image submitted → analysis completed → at least one candidate reviewed → Build draft created → Build saved/exported → shopping intent (only when evidenced).

**Diagnostic measures:**
- Ambiguous / unresolved match rate by part category.
- User-corrected top candidate rate.
- Percentage of proposed candidates accepted vs rejected.
- Photo-to-build abandonment by stage.
- Cases where users disagree with “preserve look” alternatives.
- 3D component focus, exploded mode, replacement and empty-slot click adoption.
- 2D/3D mismatches and fallback usage.
- Compatibility finding comprehension and price provenance errors.
- Cost per image analysis and per saved decision-ready Build.

## 19.2 Initial research plan

Conduct an exploratory study of **8–12 participants**, not as a statistical guarantee. Recruit both inspiration-first novices and experienced builders. Compare:

- Baseline path: existing parts list / manual Build.
- New path: upload photo → candidates → Studio.

Tasks: identify case/cooler from sample, spot uncertain components, preserve the look under a budget, change one component, explain what is **verified vs estimated**, export a Build. Track task success, time, self-reported confidence, correction rate and confusion. Include deliberately ambiguous photos.

## 19.3 Offline test fixtures

Create a lawful curated evaluation set (images and metadata with usage permission), including:
- Clear case / readable branding.
- Generic all-white glass case with many near-identical models.
- Occluded GPU and fully hidden PSU/CPU.
- Low-light RGB photo.
- Cropped social screenshot with UI text overlays.
- Partial side view.
- Contradictory user caption.
- Unknown catalog case.
- Non-PC image / unsupported input.

For each fixture, record what can **reasonably** be observed, known ground-truth part list when actually available, and expected uncertainty. No requirement to identify hidden components from pixels.

## 19.4 Test suites

**Unit:** schema validation, visual observation normalization, identity resolution, rank ordering, unknown propagation, compatibility, revision-safe proposals, image data lifecycle and asset license flags.

**Component/UI:** image error states, candidate correction, unselected vs unresolved slots, dashed connectors, callout alignment, preview/cancel, appearance lock, keyboard navigation.

**E2E:**
1. Image → observations → review → draft → 3D → save.
2. Ambiguous lookalike case → user correction → Build reflects chosen model.
3. Unknown GPU and PSU remain unknown; engine cannot emit overall “all clear”.
4. Replace GPU in scene → diff → confirm → 2D and 3D synchronized.
5. Cancel replacement → no changed Build revision.
6. Unsupported WebGL → fully usable 2D flow.
7. Expired image job / rate limit / AI unavailable → manual fallback.
8. Stale proposal conflict handled, never silently overwritten.
9. Restore old v2.0-format saved Build through migration adapter if such records exist.
10. Unauthorized image deletion/access blocked.

**Engineering checks:** existing `typecheck`, tests, lint, build, browser E2E and accessibility checks. Commands must be validated against actual package scripts during EP-00.

## 19.5 Proposed release targets (validate, do not invent results)

Suggested initial engineering targets, **not observed benchmarks**:
- 100% of the eight V1 logical slots available in an unfiltered desktop scene and accessible 2D list.
- 0 silent commits from image AI or preview-only actions.
- 0 verified-exact part identities assigned solely from photo similarity.
- 0 sampled estimated prices labeled as live offers.
- 0 image-derived 3D visuals presented as verified physical-fit results.
- ≥30 FPS basic interaction on agreed test device with representative V1 scene, subject to measured revision.

After testing, set quantitative thresholds for image parsing speed, candidate precision/recall, completion rate and render performance using empirical baselines rather than arbitrary marketing numbers.

---

# 20. Rebuild Implementation Batches

**Implementation principle:** Build vertical slices in a **fresh local branch** of the same repository. After every batch, preserve a runnable state and a written test record. No push, merge or deployment without explicit authorization.

## R0 — Baseline / Branch / Reuse Decision (P0)

**Inputs:** existing local repo, v2.0 PRD and this document.  
**Tasks:** Git audit; preserve uncommitted work; run current quality checks; identify reusable domain modules; inventory schema and saved Build migrations; define feature flags and branch strategy.  
**Exit:** `BASELINE_AUDIT_v3.md`, `REUSE_DECISIONS.md`, passing or documented current build baseline, recoverable history.

## R1 — Design System & New App Shell (P0)

**Tasks:** redesign navigation and homepage; implement Upload / Describe / Import / Blank entry paths as functional screens; create Build Studio page structure; establish responsive and accessible tokens; keep current Build state accessible through adapters.  
**Exit:** users can navigate new shell; manual/legacy flow is not lost; placeholder/fake “success” actions are never presented as working AI.

## R2 — Canonical Build Studio & 3D Skeleton (P0)

**Tasks:** 3D library compatibility check; representative tower scene; eight anchors and dashed lines; standard/exploded/review; click/focus/isolate; empty/unresolved status; connect existing proposal/confirm services; fallback.  
**Exit:** a fixed test Build can be edited in 3D and 2D with exactly the same authoritative result.

## R3 — Image Analysis Vertical Slice (P0)

**Tasks:** file upload, storage permissions, image lifecycle, AI observation schema, server validation, asynchronous/error handling, fixture tests and evidence regions where supported.  
**Exit:** one curated image returns explainable *observations* without pretending to know hidden parts.

## R4 — Visual Catalog Retrieval & Candidate Review (P0)

**Tasks:** appearance metadata model, curated candidate seed catalog, ranking logic, identity boundary, candidate review UI, correction and unknown flow.  
**Exit:** an ambiguous image produces plausible *alternatives*, and user can confirm/reject/leave unresolved.

## R5 — Photo-to-Build + Look-Preserving Editing (P0)

**Tasks:** translate reviewed candidates and unknowns into draft Build, collect visual priorities, allow budget/performance goals, preview candidate replacements, reuse deterministic compatibility.  
**Exit:** image-born draft → editable 3D Build → one confirmed style-conscious replacement → updated shopping plan.

## R6 — Integration, Trust & Save/Export (P0)

**Tasks:** stabilize source provenance, compatibility review, saved Build migration, report/export, shopping links, analytics events, privacy and deletion controls.  
**Exit:** an image-first user can finish a clear, decision-ready workflow with accessible fallback.

## R7 — Pre-Release Validation (P0)

**Tasks:** full tests, E2E, browser/device checks, visual regression, 8–12 person exploratory validation, performance profiles, risk review, user onboarding and truthful disclosures.  
**Exit:** release checklist satisfied **locally**; separate approval required for staging/production.

## R8 — Expansion (not release blocking)

Catalog breadth, manufacturer models, better appearance scoring, gallery/sharing, local AI workload studio, user-owned model imports, selected GLB exports and experimental modding.

## Dependencies

```text
R0 audit → R1 shell → R2 state-connected 3D
                       │
          R3 analysis → R4 retrieval → R5 photo-to-build
                       │                 │
                       └─────────────────┘
                                    ↓
                               R6 trust/export
                                    ↓
                               R7 validation
                                    ↓
                              [approval gate]
                                    ↓
                               staging / release
```

R2 and R3 can be developed in parallel **after** canonical state contracts are settled, using deterministic fixtures for early UI.

---

# 21. Implementation Architecture and Proposed Directories

Exact paths depend on EP-00, and duplicate services must not be created just to match this illustration.

```text
src/
  routes/
    index (new inspiration-first home)
    studio / build pages
    my-builds
  features/
    reference-images/
      upload / preflight / retention
    image-analysis/
      vision-adapter / schemas / observation-evidence
    visual-search/
      appearance-index / candidate-retrieval / identity-resolution
    image-build/
      draft-mapper / review-workflow / visual-priorities
    build-domain/              # prefer existing domain services
      canonical-build / proposals / compatibility / price-provenance
    build-studio/
      workspace / detail-panels / comparison / shopping
    build-3d/
      scene / anchors / dashed-callouts / assets / focus / explode
  shared/
    ui / errors / security / analytics

docs/
  product/
    AIPC_PRD_v3.md
    USER_FLOWS_v3.md
  engineering/
    BASELINE_AUDIT_v3.md
    REUSE_DECISIONS.md
    ARCHITECTURE_v3.md
    IMAGE_ANALYSIS_CONTRACTS.md
    BUILD_STATE_CONTRACTS.md
    SCENE_3D_CONTRACTS.md
    PRIVACY_AND_ASSET_POLICY.md
    RELEASE_GATES_v3.md
  milestones/
    R0_AUDIT.md ... R7_VALIDATION.md
```

One direction of data flow should be maintained:

```text
Photo → Observation Service → Candidate Retrieval → User Review
    → ImageBuildDraft → Build Proposal/Commit → Authoritative Build
                                                  │
               ┌──────────────────────────────────┼────────────────────────┐
               ↓                                  ↓                        ↓
          2D Workbench                         3D Scene               Shopping/Report
               │                                  │                        │
               └────── User actions → Proposal Engine → Confirm ──────────┘
```

Adapters may translate old saved Builds to new presentation contracts. Do not migrate existing domain entities without an explicit data contract reason and migration tests.

---

# 22. Design & Content Guidelines

- Default screen must be **visual and task-focused** rather than filled with blocks of explanatory copy.
- Always give users a meaningful primary action.
- 3D callouts are concise; full evidence sits behind details.
- Technical labels should be scannable: `GPU`, `Likely match`, `Unknown`, `Replace`, `Why?`.
- Use motion to explain assembly and selection, not to slow the task down.
- Important issues use text/icon semantics, never color alone.
- Clear distinctions: “Photo suggests …” vs “You selected …” vs “Manufacturer confirms …”.
- Accessible keyboard actions for each part; 2D list is not a degraded or lesser-trust experience.
- Provide example/canned build mode on first visit, explicitly marked `Demo`.
- Do not copy proprietary game UI assets or other tools' original presentation assets.

---

# 23. Commercial and Growth Strategy (non-blocking)

**First validate:** Users return with inspiration images, correct candidate parts, and save useful Builds. Then explore:

1. Affiliate shopping recommendations, transparently disclosed.
2. Optional advanced visual/style and comparison tools.
3. Premium export / maker workflows for user-owned or licensed 3D assets.
4. Creator Build pages, shareable configurations and collaborations.
5. Expert review / assembly partners.
6. Local-AI workstation planning or B2B decision tools.

Do not prioritize monetization over evidence and user trust. Do not promise manufacturer CAD access before rights and availability are established.

---

# 24. Risk Register & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Photo cannot reveal hidden components | High | Explicit unknown slots; user review; performance recommendations treated as new selections |
| Incorrect SKU recognition | High | Candidate lists, disambiguation, verified identifier hierarchy, user correction |
| Small visual catalog | High | Curated supported families, honest no-match, expand by measured failures |
| 3D misleading physical accuracy | High | Geometry accuracy badges, rules-backed fit, asset source disclosure |
| UI rebuild damages stable domain logic | High | R0 baseline, selective reuse, adapters, regression tests |
| Existing saved Builds break | High | Data migration plan, fixtures, rollback checks |
| Image privacy / unauthorized access | High | Private storage, access controls, retention/delete, rate limits |
| Model hallucinations in product spec | High | Schemas, retrieval grounding, unknown handling, no direct Build mutation |
| Licensed models / third-party images | High | Rights registry, render/export restrictions, no implied redistribution rights |
| Performance on weaker devices | Medium | Lazy-load 3D, asset LOD, manual 2D fallback |
| Stale prices | High | Source timestamp, TTL, estimates vs current offer separation |
| Unfair affiliate ranking | Medium | Separate relevance from commission, disclose sponsorship |
| Long development scope | High | Narrow V1, batches, no arbitrary-product reconstruction or CAD in P0 |

---

# 25. Definition of Done and Release Checklist

## Build and AI
- [ ] Four entry paths function: image, text description, parts import and blank build.
- [ ] Reference image preflight/upload states work with privacy controls.
- [ ] Image observations mark visible vs unknown correctly on curated fixtures.
- [ ] Candidate list supports select, alternatives and keep unresolved.
- [ ] A reviewed candidate set converts to canonical Build only after confirmation.
- [ ] Saved image-born Builds retain visual priorities and unknowns.
- [ ] No identity is silently verified from visual similarity alone.
- [ ] Replace preview and confirmation use existing safe domain transactions.
- [ ] Compatibility, price and performance disclosures are grounded.

## 3D
- [ ] Actual rotatable/zoomable 3D scene.
- [ ] Eight primary logical anchors and dashed connectors visible in normal desktop mode.
- [ ] Selected, unselected and unresolved states represented separately.
- [ ] Standard, Exploded, Review and Focus/Isolate work.
- [ ] Replace in 3D updates 2D and Build revision identically.
- [ ] Scene falls back gracefully to 2D without data loss.
- [ ] Geometry accuracy clearly labeled; no false physical-fit claim.
- [ ] Reduced-motion, keyboard and mobile interaction supported.

## Engineering / deployment
- [ ] R0 repository audit and reuse plan documented.
- [ ] Baseline tests and new tests pass (or preexisting failures clearly documented).
- [ ] Privacy, retention, deletion, cost/abuse controls verified.
- [ ] No external asset is used/exported outside its license.
- [ ] E2E image-to-Build and image failure/manual fallback run.
- [ ] V1 flows measured in a small user study and findings recorded.
- [ ] Build/report usable without AI and WebGL.
- [ ] No current live-price or physical-fit claims absent supporting evidence.
- [ ] Local deliverable and rollback instructions recorded.
- [ ] No push, merge or deployment until separately and explicitly approved.

---

# 26. Development-Agent Execution Contract

> Copy into the implementation agent's instructions **only after** the local repository is available and R0 begins.

You are rebuilding the **existing** `CarlShi6/ai-pc-build-advisor` product experience according to AIPC Engineering PRD v3.0. The new flagship journey is **Image-to-Build → interactive 3D editing → compatibility-aware decision**. Do not create a new unrelated repository.

**Non-negotiable rules:**

1. Inspect the exact local repository and its Git status before writing code.
2. Preserve uncommitted work and establish a recoverable local rebuild branch.
3. No push, merge, deployment, force push, history rewrite or destructive DB migration without explicit permission.
4. Keep a single authoritative canonical Build state.
5. Reuse verified compatibility, proposal, price provenance and persistence services unless a documented technical reason requires replacement.
6. Use AI only for proposals and interpretation; never trust an image inference as verified hidden hardware or allow it to mutate state unconfirmed.
7. Treat appearance similarity, exact identity, price evidence, and geometry fidelity as separate concepts.
8. Keep all eight primary 3D logical slots, including dashed callouts for empty slots.
9. Do not assert physical fit from illustrative geometry.
10. Keep 2D/manual capability available if AI or WebGL fails.
11. Test domain invariants, UI actions, E2E image flow and data migrations.
12. For each batch: inspect → plan → implement → test → report files, outcomes, limitations and next steps.
13. Prefer a coherent, staged end-to-end vertical slice over isolated visuals or disconnected demo components.
14. Never report a planned or mocked capability as fully implemented.

**Start with R0; do not immediately delete legacy components.**

---

# 27. Final Product Definition

**AIPC helps users transform a PC photo, idea or part list into an editable and evidence-backed computer Build, then inspect, customize and validate that Build through a connected interactive 3D workspace.**

The product's distinguishing claim is **not** “AI can perfectly reverse-engineer a computer from one photograph.” It is:

> **From visual inspiration to an explainable PC you can actually plan, customize and build.**

The V1 ends when the reference image becomes a trustworthy *starting point* for a real PC decision—not when a pretty animation plays.

---

## Appendix A — Mapping v2.0 to v3.0

| V2.0 section / epic | V3.0 destination |
|---|---|
| Executive Summary, Product Vision | Sections 1–3, photo-first positioning |
| Implementation Baseline / EP-00 | Section 5, broadened into same-repo rebuild audit |
| Import & Identity Resolution / EP-01 | Sections 7, 8, 11 |
| Unified Build & Transactions / EP-02 | Section 8 + data contracts |
| Compatibility / EP-03 | Section 12 |
| 3D System / EP-04 | Section 9, flagship Studio |
| AI Assistance / EP-05 | Sections 6, 7, 10 |
| Shopping/Persistence/Export / EP-06 | Section 12 |
| QA / EP-07 | Sections 19 and 25 |
| Local AI Workload Lab / EP-08 | Section 15 |
| Implementation Batches B0–B6 | R0–R8; added photo/retrieval vertical slices |
| Versioned Scene/Slot contracts | Sections 9 and 16 |
| Security/Accessibility/Analytics | Sections 13, 19, 22 |
| Product Decisions / Final Definition | Sections 0, 27 |

## Appendix B — Explicitly open research decisions

These are not blockers to R0/R1, but they must be resolved with evidence before production:

- Which PC categories and exact visual families are in the first curated catalog?
- What image-model/provider stack gives the best region-level observations at acceptable cost?
- Are embeddings needed for the first 20–100 cases, or is attribute-based retrieval sufficient?
- Which manufacturer or licensed 3D assets can legally be redistributed vs shown only?
- What image retention, deletion and consent details satisfy the intended launch environment?
- What sample fixtures and measured user tasks define “looks similar enough”?
- How should the photo be compared against a stylized 3D build without implying exact fidelity?
- Which exact existing schema, routes and tests can be reused after local audit?

**This PRD intentionally does not claim those questions have already been answered.**
