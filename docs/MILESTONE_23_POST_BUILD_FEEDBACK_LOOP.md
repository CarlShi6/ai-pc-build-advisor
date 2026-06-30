# Milestone 23: Post-Build Feedback Loop

## Goal

Milestone 23 adds structured post-build feedback collection for saved PC builds. Users can report what actually happened after they bought parts and completed an installation, giving the product a foundation for future real-world recommendation learning.

## What Changed

- Added `PostBuildFeedback` TypeScript types with build linkage, optional user linkage, completion date, installation outcome, issue categories, satisfaction, recommendation intent, and notes.
- Added a beginner-friendly feedback form using simple choices such as `No issue`, `Minor issue`, `Major issue`, and `Not sure`.
- Added a `Report Build Result` action from the current recommendation card and each saved build.
- Added feedback summaries on build cards and saved-build cards:
  - Build completed
  - Issues reported
  - Satisfaction score
  - Beginner difficulty
- Added mock/local persistence for post-build feedback.
- Added Supabase/server persistence support through a `post_build_feedback` table path.
- Added an internal API route at `/api/builds/feedback`.

## Data Model

Feedback is attached to saved builds by `buildId`. The record includes:

- `buildId`
- `userId` when available
- `completedAt`
- `bootSuccess`
- `installationDifficulty`
- `compatibilityIssues`
- `thermalExperience`
- `noiseExperience`
- `cableManagementExperience`
- `gpuClearanceIssue`
- `coolerFitIssue`
- `biosUpdateNeeded`
- `driverIssue`
- `overallSatisfaction`
- `wouldRecommend`
- `notes`

## Persistence

Mock mode stores feedback in the in-memory mock persistence store alongside saved builds.

Supabase mode uses the existing server-side persistence abstraction and the service-role-backed internal API path. The schema documentation now includes `public.post_build_feedback`, indexes, and RLS policy guidance. No secrets were added.

## Non-Goal

Feedback is not used to change recommendations automatically in this milestone. The data is collected and displayed only, leaving recommendation-learning behavior for a future milestone.
