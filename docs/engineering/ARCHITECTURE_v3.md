# Proposed v3 architecture (R0)

This is an initial interface proposal grounded in the current TanStack Start repository. It is not a claim that these interfaces already exist.

## Data flow

```text
Image upload → observations → catalog candidates → user review
                                                   ↓
Description / text list / blank → draft mapper → Build proposal → confirm(expectedRevision)
                                                            ↓
                                             versioned authoritative Build
                                            /        |         |          \
                                      2D editor  3D scene  save/export  shopping
```

TanStack route loaders/actions and `src/lib/api-router.ts` can expose the new services while the existing endpoints remain. Keep server validation for all commits. Client Build state is a cached view of the same revisioned document; scenes never own part selections.

## Boundary contracts to establish in R1/R2

```ts
type SlotId = "case" | "motherboard" | "cpu" | "cooler" | "gpu" | "memory" | "storage" | "psu";
type Occupancy = "selected" | "unselected" | "unresolved";
type IdentityBasis = "verified" | "user_confirmed" | "model_inferred" | "imported_claim" | "unknown";

interface BuildDocumentV3 {
  schemaVersion: 3;
  id: string;
  revision: number;
  legacyBuild: Build; // migration bridge; evolve into normalized domain fields
  slots: Record<SlotId, { occupancy: Occupancy; partId?: string; identityBasis: IdentityBasis }>;
  requirements: { budget?: number; currency: "USD"; useCases: string[] };
  reference?: { imageId?: string; privacyStatus: "private" | "deleted"; observationIds: string[] };
  visualPriorities: Array<{ trait: string; weight: number; locked: boolean; evidenceId?: string }>;
}

interface BuildProposal {
  baseRevision: number;
  candidate: BuildDocumentV3;
  changedSlots: SlotId[];
  priceDiff: unknown; // source-aware, unknown allowed
  compatibilityDiff: unknown; // pass/warning/fail/unknown/not_checked
  completenessDiff: unknown;
  evidence: unknown[];
}

interface BuildMutationService {
  propose(current: BuildDocumentV3, action: BuildAction): BuildProposal;
  commit(id: string, expectedRevision: number, confirmedProposal: BuildProposal): Promise<BuildDocumentV3>;
}
```

`legacyBuild` is an explicit migration bridge, not a final duplicate source of truth: until normalized slots become authoritative, derive them from the old Build and write through a single adapter. Resolve this boundary with migration fixtures before implementing 3D. The final domain service must not allow `parts[]` and `slots` to diverge.

## Service ownership

- **Build domain:** extend `src/types/build.ts`, `src/lib/compatibility.ts`, `src/lib/build-advisor.ts`, `src/lib/product-trust.ts` behind one proposal/recalculation facade. Separate completeness from compatibility and identity confidence. Missing dimensions yield unknown fit, not pass.
- **Persistence:** adapt `src/lib/persistence/types.ts`, `mock-store.ts`, `server-store.ts`. Read old `saved_builds.build` JSON as version 2/legacy; write v3 after explicit commit; compare expected revision atomically in storage. A JSONB schema can carry the envelope; indexed metadata may need additive SQL later.
- **Image:** new server-only upload and observation modules under `src/features/reference-images/` and `src/features/image-analysis/`. Validate actual file type/size/dimensions; private storage, deletion/retention and rate controls. The vision model outputs observations with region and uncertainty, never verified part IDs.
- **Catalog/identity:** extend `src/lib/product-search/` and canonical seed data with appearance metadata. Candidate scores are explanations for review. Verified identity requires external identifiers or validated catalog evidence, not image similarity alone.
- **Scene:** new lazy client-only `src/features/build-3d/` scene and versioned manifest, mapping all eight slots to permanent anchors and dashed connectors. Standard/Exploded/Review modes are presentation state. Geometry classification and rights metadata accompany every asset. 2D cards use the same actions and remain usable if WebGL fails.
- **UI:** introduce compact entry routes and Build Studio composition while retaining `/consult`, current `/`, and saved-Build access through adapters until migration is proven.

## Transaction and stale-response rule

Each async analysis/recommendation carries the Build revision it observed. A later response may show suggestions but cannot replace a newer Build. `commit` rejects revision mismatch, re-runs deterministic rules on the server, persists the new revision and decision record together, then sends the same document to 2D and 3D. Cancel changes nothing.

## Migration and flags

Keep old records intact. Add fixture readers for legacy Build JSON and round-trip tests before changing writes. Use feature flags for the new shell, image flow and WebGL scene, with manual/2D flows available regardless of provider status. Only introduce an additive DB migration when image ownership or atomic revision compare cannot be represented safely with the current schema; document rollback and backup before execution. No production schema operation is part of R0.
