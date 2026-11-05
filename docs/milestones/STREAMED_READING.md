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

### Where the first 11 s go (analysis, 2026-11-05; nothing changed yet)

From the provider's own events in the step 0 recording (times from the request leaving the server):

| Phase                                                                    | Time            | Share     |
| ------------------------------------------------------------------------ | --------------- | --------- |
| Upload and prompt intake (4424 input tokens, image at detail high)       | 0 → 1.8 s       | 1.8 s     |
| Waiting for the reasoning item                                           | 1.8 → 2.3 s     | 0.5 s     |
| **Reasoning** (464 tokens, no text sent; the item closed at 10.57 s)     | 2.3 → 10.6 s    | **8.2 s** |
| Output prefix: `{"appearance":{"case":{…}` up to the case object closing | 10.58 → 10.75 s | 0.18 s    |
| The other five categories                                                | 10.75 → 11.5 s  | 0.8 s     |

Studio opens when the provider accepts the request (1.8 s plus the browser's resize and upload). The first part arrives at 10.8 s, and **almost all of the wait is reasoning, not the output prefix**: the prefix and the case object take under 0.2 s because appearance is already first in the schema.

Ways to bring the first part forward (not done; each needs an authorized check of quality):

1. **Lower reasoning effort** (`IMAGE_AI_REASONING_EFFORT=none` or `minimal`): removes most of the 8.2 s, so parts could come at about 2.5–3 s. Risk: read quality without reasoning is not measured for this schema yet; one run on real-photo-1 compares the key fields with v7. (On 2026-10-28 an effort-none run was not faster overall, because the time then went into a longer output; the output is now shorter.)
2. **Two calls at once:** a fast call (effort none, appearance only, small output) draws parts at about 3 s, and the full call keeps reasoning for observations and guesses; the existing "Adjusted after full read" check reconciles them. About 1.2× the cost, and still one count against the limits.
3. **A cheaper model for the appearance** (gpt-4.1-mini, no reasoning) in the fast call of option 2: lowest cost, weakest read.
4. **Smaller prompt intake:** the fixed system prompt could be cached by the provider (it is identical on every call), cutting part of the 1.8 s.

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
  - **Interrupted by a reload** (2026-11-05): the draft carries `reading: true` while it is read. A draft that still has it with no read running shows "Reading was interrupted". Drawn parts stay, the other slots are manual, and there are three choices: Describe (primary), "Read the photo again", and Dismiss.
    - Reading again sends the same resized copy back through `/api/image-analyses`, so it passes every limit, the daily caps, Turnstile and the prechecks again. The copy is kept in this tab's session storage during a read only (`reading-retry.ts`) and is removed when the read ends.
    - The read goes into the same draft, so the build and the user's choices stay. Without a kept copy, the card links to the upload page instead.
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
