# R2 — Shared Build Studio and representative 3D scene

Status: local vertical slice implemented on `rebuild/image-to-build-v3` (2026-10-25). The fixed Build edit and 2D/3D sync exit path works in the browser. This is representative geometry, not an exact hardware model or a physical-fit check.

## Delivered

- The Studio renders eight persistent logical slots from the same `BuildDocumentV3` as the 2D list and detail panel. Empty and unresolved slots remain visible.
- Three.js via React Three Fiber provides a client-only, lazy-loaded WebGL tower scene. Each slot has a selectable mesh, projected DOM label, and dashed connector. Users can orbit, pan, zoom, reset the camera, switch standard/exploded/review modes, and adjust the exploded distance.
- A 3D label or mesh selects the same slot as the 2D list. Selecting or removing a catalog part produces a preview with price and compatibility status before confirmation. The active document changes once on confirmation; the other view reflects the same part and revision.
- Draft completeness is independent from legacy compatibility status. Empty slots display `Incomplete`; the scene and totals explicitly disclose illustrative geometry and seed prices.
- WebGL detection, lazy-load error boundary and a manual 2D switch preserve the editable slot list if 3D is unavailable.
- DOM labels replace the initial Three `Html` portal approach, which produced React unmount errors during route changes in development. The revised scene was reloaded and all eight labels returned without a new console error.

## Verification

- Browser: blank draft showed 0/8; a GPU chosen from a 3D label did not change the draft before confirmation, then appeared in both 3D and 2D at 1/8. Exploded controls and 2D fallback were exercised. Exact import kept an unmatched GPU unresolved alongside a selected CPU; all eight scene labels remained visible after reload.
- Browser evidence: [R2 Studio screenshot](R2_STUDIO_BROWSER.png). The My Builds empty state and route were also checked. No new console error appeared after the DOM-label revision.
- `npm run typecheck`, `npm run build`, 113 tests across 15 files, and scoped ESLint passed after the final scene revision. Full-repository lint still has the line-ending baseline recorded in R0.

## Remaining contracts

- Revision checks currently guard a browser-tab draft. The server must enforce expected revision, recompute rules, and atomically store the decision record in R6. Existing saved Builds are read through the legacy API; new v3 drafts are not saved yet.
- Review mode highlights rules-linked parts where legacy warnings identify them, but does not isolate components or certify geometric clearance. Detailed geometry, asset provenance, licenses and physical dimensions need a dedicated asset pipeline.
- Image observations and catalog retrieval are R3/R4 work. The current photo entry is a local file preview and manual draft path.
- Performance and small-screen usability need device-level validation before release.
- The lazy 3D client chunk is roughly 966 KB before compression (261 KB gzip) and triggers Vite's large-chunk warning; measure real device load and split further if needed.
