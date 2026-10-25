# AIPC v3.0 — Safe Same-Repository Rebuild Kickoff Prompt

Use together with `AIPC_Engineering_PRD_v3.0_Image_to_Build_Rebuild.md`.

## Task

You are working with my **existing** AI PC Build Advisor local repository, associated with `CarlShi6/ai-pc-build-advisor`. I want a substantial product/UI rebuild **inside the same repo**, not a brand-new product repository. Follow the attached AIPC Engineering PRD v3.0 as the product and engineering source of truth.

The new flagship user experience is:

**Reference PC photo → AI observations → catalog-supported part candidates → user confirmation → editable Build draft → 3D interactive Build Studio → compatibility-aware substitutions → save/export/shopping plan.**

The 3D scene must include all eight primary hardware slot anchors, persistent dashed callout connectors **even for empty slots**, Standard/Exploded/Review modes, and interaction with the *same* canonical Build state used by the 2D UI.

## Critical safety rules

- **LOCAL ONLY**. Do not push, deploy, merge, force-push, delete remote branches, or rewrite Git history.
- **Before changing any code**, inspect the local repo and `git status`. Do not discard uncommitted or untracked work.
- Do not run `git reset --hard`, `git clean -fd`, or destructive database/schema operations.
- Prefer creating a new local branch, e.g. `rebuild/image-to-build-v3`, once the existing working tree is safely accounted for.
- Do not clone into a completely new unrelated repository to evade migration questions.
- **Preserve or selectively reuse** compatibility validation, canonical Build domain models, part/identity resolution, proposal/confirmation transactions, pricing provenance, persistence and their tests if sound. Do not duplicate these services.
- Image AI cannot assert hidden CPU/PSU/SSD SKU identity or prove fit. Mark uncertainty and request user confirmation for ambiguous visual candidates.
- A 3D model is a visual representation, not a substitute for validated physical clearance rules.
- Keep manual and 2D flows functional when AI and WebGL are unavailable.

## First run: R0 baseline audit only

1. Verify current repo path, branch, uncommitted changes, configured remotes, and actual package scripts/dependencies.
2. Identify the existing UI structure, route framework, Build state, domain services, compatibility tests, 3D dependencies, catalog/pricing integrations, persistence schema and current defects.
3. Run the relevant existing tests/typecheck/lint/build commands, recording baseline pass/fail without “fixing” unrelated failures first.
4. Propose a **reuse / replace / adapt / defer** matrix by module, with exact file paths.
5. Propose the safest rebuild branch and data migration strategy. Preserve current Builds and uncommitted work.
6. Create or update locally:
   - `docs/engineering/BASELINE_AUDIT_v3.md`
   - `docs/engineering/REUSE_DECISIONS.md`
   - `docs/engineering/ARCHITECTURE_v3.md` (initial proposal)
   - `docs/milestones/R0_AUDIT.md`
7. Give a clear R1–R7 milestone plan grounded in what the repo actually contains, indicating realistic dependencies, risks and smallest runnable slices.
8. **Stop after R0** and report audit results. Do not delete or rewrite the frontend yet. Do not push or deploy.

## Output format

Report: current path and branch; Git safety status; existing reusable components with paths; replace candidates with paths; baseline test results; schema and saved-Build risks; proposed v3 architectural interfaces; R1 implementation slice; files changed; whether any assumptions from PRD v2.0 were contradicted by the actual local repository.

## Second run, only after R0 review

Begin R1 (new app shell and Image/Describe/Import/Blank entry pages). Keep functional routes and domain logic working. Then continue by bounded PRD batches, testing every completed vertical slice. Prefer real working interactions over mock controls and do not report a placeholder as implemented.
