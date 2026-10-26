# Demo track progress (4 weeks, before R7 user testing)

Plan and rules: CLAUDE.md "Demo track (4 weeks)". Branch `rebuild/image-to-build-v3`, local commits only. Screenshots are kept outside the repository (session scratchpad) and shared with the user per slice.

## Week 1

### Slice 1: home page is the photo entry — 2026-10-25

- `src/components/image-start-flow.tsx`: the whole photo → observations → candidate review → Build preview → confirm flow moved out of `start.$mode.tsx` unchanged (same privacy and retention notes, limits, fixture button, funnel events, explicit confirmation). It adds drag-and-drop on the drop zone and an inline budget when the host page has none.
- `src/routes/index.tsx`: the hero is now the headline plus a large **Upload a PC photo** drop zone (PRD §4.2 primary CTA). Describe / Import / Start from scratch are a "No photo?" link row. The four-card grid and decorative tower art are gone. Privacy and retention notes fold into "Your photo stays private · how analysis works".
- `/start/image` uses the same component, so existing links and E2E tests keep working.
- E2E: new "home hero upload runs the same image → Build flow". **7/7 passed.** Gate: lint 0, typecheck passed, 174 tests in 25 files passed, build passed.
- Known rough edge (week 4 polish): after analysis, the review cards stay in the hero's right column, which is narrow on desktop. PRD §4.2's sample/demo mode for users without a photo is not built yet; the week 3 white showcase build is the natural sample.
