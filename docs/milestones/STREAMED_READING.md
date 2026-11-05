# Streamed photo reading in Studio (2026-11-04)

Analyze now opens Studio at once. The photo is read as a stream, and each part is drawn as soon as it has been read. This replaces the wait on the upload page and the separate review page.

## Step 0: technical check (one gpt-5.4 call, real-photo-1, effort low)

The schema lists appearance first (case → gpu → cooler → fans → memory → motherboard), then absentParts, quality, qualityIssues and summary. Observations, model guesses and visible text come last.

| Time   | Event                                                       |
| ------ | ----------------------------------------------------------- |
| 1.8 s  | The provider accepted the request                           |
| 2.3 s  | Reasoning started; no text was sent until 10.5 s            |
| 10.8 s | **Case parsed** (the first part)                            |
| 11.5 s | All six appearance categories parsed                        |
| 18.9 s | 12 observations                                             |
| 20.2 s | 3 model guesses                                             |
| 21.1 s | **Done** (the same photo took 20.4 s without streaming, v7) |

- **Tokens:** 4424 in, 1593 out (464 of them reasoning), about $0.03.
- **Result:** the appearance fields matched v7 exactly.
- **Model guesses changed** (Y60 instead of NV5, and no Kraken guess), the usual run-to-run variation of guesses.

**What this means:** the six parts arrive within about a second of each other, not one by one. Studio can be used at about 11 s instead of 21 s. A lower reasoning effort could bring the first part forward, but it needs one more authorized call to check quality.

**workerd (local, wrangler 4.152):** a worker writing its own stream, and a worker passing an upstream SSE stream through, both reached the client chunk by chunk. Neither was held back until the end. The preview E2E checks the same through the built app (below).

## How it works

- **Server** (`api-router.ts`, `image-analysis.server.ts`)
  - Every check runs first, with its own status code: session and platform rate limits, the daily cap, Turnstile, and configuration.
  - Provider errors before it accepts the request also keep their own status (401/403 → not configured, 429 → rate limited).
  - Only then does the response become `application/x-ndjson`, carrying these events:
    - `started`;
    - one `part` per appearance category, sent when its object closes and it passes the strict schema;
    - `done` with the full checked result, or `error`.
  - A request without `accept: application/x-ndjson` still gets the old JSON answer.
  - The whole read stops at 75 s (30 s for non-reasoning models).
  - Prechecks added later (non-PC photos, moderation) go in the same place, before the stream starts.
- **Shared scanner** (`analysis-stream.ts`): parses the provider's JSON text incrementally. The live server and replays use the same scanner.
- **Client**
  - `live-reading.ts` keeps the read going across the navigation to Studio and writes each part into the session draft. The client gives up after 90 s.
  - `progressive-draft.ts` holds the merge rules:
    - parts the user chose, slots kept unknown, and look fields the user set are never overwritten;
    - the full result adds observations and guesses and runs `reconcileAppearance`;
    - a drawn category the result changes shows the notice "Adjusted after full read".
- **Studio**
  - Visible slots (case, GPU, cooler, memory, motherboard) show a dashed "Reading…" box in 3D, and "Reading…" on their labels and 2D cards. Hidden slots stay open as before.
  - Each part grows in over 450 ms; with reduced motion it appears at once.
  - Short notices ("Graphics card found") fade after 3.5 s, timed from when they appear. They never block.
  - Save waits until the read ends. Turning, zooming and choosing parts work throughout.
  - If reading stops: drawn parts stay, the other slots become normal manual slots, and "Describe your dream PC" is the main way on.
- **Match drawer**
  - The old review page (catalog candidates, look correction, AI guesses, visible text) is now a Studio drawer behind "N parts can be matched to a model".
  - "Preview matches" shows the same change list. "Apply to this build" adds only the chosen and filled-in parts; slots the user already decided stay as they are.
  - The draft keeps the summary, quality, absent parts, corrections and the look as read, so the drawer still works after a save.
- **Replays**
  - Live reads save each text chunk with its time in `stream.chunks`.
  - "Load local fixture" plays a replay at the recorded pace, with an optional 2× speed.
  - Replays recorded before streaming, and the named dev fixtures, play with a short fixed rhythm.

## Tests

- **Unit:**
  - `analysis-stream.test.ts`: schema order, scanning under any chunking, strict per-category validation, NDJSON after the checks, status codes before the stream starts and an error event after, the plain-JSON fallback, and fixture playback.
  - `progressive-draft.test.ts`: the empty draft, parts drawn as they arrive, pending slots, user choices kept, adjusted categories, and the full read surviving a save.
- **Dev E2E:** `e2e/streamed-reading.e2e.ts`.
  - Reading slots, with a part picked mid-read and kept; the page clock is held so this is deterministic.
  - A stopped read.
  - The "Adjusted after full read" notice.
  - The earlier photo tests now use the drawer.
- **Preview E2E:**
  - `e2e-preview/streamed-reading.e2e.ts` runs a second worker (port 8789) whose provider is `e2e-preview/fake-provider.mjs` (port 8790), set through the new optional `IMAGE_AI_BASE_URL`. Its key is a placeholder; nothing calls OpenAI.
  - It checks that events reach the browser through nitro → h3 → the router one by one, and that Analyze fills Studio in.
