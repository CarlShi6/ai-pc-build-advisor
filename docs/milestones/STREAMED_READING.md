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

## Two reads at once (2026-11-05)

Studio's parts used to wait for the full read's 8 s of reasoning. Now two requests start together, after the precheck:

- **Fast read:** gpt-5.4 at effort `none`, with a schema of the appearance fields only (`fastPrompt`, `fastSchema` in `image-analysis.server.ts`). Its parts are drawn as they arrive.
- **Full read:** unchanged (gpt-5.4 at effort low, the whole schema). It provides observations, model guesses, visible text and the final appearance. Where it differs from what the fast read drew, Studio shows "Adjusted after full read".
- **Failures:** if the fast read fails, the full read's own parts are drawn as they arrive. If the full read fails, the analysis fails, and the drawn parts stay.
- **Counting:** the whole thing counts as **one analysis** for the per-minute limit, the session limit, the per-IP cap and the daily cap. `two-path-read.test.ts` checks that two analyses make four calls and still use only two of the daily cap.
- **Settings:** `IMAGE_FAST_READ=off` turns the fast read off; `IMAGE_FAST_MODEL` and `IMAGE_FAST_REASONING_EFFORT` change it.
- **Replays:** a recording keeps both streams (`fast.chunks`, `stream.chunks`) and the precheck (`precheck.kind`, `ms`, tokens). "Load local fixture" plays both, merged by time.

### Live run on real-photo-1 (2026-11-05, 5176, one analysis)

Browser times from the Analyze click (upload page and Studio, 2D):

| Event                        | Time      | Before (step 0) |
| ---------------------------- | --------- | --------------- |
| Studio opens                 | 3.6 s     | about 2 s       |
| **First part drawn**         | **5.6 s** | about 11 s      |
| All visible parts drawn      | 6.5 s     | about 11.5 s    |
| Read finished (match drawer) | 22.6 s    | about 21 s      |

On the server, measured from when the two reads were sent: the fast read's first text came at 2.3 s and the case closed at 2.6 s, with all six categories by 3.6 s. The full read's first text came at 8.6 s and the case closed at 8.8 s; the read finished at 19.3 s.

- **Appearance:** the fast and full reads gave **identical** appearance fields (0 differences), so no "Adjusted after full read" notice. The full read's appearance also matches the step 0 recording exactly. Guesses: Gigabyte RTX AERO, Lian Li Galahad II LCD, Lian Li UNI FAN.
- **Precheck:** `pc_build`, **2.87 s** on the server, all of it before Studio opens. This is why Studio now opens at 3.6 s instead of about 2 s.

**Tokens and cost.** Estimated at $2.50 per 1M input and $15 per 1M output for gpt-5.4, and $0.40 / $1.60 for gpt-4.1-mini (the rates behind the earlier "about $0.03"). Check the OpenAI usage page for the billed amounts.

| Call                    | Input tokens | Output tokens          | Cost (est.)             |
| ----------------------- | ------------ | ---------------------- | ----------------------- |
| Precheck (gpt-4.1-mini) | 2529         | 7                      | $0.001                  |
| Moderation              | –            | –                      | free                    |
| Fast read (effort none) | 3266         | 139                    | $0.010                  |
| Full read (effort low)  | 4112         | 1517 (incl. reasoning) | $0.033                  |
| **Total**               |              |                        | **about $0.044** (+33%) |

### The precheck on a drawn non-PC photo

A mug on a wooden desk, drawn with a canvas in code (`local-replays/drawn-cup-on-desk.jpg`, local only), was refused with `NOT_A_PC` on the upload page. The 422 arrived 2.3 s after the request; it cost about $0.001 (precheck only).

### The precheck's own wait

The precheck is now the largest part of the wait before Studio opens (2.9 s of 3.6 s). Ways to shorten it, not done:

- Send it a small copy (for example 512 px); its input is almost all image tokens.
- Use a smaller model (gpt-4.1-nano).
- Start the two reads while it runs and cancel them on `not_pc`. This is fastest, but a refused photo then costs part of a read, and moderation would no longer run before the read.

## Faster precheck (2026-11-05, second round)

**Order now:**

1. Content moderation runs alone, on the resized photo.
2. When it passes, three requests start at once: the photo-kind check, the fast read and the full read.
3. Studio opens, and parts are sent, only once the kind check passes. On `not_pc` the router cancels both reads (an AbortSignal into `analyzeReferenceImage`), drops whatever they sent, and answers 422 `NOT_A_PC` on the upload page. The refused photo still counts against the session, IP and daily caps.

**The small copy.** The browser now sends the photo and a 512 px copy in one multipart request (`image`, `preview`; `image-client.ts`, `readBoundedImages` in `image-input.ts`). Only the kind check reads the copy. A body with just the image still works (the smoke script, older clients); the kind check then reads the photo itself. A copy that is too large (over 640 px or 512 KB) or broken is ignored.

**Moderation stays on the full photo.** Two reasons:

- **The reads must be checked, not a stand-in.** The copy comes from the browser, so a crafted request could pair a harmless copy with a different photo. Moderating the copy would let the reads see an image that was never moderated. The kind check only steers cost, so a mismatched copy only wastes the sender's own allowance.
- **Detail.** At 512 px small regions lose detail, so a smaller image is a weaker check. The full photo costs moderation nothing extra (it is free), and it took 0.66 s here.

### Live runs (5176, one each)

|                                  | real-photo-1                                         | Drawn mug (not a PC)                                                                                |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Result                           | Read (`pc_build`)                                    | Refused, `NOT_A_PC` on the upload page                                                              |
| Moderation (server, full photo)  | **0.66 s**                                           | about 0.6 s (derived: 2.8 s total minus the 2.1 s check; refusals did not record it yet, now fixed) |
| Kind check (server, 512 px copy) | **1.12 s**, 488 input tokens (was 2529 at full size) | about 2.1 s, from start to the reads being cancelled                                                |
| Answer on the upload page        | Studio opened at **1.87 s** (was 3.6 s)              | 422 at 2.8 s (was 2.3 s)                                                                            |
| First part drawn                 | **2.46 s** (was 5.6 s)                               | –                                                                                                   |
| All visible parts drawn          | 3.49 s                                               | –                                                                                                   |
| Read finished                    | 16.0 s                                               | –                                                                                                   |

Times on the upload page and in Studio are from the Analyze click. The full read reasoned for less time on this run (its first text came at 4.6 s, against 8.6 s in the previous run); that is run-to-run variation, and it does not change when the first part appears.

**real-photo-1 recording** (the new default replay; the previous one is `.tworead-1105.json`):

- The fast and full appearance fields are identical, so no "Adjusted after full read" notice. They also match step 0 exactly.
- The guesses changed again (Lian Li UNI FAN SL-INF, Galahad II LCD 360, Colorful iGame Neptune): the usual run-to-run variation.
- Tokens: kind check 488 / 7, fast read 3266 / 139, full read 4112 / 1359.
- Estimated cost: $0.0002 + $0.010 + $0.031 = **about $0.041** (was $0.044; same rates as before).

**What the refused mug wasted.** From `local-replays/37fcd365….cancelled.json`, recorded in dev:

- **Fast read:** accepted at 1.45 s, no text received when cancelled at 2.09 s; its input was 2308 tokens (counted afterwards with the input-token count endpoint).
- **Full read:** accepted at 1.60 s, no text received; its input was 3154 tokens.
- **Kind check:** about 500 tokens (its usage is not returned for a refusal).
- **Total wasted: about 5462 input tokens and no output text.** If OpenAI bills the input of a cancelled stream in full, that is about $0.014 (the full read may also have spent up to half a second of reasoning tokens). The old order spent about $0.001 on a refused photo. The OpenAI usage page shows the billed figure.

So a PC photo now opens Studio about 1.7 s sooner and draws its first part about 3 s sooner, while a non-PC photo costs about $0.014 more (if billed in full) and is refused about 0.5 s later.
