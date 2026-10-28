# Deployment notes

Stage 2 (deployment prep) is not started. This file collects what it must do.

## Stage 2 must-dos

### Global daily cap on photo analyses (recorded 2026-10-28, not implemented)

- **Why.** Photo analysis uses `gpt-5.4` by default (`IMAGE_AI_MODEL`). It costs about $0.04–0.05 per photo and takes about 35 s. The per-instance limit of 12 requests a minute in `image-analysis.server.ts` does not bound daily spend.
- **Cap.** A global cap of 100 analyses a day across all users, set in configuration (for example `IMAGE_ANALYSIS_DAILY_CAP=100`). Count it in shared storage, not per instance.
- **Over the cap.** Show a friendly message instead of an error. It says photo reading is paused for today, and points to **Describe your build** and **Build it yourself (manual)**. Never call the provider once the cap is reached.
- **Provider limit.** Also set a monthly budget limit in the OpenAI dashboard (Settings → Limits), as a backstop the app cannot override. The user sets this; it is not in the code.
- **Where it fits.** Together with the rate-limiting binding and Turnstile on Analyze listed for Stage 2.
