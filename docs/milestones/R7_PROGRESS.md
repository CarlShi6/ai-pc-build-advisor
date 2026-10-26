# AIPC v3.0 R7 progress — pre-release validation

Branch `rebuild/image-to-build-v3`. Local only. Entered after the R6 exit review (`R6_EXIT_REVIEW.md`), its gap close-out (R6 slice 7) and the P0 items EP-05 (slice 8) and EP-06 (slice 9).

## R7 slice 1: Playwright E2E foundation — 2026-10-25

### Setup

- `@playwright/test` **1.64.0** (Apache-2.0, released 2026-10-07), pinned exact as a dev dependency and installed with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Tests run in the **locally installed Microsoft Edge** (`channel: "msedge"`), so no bundled browser was downloaded. `package-lock.json` is updated; `bun.lock` was not regenerated.
- `playwright.config.ts` starts a dedicated dev server on port 5181 (mock persistence, no image provider). It runs one worker because the mock store is a shared in-memory store, and keeps traces only on failure.
- E2E files are `e2e/*.e2e.ts`, so Vitest's default `*.spec`/`*.test` pattern never picks them up. `tsconfig.json` now typechecks `e2e/` and the config. ESLint ignores `.audit-tmp` (Playwright's transform cache lands there when `TEMP` points at it), `test-results` and `playwright-report`; the last two are also in `.gitignore`.
- Run with `npm.cmd run test:e2e`.
- `e2e/helpers.ts`:
  - Each flow signs in a generated test user against the local mock store (`*@example.test`), because mock guests share one session and one saved-build slot.
  - `clickUntil` retries a click until its effect shows, covering the known first-click-before-hydration issue.

### Flows (PRD §19.3)

| # | Flow | File |
|---|---|---|
| 1, 3 | Image (dev fixture) → observations → choose GPU only → preview → confirm → Studio 1/8, GPU Selected, Case "Review", PSU "Add part", compatibility **Incomplete** → Save → reopen from My Builds with the same state | `image-to-build.e2e.ts` |
| 7 | Analyze with no provider → "not configured" → Continue manually → empty Studio | `fallback-and-proposals.e2e.ts` |
| 5, 6 | In the 2D view: preview a CPU → Cancel → still 0/8 → preview again → Confirm → 1/8 | same |
| 8 | Two tabs: tab B saves a case change; stale tab A's save shows "Resolve save conflict" → Open saved version restores tab B's case | same |
| EP-06 | Describe: Local AI + White → preview lists all parts with "White look not applied" and the seed-price note → confirm → Studio 8/8 | `describe-and-delete.e2e.ts` |
| Privacy | My Builds: Delete → confirm group → Delete permanently → empty list | same |

Result: **6 passed** (21.3 s and 19.3 s on two consecutive runs). Unit and integration gate: lint 0, typecheck passed, 174 tests in 25 files passed, build passed.

### Not covered yet (remaining R7)

- §19.3 #2 (lookalike case correction), #4 replacing from the 3D scene (headless WebGL isn't asserted), #9 (pre-v3-format restore, unit-tested only), #10 (unauthorized access/deletion), and an explicit no-WebGL browser launch.
- EP-05 look-lock override in the browser: every seed case and GPU is black, so no catalog part breaks the fixture's traits.
- Focus/Isolate, reduced motion, keyboard and mobile, the §19.3 curated image fixture set, performance profiling, visual regression, and the 8–12 person study.
- The live image provider path stays deferred until deployment.
