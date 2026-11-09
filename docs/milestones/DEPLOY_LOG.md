# First deployment log

The user deployed by following `docs/DEPLOY_CHECKLIST.md`, step by step, on 2026-11-07 to 2026-11-09. The user ran every login, purchase, `wrangler secret put` and `wrangler deploy`. Claude ran only read-only checks (`deploy:check`, `smoke`, `wrangler secret list`) and changed the configuration.

**Live URL:** <https://ai-pc-build-advisor.ai-pc-build-advisor-carl.workers.dev>

Custom domain: not yet (checklist section f).

## Steps and results

| Step                     | Result                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a. OpenAI                | Project `AIPC production`, monthly budget $30, email alerts. Prepaid balance $9 with auto recharge off, so the balance is the hard limit (about 200 analyses at $0.044). The key was created at step b.6 and pasted straight into `wrangler secret put`, never stored.              |
| b.1 Workers Paid         | Purchased. The account already had a Worker named `ai-pc-build-advisor` (pre-v3), with no variables, secrets, bindings or custom domains, so overwriting it was safe. `aipcbuildadvisor.com` is on Cloudflare DNS (Free plan, about 2 visitors) and was not attached to any Worker. |
| b.2 `wrangler login`     | wrangler 4.159.0, account `cf0fac29…`.                                                                                                                                                                                                                                              |
| b.3 D1                   | `aipc-image-cap`, id `7f56a55b-843d-4973-a4d4-f5d2e1a6d255`, region WNAM. Committed in `9bb6911`.                                                                                                                                                                                   |
| b.4 D1 table             | Skipped: created on first use.                                                                                                                                                                                                                                                      |
| b.5 Turnstile            | Skipped for now (user's choice, for speed). The session, IP and daily caps still apply.                                                                                                                                                                                             |
| b.6 Secrets              | `OPENAI_API_KEY` only; `wrangler secret list` confirmed it is the only secret.                                                                                                                                                                                                      |
| c.1 `deploy:check`       | All stages passed: configuration, secrets, build, preview E2E 9/9, routes (12 live, 34 return 404).                                                                                                                                                                                 |
| c.2 First deploy, paused | Version `d3ae3fe2-c9f8-4181-985e-323661e23ef0`, with D1, rate limit, caps 30/10 and `IMAGE_ANALYSIS_PAUSED=true`.                                                                                                                                                                   |
| c.3 Smoke (no AI cost)   | 17/17, including "kill switch is ON".                                                                                                                                                                                                                                               |
| d.1 Unpaused             | Version `a005c4ec-cf8f-4a7f-8372-43fe31c05acc` (`IMAGE_ANALYSIS_PAUSED=false`).                                                                                                                                                                                                     |
| d.2 Smoke with one photo | 18/18. real-photo-1 sent by the script (full photo, no 512 px copy): started, case and GPU at 4.7 s, all six parts by 5.3 s, done at 26.4 s. Streaming through Workers worked and no CPU limit was hit.                                                                             |
| d.2 Browser              | The user analyzed the same photo on the live site. Studio opened and drew the parts one by one with the "found" notices (screenshot of the read in progress); the user judged it good enough.                                                                                       |

Cost of the checks: two photo analyses, about $0.09.

## Problems met

| Problem                                                               | Cause                                                                                                                                                                                           | Fix                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx : ... running scripts is disabled on this system`                | PowerShell's execution policy blocks `npx.ps1` and `npm.ps1`                                                                                                                                    | Use `npx.cmd` and `npm.cmd`; the checklist now does throughout.                                                                                                                         |
| `wrangler d1 create` changed `wrangler.jsonc`                         | The user answered yes to "add it on your behalf". It added a second binding `aipc_image_cap` with `"remote": true`, left the placeholder in `IMAGE_CAP_DB`, and re-indented the file with tabs. | One `IMAGE_CAP_DB` binding with the real id, no `remote` (local dev and the preview E2E must never use the production database), formatting restored. The checklist notes the recovery. |
| The upload page still said "paused" after step d.1                    | The page was opened before the unpaused deploy                                                                                                                                                  | Reload the page and analyze again.                                                                                                                                                      |
| The first part at 4.7 s in the smoke run, against about 2.5 s locally | The smoke script sends the full photo without the 512 px copy, so the kind check reads the full photo; plus the network                                                                         | None needed; the browser sends the copy.                                                                                                                                                |

## Before launch

Also prepared during this deployment (2026-11-08): an OpenAI account out of credit (`insufficient_quota`) shows the same calm pause as the daily cap, not a generic error (`bfbe49b`). With a prepaid balance and auto recharge off, this is how the site behaves when the $9 runs out.

Open items:

- Custom domain (`aipcbuildadvisor.com`), checklist section f.
- Turnstile, when wanted: checklist b.5, then `deploy:check` and deploy again.
- Check Worker → Metrics → CPU time after a few real reads.
