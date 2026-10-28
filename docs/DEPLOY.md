# Deployment notes

Stage 2 (deployment prep) started 2026-10-28, after Step C. This file collects what it must do. Nothing here is ever deployed without the user's go-ahead.

## Stage 2 checklist

| #   | Item                                                                                                                                      | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Shorter photo-analysis output (cap observations, drop redundant fields); one run on real-photo-1, compared with v4 on time and key fields | open   |
| 2   | Global daily analysis cap with a friendly over-cap message (below)                                                                        | open   |
| 3   | Abuse limits on Analyze: Cloudflare rate-limiting binding plus Turnstile                                                                  | open   |
| 4   | Cloudflare Workers build and `wrangler.jsonc` notes; secrets as Worker secrets only, never `VITE_`                                        | open   |
| 5   | Saving: v3 drafts and builds in the browser (localStorage) for the first deployment                                                       | open   |
| 6   | Pre-v3 routes return 404 in production; no Stripe                                                                                         | open   |
| 7   | Privacy page (photo never stored, metadata stripped, what the provider receives, retention)                                               | open   |
| 8   | E2E against a local production preview build                                                                                              | open   |
| 9   | Set the OpenAI monthly limit (the user, in the OpenAI dashboard)                                                                          | user   |

## Stage 2 must-dos

### Shorter photo-analysis output (recorded 2026-10-28)

- **Why.** With effort `none`, gpt-5.4 still took 29.8 s for 2373 output tokens: the time goes into writing the JSON, not reasoning. A shorter answer is the lever.
- **What.** Cap observations (now up to 24, v4 sent 22), shorten or drop fields the app does not use, and keep the appearance parameters, guesses and visible text intact.
- **Check.** One gpt-5.4 run on real-photo-1, saved as a new `.v6.json` replay. Compare time, tokens and the key fields (case.type, glass, gpu.fanCount, pumpStyle, fan positions) with v4. Keep the change only if the key fields match.

### Global daily cap on photo analyses (recorded 2026-10-28, not implemented)

- **Why.** Photo analysis uses `gpt-5.4` by default (`IMAGE_AI_MODEL`). It costs about $0.04–0.05 per photo and takes about 35 s. The per-instance limit of 12 requests a minute in `image-analysis.server.ts` does not bound daily spend.
- **Cap.** A global cap of 100 analyses a day across all users, set in configuration (for example `IMAGE_ANALYSIS_DAILY_CAP=100`). Count it in shared storage, not per instance.
- **Over the cap.** Show a friendly message instead of an error. It says photo reading is paused for today, and points to **Describe your build** and **Build it yourself (manual)**. Never call the provider once the cap is reached.
- **Provider limit.** Also set a monthly budget limit in the OpenAI dashboard (Settings → Limits), as a backstop the app cannot override. The user sets this; it is not in the code.
- **Where it fits.** Together with the rate-limiting binding and Turnstile on Analyze listed for Stage 2.
