# v3 local deliverable and rollback — 2026-10-25

Covers PRD §25 "Local deliverable and rollback instructions recorded". Local only: nothing here pushes, merges, deploys or touches a production database.

## What the deliverable is

- Branch `rebuild/image-to-build-v3` in this worktree, built on `d9a3703` (`milestone-40-visual-decision-workspace`, the pre-v3 product). Every v3 change is a normal commit on top of it, with no history rewrite.
- New routes: `/`, `/start/$mode` (Image, Describe, Import, Blank), `/studio`, `/my-builds`. The pre-v3 pages stay reachable at `/legacy-workspace`, `/consult` and the other legacy routes.

## Run it locally

```powershell
npm.cmd install
npm.cmd run dev            # earlier sessions used http://127.0.0.1:5175/
npm.cmd run lint; if ($?) { npm.cmd run typecheck }; if ($?) { npm.cmd test }; if ($?) { npm.cmd run build }
```

- Configuration comes from `.env.local` (template `.env.example`). With no settings, persistence is the in-memory mock (saved builds vanish on restart) and image analysis answers `IMAGE_AI_NOT_CONFIGURED`. Use **Load local fixture** on the Image page with `public/og.png` in development.
- A real image provider needs `AI_PROVIDER=openai` and a server-only `OPENAI_API_KEY` (never `VITE_`). It has not been verified live (CLAUDE.md).

## Data changes and their compatibility

- **No SQL migration.** v3 draft details ride inside the existing `saved_builds.build` JSONB as a `v3Draft` envelope (`src/lib/v3/build-document.ts`, `src/lib/persistence/draft-envelope.ts`).
- Older builds without the envelope open in Studio as `legacy`.
- Pre-v3 code rebuilds a saved Build from its parts (`recalculateBuild`), which ignores the envelope, so pre-v3 code can still read v3 saves. If a pre-v3 page re-saves such a build, the envelope is dropped. Parts survive, but v3 source, unresolved notes and photo findings are lost.
- Save conflicts use the existing `updated_at` column (slice 3). No schema change.
- New cookie: `aipc_image_session` (HttpOnly, path `/api/image-analyses`, 1 day) for the per-session image limit. It's safe to delete at any time.
- Hand-curated fan data lives in source (`src/data/curatedFans.ts`), not in the database.

## Rollback

Choose the smallest step that fixes the problem. None of these rewrite history.

1. **Use the old pages without reverting anything:** `/legacy-workspace` and `/consult` still work on the same data.
2. **Undo one slice:** `git revert <commit>` on `rebuild/image-to-build-v3` (each slice is one commit; see `git log --oneline d9a3703..HEAD`). Rerun the gate afterwards.
3. **Run the pre-v3 product:** check out the pre-v3 branch in a separate worktree. This leaves the v3 branch and any uncommitted work untouched.
   ```powershell
   git worktree add ..\aipc-pre-v3 milestone-40-visual-decision-workspace
   ```
   It reads the same `saved_builds` rows (see compatibility above).
4. **Data:** nothing to roll back in the schema. If v3 envelopes must be removed from rows, back up the table first and strip `build->'v3Draft'` in a reviewed, separately approved operation. Never do this as part of a code rollback.

## Not covered here

Staging or production deployment, durable rate limiting, Supabase verification against a real project, and provider-side image retention. These need separate approval (PRD §20 R7 exit, §25).
