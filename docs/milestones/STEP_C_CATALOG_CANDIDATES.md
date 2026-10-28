# Step C: catalog expansion candidates (proposal, not entered)

Status: **waiting for approval** (2026-10-28). Nothing below is in the catalog yet.

## Rules for entry

- Manufacturer data only. Every value below was read on 2026-10-28 from the manufacturer's own page linked in the row.
  - No third-party sites, no logos, no invented values.
- Dimensions are quoted exactly as the manufacturer prints them, axis order included.
- Price:
  - only the manufacturer's own store price, read live;
  - otherwise `null` (`priceStatus: "unknown"`), never $0.
- When the manufacturer page does not state a value in text, the table says so. Most often this is the colour.
  - It is filled only after a decision (see "Open questions").
- On entry, each part follows `showcaseParts.ts`: `productUrl`, `partNumber`, `dimensions.asPublished`, and specs where the page states them.

## Why these parts

- **No production logs yet.** The match-gap record (`v3_image_match_gaps`, reason codes in `slot-identity.ts`) has no production data, because nothing is deployed. The only source is the local readings of real-photo-1:
  - mini v1, v2, t0;
  - gpt-5.4 v3, v4, v5.

| Reading                   | case | gpu            | cooler         | fan            | motherboard    |
| ------------------------- | ---- | -------------- | -------------- | -------------- | -------------- |
| gpt-4.1-mini (v1, v2, t0) | tied | tied           | —              | tied           | no_close_match |
| gpt-5.4 v3                | —    | tied           | no_close_match | tied           | no_close_match |
| gpt-5.4 v4 (default)      | —    | no_close_match | no_close_match | no_close_match | no_close_match |
| gpt-5.4 v5 (effort none)  | —    | tied           | —              | tied           | no_close_match |

- **What the gaps say:**
  - Motherboard misses in every reading: the catalog has no white board.
  - The GPU, cooler and fans miss or tie in the gpt-5.4 readings: a long white GPU, a white 360 AIO with a screen pump, and white linked fans.
  - So the list weights white GPUs, white screen AIOs, white fans and white boards, with some black counterparts.
- **First batch** (requested): the AI guesses for this photo.
  - From v4: MONTECH KING 95, Gigabyte AERO, Lian Li Galahad II LCD 360, Lian Li UNI FAN.
  - From the v5 reading: Phanteks NV5 and Lian Li HydroShift LCD. v5 read the text "PHANTEKS" on the case frame.
- **Already in the catalog** (not repeated): Lian Li UNI FAN SL-INF 120/140 (white and black) and Lian Li O11 Dynamic EVO.

## Candidates (20)

| #   | Full model name                                            | Category    | Colour                                     | Key dimensions (as published)                                                | Part number                                                            | Price                  | Manufacturer source                                                                                                                              |
| --- | ---------------------------------------------------------- | ----------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | MONTECH KING 95 (Pure White) · AI guess                    | case        | White ("Pure White" listed)                | 475×300×442 mm (L×W×H); GPU ≤420 mm; cooler ≤175 mm; top radiator ≤360       | EANs listed, but not mapped to colours                                 | null                   | https://www.montechpc.com/king-95                                                                                                                |
| 2   | Phanteks NV5 (Matte White) · v5 guess                      | case        | Matte White                                | 239×477×528 mm (W×D×H); GPU ≤440 mm; cooler ≤180 mm; top and side 360        | PH-NV523TG_DMW01                                                       | null                   | https://phanteks.com/product/nv5-white/                                                                                                          |
| 3   | NZXT H9 Flow (White)                                       | case        | White                                      | 506×315×481 mm (H×W×D); GPU ≤459 mm; cooler ≤165 mm                          | CM-H92FW-01                                                            | $169.99                | https://nzxt.com/products/h9-flow                                                                                                                |
| 4   | HYTE Y60 (Snow White)                                      | case        | Snow White                                 | 456×285×462 mm (L×W×H); GPU ≤375 mm; cooler ≤160 mm                          | CS-HYTE-Y60-WW                                                         | $179.99 (out of stock) | https://hyte.com/store/y60/cs-hyte-y60-ww                                                                                                        |
| 5   | Lian Li LANCOOL 216 (Black)                                | case        | Black                                      | (D)480.9×(W)235×(H)491.7 mm; GPU ≤392 mm; cooler ≤180.5 mm                   | model codes listed (216X / 216RX / 216RC-X), colour mapping to confirm | null                   | https://lian-li.com/product/lancool-216/                                                                                                         |
| 6   | GIGABYTE GeForce RTX 5070 Ti AERO OC 16G · AI guess        | gpu         | Not stated in text                         | L=342 W=140 H=70 mm                                                          | GV-N507TAERO OC-16GD                                                   | null                   | https://www.gigabyte.com/Graphics-Card/GV-N507TAERO-OC-16GD/sp                                                                                   |
| 7   | GIGABYTE GeForce RTX 5070 AERO OC 12G · AI guess           | gpu         | Not stated in text                         | L=324 W=130 H=56 mm                                                          | GV-N5070AERO OC-12GD                                                   | null                   | https://www.gigabyte.com/Graphics-Card/GV-N5070AERO-OC-12GD/sp                                                                                   |
| 8   | MSI GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE           | gpu         | White (in model name)                      | 338×140×50 mm                                                                | (model name)                                                           | null                   | https://www.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-GAMING-TRIO-OC-WHITE/Specification                                                     |
| 9   | ASUS TUF Gaming GeForce RTX 5070 Ti 16GB GDDR7 OC Edition  | gpu         | Not stated in text                         | 329×140×62.5 mm; 3.125 slot                                                  | TUF-RTX5070TI-O16G-GAMING                                              | null                   | https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-gaming/techspec/                                       |
| 10  | Lian Li Galahad II LCD 360 (White) · AI guess              | cooler      | White                                      | radiator 399.5×120×30 mm; block 72.15×73.05×61.98 mm; 2.88″ LCD; tube 385 mm | GA2ALCD36W                                                             | null                   | https://lian-li.com/product/galahad-ii-lcd/                                                                                                      |
| 11  | Lian Li Galahad II LCD 360 (Black)                         | cooler      | Black                                      | as #10                                                                       | GA2ALCD36B                                                             | null                   | https://lian-li.com/product/galahad-ii-lcd/                                                                                                      |
| 12  | Lian Li HydroShift LCD 360S (White) · v5 guess             | cooler      | White                                      | radiator 403×124.5×27 mm; block 72×72×59 mm; 2.88″ LCD; tube 475 mm          | HSLCD36SW                                                              | null                   | https://lian-li.com/product/hydroshift-aio/                                                                                                      |
| 13  | NZXT Kraken Elite 360 RGB (White)                          | cooler      | White (variant to select)                  | radiator 401×120×27 mm (L×W×H); 2.72″ (69 mm) LCD; cap 93.5 mm               | not shown on the page text read                                        | null\*                 | https://nzxt.com/products/kraken-360-elite-rgb-1                                                                                                 |
| 14  | Lian Li UNI FAN TL 120 (White, 3-pack) · AI guess          | fan         | White                                      | 124×120×28 mm                                                                | 12TL3W                                                                 | null                   | https://lian-li.com/product/uni-fan-tl/                                                                                                          |
| 15  | Lian Li UNI FAN TL 120 (Black, 3-pack)                     | fan         | Black                                      | 124×120×28 mm                                                                | 12TL3B                                                                 | null                   | https://lian-li.com/product/uni-fan-tl/                                                                                                          |
| 16  | Phanteks D30-120 DRGB PWM (White, 3-pack)                  | fan         | White                                      | 120×120×30 mm                                                                | PH-F120D30_DRGB_PWM_WT01_3P                                            | null                   | https://phanteks.com/product/d30-120-white/                                                                                                      |
| 17  | CORSAIR VENGEANCE RGB 32GB (2×16GB) DDR5-6000 CL36 (White) | memory      | White                                      | module height not listed                                                     | CMH32GX5M2E6000C36W                                                    | $509.99                | https://www.corsair.com/us/en/p/memory/cmh32gx5m2e6000c36w/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mts-cl36-memory-kit-white-cmh32gx5m2e6000c36w |
| 18  | CORSAIR VENGEANCE RGB 32GB (2×16GB) DDR5-6000 CL36 (Black) | memory      | Black                                      | module height not listed                                                     | CMH32GX5M2E6000C36                                                     | null                   | https://www.corsair.com/ww/en/p/ddr5-ram/cmh32gx5m2e6000c36/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mt-s-c36-memory-kit-black-cmh32gx5m2e6000c36 |
| 19  | ASUS ROG STRIX B850-A GAMING WIFI                          | motherboard | White ("striking white PCB")               | ATX, 30.5×24.4 cm; AM5, B850                                                 | (model name)                                                           | null                   | https://rog.asus.com/motherboards/rog-strix/rog-strix-b850-a-gaming-wifi/ (spec: …/spec/)                                                        |
| 20  | ASUS ROG STRIX Z890-A GAMING WIFI                          | motherboard | White ("sleek white surface", "white PCB") | ATX, 30.5×24.4 cm; Z890                                                      | (model name)                                                           | null                   | https://rog.asus.com/motherboards/rog-strix/rog-strix-z890-a-gaming-wifi/ (spec: …/spec/)                                                        |

- **Table notes:**
  - \* #13: the page shows $299.99, but its size selector read "240 mm", so the price may not be for the 360. It stays null until it is read with the 360 white selected.
  - Prices were read live from each manufacturer's store on 2026-10-28. The NZXT, HYTE and Corsair entries are store pages.
- **Mix:**
  - 13 white, 4 black, 3 with colour not stated in text (#6, #7, #9);
  - 5 cases, 4 GPUs, 4 coolers, 3 fans, 2 memory, 2 motherboards.
- **Replaced during research:**
  - The GIGABYTE B850 AORUS ELITE WIFI7 ICE page states no colour in text; replaced by the ASUS Z890-A.
  - Thermalright (Phantom Spirit 120 SE) was unreachable (HTTP 522); replaced by the black Galahad II LCD.
- **Memory caveat:** memory is not yet a matching category (`visibleCatalogCategories` is case, gpu, cooler, fan and motherboard). #17–18 add the parts, but photo matching would also need memory added there. That is a separate change.

## Existing five motherboards: colour

None of the five manufacturer pages states the board colour in its own text.

- ASUS pages add "PCB color … subject to change without notice".
- The only colour words on the ASUS pages are quoted third-party reviews (for example "all-black theme"), which we do not use.
- The colour is visible only in the manufacturer's product photos.

| Catalog id         | Model                           | Manufacturer page                                                                               | Colour in page text                             | In maker photos    |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------ |
| mobo-z790-hero     | ASUS ROG Maximus Z790 Hero WiFi | https://rog.asus.com/motherboards/rog-maximus/rog-maximus-z790-hero/                            | not stated (page did not render in the browser) | black (to confirm) |
| mobo-b760-aorus    | GIGABYTE B760 AORUS ELITE AX    | https://www.gigabyte.com/Motherboard/B760-AORUS-ELITE-AX-rev-1x                                 | not stated                                      | black (to confirm) |
| mobo-x670e-hero    | ASUS ROG Crosshair X670E Hero   | https://rog.asus.com/motherboards/rog-crosshair/rog-crosshair-x670e-hero-model/                 | not stated                                      | black (to confirm) |
| mobo-b650-tomahawk | MSI MAG B650 TOMAHAWK WIFI      | https://www.msi.com/Motherboard/MAG-B650-TOMAHAWK-WIFI                                          | not stated                                      | black (to confirm) |
| mobo-z790-tuf      | ASUS TUF GAMING Z790-PLUS WIFI  | https://www.asus.com/motherboards-components/motherboards/tuf-gaming/tuf-gaming-z790-plus-wifi/ | not stated                                      | black (to confirm) |

## Open questions

1. **Colour from product photos.** May a colour be recorded from the manufacturer's own product photos when the text does not state it, marked `colorBasis: "manufacturer photo"`? This affects the five boards above and #6, #7 and #9. If not, those colours stay unknown, and the boards keep matching nothing for a white photo, as now.
2. **Memory matching.** Add memory to the matching categories, or enter #17–18 as Studio-only parts?
3. **Remove or swap** any candidate before entry.
