# Appearance-parameter matching (2026-10-28)

The candidate matcher now also reads the photo's appearance parameters (Step A), not only the observations. No AI call was made for this step; the table below reruns the matcher on the saved replays and local samples.

## Rules

- Same rule as the observations: a known photo value that the recorded manufacturer data contradicts rules the part out; a match counts 1; `unknown` on either side counts neither way.
- A fact an observation already counted (colour, front panel, layout, cooler type, lighting) is not counted again from the parameters.
- Part look tags come only from manufacturer data already recorded (`showcaseParts.ts`, `catalogExpansion.ts`, `curatedFans.ts`). Seed parts get no new tags (unknown), because their specs have no per-entry manufacturer source.

| Photo parameter                                        | Part tag (source)                                          | Counts for                      | Rules out                                             |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| case.color, gpu.color, cooler.color, motherboard.color | `color`                                                    | same colour                     | a different colour                                    |
| case.type dual-chamber                                 | `caseAppearance.layout`                                    | dual-chamber page               | a mesh or perforated front                            |
| case.type mesh-front-mid-tower                         | `caseAppearance.frontPanel`                                | mesh or perforated front        | a glass front or dual-chamber                         |
| case.glass front / both / none                         | `caseAppearance.frontPanel`                                | glass front                     | mesh front (front/both); glass front (none)           |
| gpu.length                                             | `specs.lengthMm` (≤240 short, 241–299 medium, ≥300 long)   | same band                       | short against long only; medium never rules out       |
| gpu.fanCount                                           | `specs.fanCount`                                           | same count                      | a different count (no part records it yet)            |
| cooler.type                                            | `specs.coolerType`                                         | aio / air                       | the other type                                        |
| cooler.radiatorSize                                    | `specs.radiatorMm`                                         | same size                       | a different size; any air cooler                      |
| cooler.pumpStyle                                       | `specs.pumpDisplay` (new, from the page's own LCD wording) | screen on a part with a display | round/square on a part with a display; any air cooler |
| fans.ringColor                                         | fan `lighting`                                             | lit rings on a lit fan          | nothing (a lit fan can be switched off)               |

`specs.pumpDisplay` was added only to the three coolers whose recorded manufacturer notes already named the LCD: Galahad II LCD 360 (white and black), HydroShift LCD 360S and Kraken Elite 360 RGB. TITAN 360 RX has no display recorded, so it stays unknown and is never ruled out by the pump.

## Why v4's case shows only the O11 leading

- KING 95, H9 Flow and Y60 are candidates (score 2, colour only); NV5 is also a candidate but is sixth, so the cap of 5 cuts it (ties sort by name, and "Phanteks" comes after "NZXT").
- The O11 scores 5: colour, plus front glass and dual-chamber layout from its manufacturer page (`caseAppearance`).
- The Step C cases have no front panel or layout recorded, so the photo's "glass front, dual-chamber" can count neither for nor against them. That is the rule for unknowns, but it means the case with the most recorded data wins.
- To fix: record front panel and layout for KING 95, NV5, H9 Flow and Y60 from their manufacturer pages, as was done for the three showcase cases. That needs new page reads, so it was not done here.

## Before → after

| Input            | Slot        | Before this step                          | After                                                        |
| ---------------- | ----------- | ----------------------------------------- | ------------------------------------------------------------ |
| real-photo-1 v4  | case        | Lian Li O11 Dynamic EVO (White) leads (5) | same                                                         |
| real-photo-1 v4  | gpu         | no_close_match                            | **tied · 5 (score 2)**                                       |
| real-photo-1 v4  | cooler      | no_close_match                            | **tied · 3 (score 4)**                                       |
| real-photo-1 v4  | fan         | no_close_match                            | **tied · 5 (score 1)**                                       |
| real-photo-1 v4  | motherboard | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v4  | memory      | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v5  | case        | Lian Li O11 Dynamic EVO (White) leads (6) | same                                                         |
| real-photo-1 v5  | gpu         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| real-photo-1 v5  | cooler      | tied · 4 (score 2)                        | **tied · 3 (score 5)**                                       |
| real-photo-1 v5  | fan         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| real-photo-1 v5  | motherboard | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v5  | memory      | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v6  | case        | Lian Li O11 Dynamic EVO (White) leads (6) | same                                                         |
| real-photo-1 v6  | gpu         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| real-photo-1 v6  | cooler      | tied · 4 (score 2)                        | **tied · 3 (score 5)**                                       |
| real-photo-1 v6  | fan         | no_close_match                            | **tied · 5 (score 1)**                                       |
| real-photo-1 v6  | motherboard | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v6  | memory      | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v7  | case        | Lian Li O11 Dynamic EVO (White) leads (5) | same                                                         |
| real-photo-1 v7  | gpu         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| real-photo-1 v7  | cooler      | tied · 4 (score 2)                        | **tied · 3 (score 5)**                                       |
| real-photo-1 v7  | fan         | no_close_match                            | **tied · 5 (score 1)**                                       |
| real-photo-1 v7  | motherboard | tied · 2 (score 2)                        | same                                                         |
| real-photo-1 v7  | memory      | tied · 2 (score 2)                        | same                                                         |
| white sketch     | case        | tied · 5 (score 2)                        | same                                                         |
| white sketch     | gpu         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| white sketch     | cooler      | tied · 4 (score 4)                        | **Corsair iCUE LINK TITAN 360 RX RGB AIO (White) leads (5)** |
| white sketch     | fan         | tied · 5 (score 4)                        | same                                                         |
| white sketch     | motherboard | tied · 2 (score 2)                        | same                                                         |
| white sketch     | memory      | not seen                                  | same                                                         |
| glass front      | case        | Lian Li O11 Dynamic EVO (White) leads (4) | **Lian Li O11 Dynamic EVO (White) leads (5)**                |
| glass front      | gpu         | tied · 5 (score 2)                        | **tied · 5 (score 3)**                                       |
| glass front      | cooler      | tied · 4 (score 4)                        | **Corsair iCUE LINK TITAN 360 RX RGB AIO (White) leads (5)** |
| glass front      | fan         | tied · 5 (score 4)                        | same                                                         |
| glass front      | motherboard | tied · 2 (score 2)                        | same                                                         |
| glass front      | memory      | not seen                                  | same                                                         |
| black mesh tower | case        | tied · 5 (score 2)                        | same                                                         |
| black mesh tower | gpu         | tied · 5 (score 2)                        | same                                                         |
| black mesh tower | cooler      | DeepCool AK620 ZERO DARK leads (4)        | same                                                         |
| black mesh tower | fan         | tied · 5 (score 2)                        | same                                                         |
| black mesh tower | motherboard | tied · 5 (score 2)                        | same                                                         |
| black mesh tower | memory      | tied · 5 (score 1)                        | same                                                         |

- v4 GPU, cooler and fans now match: v4 put those colours only into the parameters.
- On every real-photo replay the photo's screen pump now narrows the white AIOs to the three with a recorded display (score 4–5). TITAN follows one point behind.
- The two white samples read a round pump cap, which rules out the three display AIOs, so TITAN leads there.
- GPUs still tie: every recorded white card is 300 mm or longer, and no card records a fan count.

## Step C case layout (2026-11-04)

Front panel and layout for the four Step C white cases, read from each manufacturer page by the `caseAppearance` rule (a field only when the page names it in words):

| Case            | Front panel                                                                 | Layout                  | Manufacturer wording                                                     |
| --------------- | --------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| MONTECH KING 95 | unknown (ships with a glass and a mesh panel)                               | dual-chamber            | "Hardware Harmony with Dual Chamber"                                     |
| Phanteks NV5    | unknown ("Near-seamless glass panels", front not named)                     | unknown (not described) | —                                                                        |
| NZXT H9 Flow    | unknown (wraparound glass plus mesh and perforated panels, front not named) | dual-chamber            | "Dual-Chamber Design: Separates main components from the PSU and drives" |
| HYTE Y60        | unknown ("3-piece panoramic tempered glass", front not named)               | dual-chamber            | "Type \| Dual Chamber Mid-Tower ATX Case"                                |

Case ranking on the real-photo replays, before → after:

| Replay | Before                                 | After                                         |
| ------ | -------------------------------------- | --------------------------------------------- |
| v4, v7 | O11 5 · 4000D, Y60, KING 95, H9 Flow 2 | O11 5 · **Y60, KING 95, H9 Flow 3** · 4000D 2 |
| v5, v6 | O11 6 · the same four 2                | O11 6 · **Y60, KING 95, H9 Flow 4** · 4000D 2 |

- The glass-front sample changes the same way (O11 5, then the three at 3). The white sketch and black mesh tower samples are unchanged.
- NV5 states neither fact, so it stays at 2 and sixth, and the cap of 5 still leaves it out. v7's NV5 guess is therefore still not among the shown cases.
