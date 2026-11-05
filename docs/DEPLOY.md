# Deployment notes

Stage 2 (deployment prep) started 2026-10-28, after Step C. This file collects what it must do. Nothing here is ever deployed without the user's go-ahead.

## Stage 2 checklist

| #   | Item                                                                                                                                      | Status                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Shorter photo-analysis output (cap observations, drop redundant fields); one run on real-photo-1, compared with v4 on time and key fields | adopted with v7 (see below)      |
| 2   | Global daily analysis cap with a friendly over-cap message (below)                                                                        | prepared (code, tests)           |
| 3   | Abuse limits on Analyze: Cloudflare rate-limiting binding plus Turnstile                                                                  | prepared (code, tests)           |
| 4   | Cloudflare Workers build and `wrangler.jsonc` notes; secrets as Worker secrets only, never `VITE_`                                        | prepared (config, runbook below) |
| 5   | Saving: v3 drafts and builds in the browser (localStorage) for the first deployment                                                       | prepared (code, tests)           |
| 6   | Pre-v3 routes return 404 in production; no Stripe                                                                                         | prepared (code, tests)           |
| 7   | Privacy page (photo never stored, metadata stripped, what the provider receives, retention)                                               | prepared (/privacy)              |
| 8   | E2E against a local production preview build                                                                                              | prepared (4 tests pass locally)  |
| 9   | Set the OpenAI monthly limit (the user, in the OpenAI dashboard)                                                                          | user                             |

## Stage 2 preparation (2026-10-28)

Everything below is prepared and tested locally only. Nothing was deployed and no Cloudflare login was used. The deployment is the user's to run.

| #   | What was built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Where                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2   | Global cap per UTC day (`IMAGE_ANALYSIS_DAILY_CAP`, default 30 since 2026-11-05) in a D1 table created on first use. The upsert only increments below the cap, so isolates cannot pass it together. Over the cap: 429 `DAILY_CAP_REACHED` and a calm notice linking to Describe and Start from scratch. In production without the D1 binding, analysis stays off (503 `DAILY_CAP_UNAVAILABLE`). Requests that never reach the provider give their count back.                                         | `image-daily-cap.server.ts`, `api-router.ts`, `image-start-flow.tsx`     |
| 3   | Rate-limiting binding `IMAGE_RATE_LIMITER` (3 per 60 s per session key) before the in-memory limiter. Turnstile: the widget appears when `VITE_TURNSTILE_SITE_KEY` is set at build time; the server checks the token when `TURNSTILE_SECRET_KEY` is set, and fails closed if Cloudflare's verifier is unreachable.                                                                                                                                                                                    | `cloudflare-env.server.ts`, `turnstile.server.ts`, `turnstile-check.tsx` |
| 4   | `wrangler.jsonc` with vars, the D1 database and the rate limit. `npm run build` writes `.output/server/wrangler.json` (nitro sets main and assets). Bindings reach the code through `cloudflare:workers`.                                                                                                                                                                                                                                                                                             | `wrangler.jsonc`, runbook below                                          |
| 5   | My Builds in the browser's localStorage in production builds (`VITE_BUILD_STORAGE=local` forces it in dev): same save, open, delete and conflict behaviour, at most 10 builds, and a "this browser only" note. The active draft stays in session storage.                                                                                                                                                                                                                                             | `local-builds.ts`, `build-store.ts`, `studio.tsx`, `my-builds.tsx`       |
| 6   | Production serves only the v3 pages (/, /start/\*, /studio, /my-builds, /privacy, /terms) and three APIs (image analyses, analytics events, Describe's recommendation). Everything else answers 404, including Stripe, sign-in and the legacy workspace; client-side visits to a pre-v3 page show Not found.                                                                                                                                                                                          | `production-surface.ts`, `server.ts`, `__root.tsx`                       |
| 7   | `/privacy`, linked from the footer and the photo notes. Each statement matches the code (resize to 1600 px, metadata stripped twice, never stored, `store: false`, what analytics hold, localStorage builds, the session cookie, Cloudflare and Google Fonts).                                                                                                                                                                                                                                        | `routes/privacy.tsx`                                                     |
| 8   | `npm run test:e2e:preview`: the production build on `wrangler dev --local` (workerd, local D1 and rate limiting), cap 0 and no provider key. Checks the 404s, the privacy page, the paused notice with D1 behind it, and a build saved, reloaded and deleted in the browser. Since 2026-11-04 a second worker (port 8789) reads a streamed photo from the local fake provider (`e2e-preview/fake-provider.mjs`, through `IMAGE_AI_BASE_URL`); it checks that events stream through nitro and workerd. | `playwright.preview.config.ts`, `e2e-preview/`                           |

### Cloudflare Workers runbook (for the user)

1. `npx wrangler login`.
2. `npx wrangler d1 create aipc-image-cap`; paste the printed `database_id` into `wrangler.jsonc` (it is `REPLACE_WITH_D1_DATABASE_ID` now, so a deploy fails until this is done).
3. Turnstile (optional but listed for Stage 2): create a widget in the Cloudflare dashboard for the Worker's hostname. Build with `VITE_TURNSTILE_SITE_KEY=<site key>` in the environment; the site key is public.
4. Secrets, never in `vars` and never `VITE_`: `npx wrangler secret put OPENAI_API_KEY` and, with Turnstile, `npx wrangler secret put TURNSTILE_SECRET_KEY`.
5. `npm run build`, then `npm run test:e2e:preview` (needs wrangler; `WRANGLER` can name a local copy).
6. `npx wrangler deploy` from the repository root (it follows `.wrangler/deploy/config.json` to the generated config).
7. Set the OpenAI monthly budget limit (item 9).
8. Smoke test on the deployed URL: `npm run smoke -- https://<your-host>` (no AI cost). Then analyze one photo in the browser (with Turnstile on, `--analyze` from the script is refused as expected), and save a build in My Builds.
9. Kill switch: see "Launch safety" below.

Notes:

- The pre-v3 deployment may still hold Worker settings for Supabase, Stripe and Best Buy. Leave `PERSISTENCE_PROVIDER` unset (Analyze otherwise looks up a Supabase session for its rate-limit key), and remove the Stripe and Best Buy secrets if they are no longer needed; no v3 path reads them.
- `IMAGE_ANALYSIS_DAILY_CAP` (default 30) and `IMAGE_ANALYSIS_IP_DAILY_CAP` (default 10) can be changed in `wrangler.jsonc` vars; `IMAGE_ANALYSIS_PAUSED=true` is the kill switch.
- Use the Workers Paid plan: a photo read needs more CPU than the Free plan's 10 ms ("CPU time" below).

## Stage 2 must-dos

### Shorter photo-analysis output (recorded 2026-10-28)

- **Why.** With effort `none`, gpt-5.4 still took 29.8 s for 2373 output tokens: the time goes into writing the JSON, not reasoning. A shorter answer is the lever.
- **What.** Cap observations (now up to 24, v4 sent 22), shorten or drop fields the app does not use, and keep the appearance parameters, guesses and visible text intact.
- **Check.** One gpt-5.4 run on real-photo-1, saved as a new `.v6.json` replay. Compare time, tokens and the key fields (case.type, glass, gpu.fanCount, pumpStyle, fan positions) with v4. Keep the change only if the key fields match.
- **Result (2026-10-28, effort low, one run).**

  |                                                                                      | v4                                                 | v6 (shorter prompt)                                                                        |
  | ------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
  | Time (server)                                                                        | 35.1 s                                             | **25.4 s** (−28%)                                                                          |
  | Output tokens                                                                        | 2465                                               | **1493** (−39%)                                                                            |
  | Input tokens                                                                         | 3999                                               | 4084                                                                                       |
  | Cost (at $2.50 / $15 per 1M)                                                         | about $0.047                                       | about $0.033                                                                               |
  | Observations                                                                         | 22                                                 | 12                                                                                         |
  | case.type / glass / gpu.fanCount / pumpStyle / fans (front, top, side, bottom, rear) | dual-chamber / both / unknown / screen / 0,0,3,0,1 | identical                                                                                  |
  | Model guesses                                                                        | 4 (case, GPU, cooler, fans)                        | **1** (fans only)                                                                          |
  | Visible text                                                                         | AERO, GEFORCE RTX, COOLMOON, B612                  | identical                                                                                  |
  | Matching                                                                             | GPU, cooler, fans: no_close_match                  | GPU tied · 5, cooler tied · 4 (colour observations now present); fans still no_close_match |

- **Decision: not adopted yet.**
  - The key fields match and it is 28% faster, but "keep the answer short" also cut the model guesses from four to one. That is the same reason effort `none` was not adopted.
  - The prompt is reverted. The replay is kept as `.v6.json`; the default replay stays v4.
  - **Next try, needing the user's OK for one more run:** the same prompt plus "the limits apply to observations only; give modelGuesses and visibleText as fully as before".

- **Second try, v7 (2026-10-28, effort low, one run, approved by the user).** The v6 limits apply to observations, evidence and the summary only; the prompt adds "Give modelGuesses and visibleText as fully as you would without any length limit."

  |                       | v4                                                         | v6           | v7                                                                            |
  | --------------------- | ---------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
  | Time (server)         | 35.1 s                                                     | 25.4 s       | **20.4 s** (−42%)                                                             |
  | Output tokens         | 2465                                                       | 1493         | **1399** (−43%)                                                               |
  | Input tokens          | 3999                                                       | 4084         | 4112                                                                          |
  | Cost                  | about $0.047                                               | about $0.033 | **about $0.031**                                                              |
  | Observations          | 22                                                         | 12           | 10                                                                            |
  | Key fields (as above) | dual-chamber / both / unknown / screen / 0,0,3,0,1         | identical    | identical                                                                     |
  | Model guesses         | 4: MONTECH KING 95, Gigabyte AERO, Galahad II LCD, UNI FAN | 1            | **4**: Phanteks NV5, GIGABYTE AERO, NZXT Kraken Elite 360 RGB, UNI FAN SL-INF |
  | Visible text          | AERO, GEFORCE RTX, COOLMOON, B612                          | identical    | identical                                                                     |

- **Decision: adopted.** The key fields match, the guess count equals v4's and the time is 42% lower, which meets the agreed test. The prompt keeps the v7 wording and the default replay `<key>.json` is now v7 (v4 stays as `.v4.json`).
  - The case and cooler guesses name different models than v4 (NV5 for KING 95, Kraken Elite for Galahad II LCD). The agreed test counts guesses only; both are appearance guesses, shown to the user as guesses, and v5 also guessed NV5.

### Global daily cap on photo analyses (recorded 2026-10-28, not implemented)

- **Why.** Photo analysis uses `gpt-5.4` by default (`IMAGE_AI_MODEL`). It costs about $0.04–0.05 per photo and takes about 35 s. The per-instance limit of 12 requests a minute in `image-analysis.server.ts` does not bound daily spend.
- **Cap.** A global cap of 100 analyses a day across all users, set in configuration (for example `IMAGE_ANALYSIS_DAILY_CAP=100`). Count it in shared storage, not per instance.
- **Over the cap.** Show a friendly message instead of an error. It says photo reading is paused for today, and points to **Describe your build** and **Build it yourself (manual)**. Never call the provider once the cap is reached.
- **Provider limit.** Also set a monthly budget limit in the OpenAI dashboard (Settings → Limits), as a backstop the app cannot override. The user sets this; it is not in the code.
- **Where it fits.** Together with the rate-limiting binding and Turnstile on Analyze listed for Stage 2.

## Streamed reading (2026-11-04)

- Photo reading streams NDJSON from `/api/image-analyses` once every check has passed (`docs/milestones/STREAMED_READING.md`). Workers stream responses as they are written; no extra binding or setting is needed.
- `IMAGE_AI_BASE_URL` (optional var) points photo analysis at an OpenAI-compatible base URL, for example a Cloudflare AI Gateway. Leave it unset in production unless a gateway is set up; it is never a secret.
- A streamed read stops after 75 s on the server. Cloudflare keeps a streaming response open while the provider sends data, and the read waits on I/O, so the CPU time used is small.

## Launch safety (2026-11-05)

Prepared and tested locally only; nothing deployed. The PRD appendix the request named was not in the repository, so this follows the request's list and PRD §13.

| Item                    | What it does                                                                                                                                                                                                                                                                                  | Where                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Kill switch             | `IMAGE_ANALYSIS_PAUSED=true` answers 503 `IMAGE_ANALYSIS_PAUSED` before the photo is read, counted or sent. The upload page shows the calm "unavailable" notice with Describe first.                                                                                                          | `config.server.ts`, `api-router.ts`                   |
| Per-IP daily cap        | `IMAGE_ANALYSIS_IP_DAILY_CAP` (default 10) per `cf-connecting-ip` per UTC day, in the same D1 table as the global cap. The key is the day plus a SHA-256 of day and IP, never the address; earlier days are deleted. A cleared cookie no longer resets the count. 429 `IP_DAILY_CAP_REACHED`. | `image-daily-cap.server.ts`                           |
| Daily cap default 30    | `DEFAULT_DAILY_CAP` and `wrangler.jsonc` are now 30 (was 100).                                                                                                                                                                                                                                | `image-daily-cap.server.ts`, `wrangler.jsonc`         |
| Non-PC precheck         | Before the stream: one call to `IMAGE_PRECHECK_MODEL` (default gpt-4.1-mini) at image detail low with one yes/no field. A "no" answers 422 `NOT_A_PC` on the upload page. Fails closed.                                                                                                       | `image-precheck.server.ts`                            |
| Content moderation      | In parallel with the precheck: `omni-moderation-latest` on the image (free). Flagged answers 422 `CONTENT_BLOCKED`. Both finish before `started` is sent; the preview E2E checks the order.                                                                                                   | `image-precheck.server.ts`                            |
| Security headers        | CSP (self, Google Fonts and Turnstile only; no framing, plugins or base changes), HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP. On Worker responses (CSP and HSTS in production only) and on static files through `public/_headers`.                     | `security-headers.ts`, `server.ts`, `public/_headers` |
| Outbound link allowlist | Links open only https pages on the listed manufacturer and retailer domains (plus Google search and OpenAI's policy page), with `noopener noreferrer nofollow`. Anything else is plain text. A test checks that every catalog link is covered.                                                | `external-links.ts`                                   |
| /terms                  | Terms of use, linked from the footer next to Privacy. The operator's name, contact and governing law are left for the operator to add.                                                                                                                                                        | `routes/terms.tsx`                                    |
| CPU time measurement    | `npm run measure:cpu` (results below).                                                                                                                                                                                                                                                        | `scripts/measure-cpu.mjs`                             |
| Smoke test              | `npm run smoke -- <url>`: pages, headers, 404s and the APIs, with no AI cost. `--analyze <photo>` adds one real read (one paid call).                                                                                                                                                         | `scripts/smoke.mjs`                                   |

A photo stopped by the precheck or moderation still counts against the session, IP and daily caps (it reached the provider). Requests stopped earlier give their counts back, as before.

**Using the kill switch.** In the Cloudflare dashboard: the Worker → Settings → Variables, set `IMAGE_ANALYSIS_PAUSED` to `true` (saving deploys a new version at once), or redeploy with `--var IMAGE_ANALYSIS_PAUSED:true`. Set it back to `false` to resume. `IMAGE_ANALYSIS_DAILY_CAP=0` also stops reading, but only after the photo is counted.

### CPU time (measured 2026-11-05, local workerd, this PC)

workerd's sampling profiler counts time spent waiting on a fetch as busy, so the script reads the operating system's CPU time of the app's workerd process instead. That is an upper bound: it includes workerd's own HTTP handling. The AI provider is the local fake.

| Request                                              | CPU per request                                                |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `GET /`, `/studio`, `/terms` (server render)         | 2–3 ms                                                         |
| `GET /og.png` (static)                               | about 3 ms locally; on Cloudflare static files skip the Worker |
| `POST /api/build/recommend`, `/api/analytics/events` | 1–2 ms                                                         |
| Photo, fake stream of 30 chunks                      | about 23 ms                                                    |
| Photo, the real recording's 1116 chunks              | **about 164 ms**                                               |

In Node, parsing that real stream (OpenAI SDK plus the part scanner) takes about 12 ms; the rest is workerd's per-chunk work, which Cloudflare may count differently. **A photo read does not fit the Workers Free plan's 10 ms CPU limit; use Workers Paid** (30 s default limit), where it is far inside. After deploying, check the Worker → Metrics → CPU time.
