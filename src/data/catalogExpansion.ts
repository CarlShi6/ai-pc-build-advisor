import type { ShowcaseDimensions } from "@/data/showcaseParts";
import type { Part, PartCategory } from "@/types/parts";

/**
 * Step C catalog expansion (approved 2026-10-28; list in
 * docs/milestones/STEP_C_CATALOG_CANDIDATES.md). Every value was read on 2026-10-28 from the
 * manufacturer's own page (`productUrl`), and prices only from the manufacturer's own store.
 *
 * Same rules as `showcaseParts.ts`: a field the page did not state is left out; no price means
 * `priceStatus: "unknown"`, never $0; dimensions are quoted exactly as published.
 *
 * A pump screen (`specs.pumpDisplay`) is recorded only where the page names the display.
 *
 * Colour: `colorSource` is "maker_text" when the page says it in words (or the model name
 * does), "maker_image" when only the manufacturer's own product photos show it
 * (`colorSourceUrl`). The UI labels the latter "Color from maker photo".
 */
export const EXPANSION_VERIFIED = "2026-10-28";
export const EXPANSION_PRICE_LABEL = `Manufacturer store price, verified ${EXPANSION_VERIFIED}`;

interface ExpansionSource {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  /** Manufacturer part number; null when the page does not tie one to this colour. */
  partNumber: string | null;
  productUrl: string;
  price: { amount: number; url: string } | null;
  dimensions: ShowcaseDimensions | null;
  color: "White" | "Black";
  colorSource: "maker_text" | "maker_image";
  /** The manufacturer page whose photos show the colour (maker_image only). */
  colorSourceUrl?: string;
  specs: Part["specs"];
  notes?: string[];
}

const sources: ExpansionSource[] = [
  {
    id: "maker-case-montech-king-95-white",
    category: "case",
    brand: "MONTECH",
    model: "KING 95 Pure White",
    displayName: "MONTECH KING 95 (Pure White)",
    partNumber: null,
    productUrl: "https://www.montechpc.com/king-95",
    price: null,
    dimensions: {
      asPublished: "475*300*442mm (Case), L*W*H",
      mm: { width: 300, height: 442, depth: 475 },
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      formFactorSupport: "ATX,mATX,Mini-ITX",
      gpuClearanceMm: 420,
      coolerClearanceMm: 175,
      radiatorSupportMm: 360,
      color: "White",
    },
    notes: [
      'Colour options listed as "Gentleman Black / Pure White / Prussian Blue / Vibrant Red".',
      "The page lists EANs without saying which colour each belongs to, so no part number is recorded.",
    ],
  },
  {
    id: "maker-case-phanteks-ph-nv523tg-dmw01",
    category: "case",
    brand: "Phanteks",
    model: "NV5 Matte White",
    displayName: "Phanteks NV5 (Matte White)",
    partNumber: "PH-NV523TG_DMW01",
    productUrl: "https://phanteks.com/product/nv5-white/",
    price: null,
    dimensions: {
      asPublished: "239 x 477 x 528 mm (WxDxH)",
      mm: { width: 239, height: 528, depth: 477 },
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      gpuClearanceMm: 440,
      coolerClearanceMm: 180,
      radiatorSupportMm: 360,
      color: "White",
    },
    notes: ['Colour: "Matte White". Dual 360 radiator support in the top and side.'],
  },
  {
    id: "maker-case-nzxt-cm-h92fw-01",
    category: "case",
    brand: "NZXT",
    model: "H9 Flow White",
    displayName: "NZXT H9 Flow (White)",
    partNumber: "CM-H92FW-01",
    productUrl: "https://nzxt.com/products/h9-flow",
    price: { amount: 169.99, url: "https://nzxt.com/products/h9-flow" },
    dimensions: {
      asPublished: "506 x 315 x 481 mm (H x W x D)",
      mm: { width: 315, height: 506, depth: 481 },
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      gpuClearanceMm: 459,
      coolerClearanceMm: 165,
      radiatorSupportMm: 420,
      color: "White",
    },
    notes: ["GPU up to 410 mm with a 56 mm thick 420 mm AIO at the front-right."],
  },
  {
    id: "maker-case-hyte-cs-hyte-y60-ww",
    category: "case",
    brand: "HYTE",
    model: "Y60 Snow White",
    displayName: "HYTE Y60 (Snow White)",
    partNumber: "CS-HYTE-Y60-WW",
    productUrl: "https://hyte.com/store/y60/cs-hyte-y60-ww",
    price: { amount: 179.99, url: "https://hyte.com/store/y60/cs-hyte-y60-ww" },
    dimensions: {
      asPublished: "456mm (L) x 285mm (W) x 462mm (H)",
      mm: { width: 285, height: 462, depth: 456 },
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      gpuClearanceMm: 375,
      coolerClearanceMm: 160,
      radiatorSupportMm: 360,
      color: "White",
    },
    notes: [
      "GPU up to 75 mm thick (60 mm or less recommended).",
      "Marked out of stock on the HYTE store on 2026-10-28.",
    ],
  },
  {
    id: "maker-case-lianli-lancool-216-black",
    category: "case",
    brand: "Lian Li",
    model: "LANCOOL 216 Black",
    displayName: "Lian Li LANCOOL 216 (Black)",
    partNumber: null,
    productUrl: "https://lian-li.com/product/lancool-216/",
    price: null,
    dimensions: {
      asPublished: "(D) 480.9mm x (W) 235mm x (H) 491.7mm",
      mm: { width: 235, height: 491.7, depth: 480.9 },
    },
    color: "Black",
    colorSource: "maker_text",
    specs: {
      formFactorSupport: "E-ATX,ATX,mATX,Mini-ITX",
      gpuClearanceMm: 392,
      coolerClearanceMm: 180.5,
      psuClearanceMm: 220,
      radiatorSupportMm: 360,
      color: "Black",
    },
    notes: [
      "E-ATX under 280 mm. The page lists several black model codes (216X, 216RX, 216RC-X), so no single part number is recorded.",
    ],
  },
  {
    id: "maker-gpu-gigabyte-gv-n507taero-oc-16gd",
    category: "gpu",
    brand: "GIGABYTE",
    model: "GeForce RTX 5070 Ti AERO OC 16G",
    displayName: "GIGABYTE GeForce RTX 5070 Ti AERO OC 16G",
    partNumber: "GV-N507TAERO OC-16GD",
    productUrl: "https://www.gigabyte.com/Graphics-Card/GV-N507TAERO-OC-16GD/sp",
    price: null,
    dimensions: { asPublished: "L=342 W=140 H=70 mm", mm: { width: 342, height: 140, depth: 70 } },
    color: "White",
    colorSource: "maker_image",
    colorSourceUrl: "https://www.gigabyte.com/Graphics-Card/GV-N507TAERO-OC-16GD",
    specs: {
      chipset: "RTX 5070 Ti",
      vramGb: 16,
      lengthMm: 342,
      recommendedPsuW: 750,
      powerConnector: "16 pin*1",
      color: "White",
    },
  },
  {
    id: "maker-gpu-gigabyte-gv-n5070aero-oc-12gd",
    category: "gpu",
    brand: "GIGABYTE",
    model: "GeForce RTX 5070 AERO OC 12G",
    displayName: "GIGABYTE GeForce RTX 5070 AERO OC 12G",
    partNumber: "GV-N5070AERO OC-12GD",
    productUrl: "https://www.gigabyte.com/Graphics-Card/GV-N5070AERO-OC-12GD/sp",
    price: null,
    dimensions: { asPublished: "L=324 W=130 H=56 mm", mm: { width: 324, height: 130, depth: 56 } },
    color: "White",
    colorSource: "maker_image",
    colorSourceUrl: "https://www.gigabyte.com/Graphics-Card/GV-N5070AERO-OC-12GD",
    specs: {
      chipset: "RTX 5070",
      vramGb: 12,
      lengthMm: 324,
      recommendedPsuW: 750,
      powerConnector: "16 Pin*1",
      color: "White",
    },
  },
  {
    id: "maker-gpu-asus-tuf-rtx5070ti-o16g-white-gaming",
    category: "gpu",
    brand: "ASUS",
    model: "TUF Gaming GeForce RTX 5070 Ti 16GB GDDR7 White OC Edition",
    displayName: "ASUS TUF Gaming GeForce RTX 5070 Ti White OC Edition",
    partNumber: "TUF-RTX5070TI-O16G-WHITE-GAMING",
    productUrl:
      "https://www.asus.com/us/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-white-gaming/techspec/",
    price: null,
    dimensions: {
      asPublished: "329 x 140 x 62.5 mm",
      mm: { width: 329, height: 140, depth: 62.5 },
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      chipset: "RTX 5070 Ti",
      vramGb: 16,
      lengthMm: 329,
      recommendedPsuW: 850,
      powerConnector: "1 x 16-pin",
      slotWidth: "3.125 Slot",
      color: "White",
    },
  },
  {
    id: "maker-gpu-asus-tuf-rtx5070ti-o16g-gaming",
    category: "gpu",
    brand: "ASUS",
    model: "TUF Gaming GeForce RTX 5070 Ti 16GB GDDR7 OC Edition",
    displayName: "ASUS TUF Gaming GeForce RTX 5070 Ti OC Edition",
    partNumber: "TUF-RTX5070TI-O16G-GAMING",
    productUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-gaming/techspec/",
    price: null,
    dimensions: {
      asPublished: "329 x 140 x 62.5 mm",
      mm: { width: 329, height: 140, depth: 62.5 },
    },
    color: "Black",
    colorSource: "maker_image",
    colorSourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-gaming/",
    specs: {
      chipset: "RTX 5070 Ti",
      vramGb: 16,
      lengthMm: 329,
      recommendedPsuW: 850,
      powerConnector: "1 x 16-pin",
      slotWidth: "3.125 Slot",
      color: "Black",
    },
  },
  {
    id: "maker-cooler-lianli-ga2alcd36w",
    category: "cooler",
    brand: "Lian Li",
    model: "GALAHAD II LCD 360 White",
    displayName: "Lian Li Galahad II LCD 360 (White)",
    partNumber: "GA2ALCD36W",
    productUrl: "https://lian-li.com/product/galahad-ii-lcd/",
    price: null,
    dimensions: {
      asPublished: "Radiator 399.5 x 120 x 30mm · Water block 72.15 × 73.05 × 61.98 mm",
    },
    color: "White",
    colorSource: "maker_text",
    specs: {
      coolerType: "aio",
      radiatorMm: 360,
      tubingLengthMm: 385,
      pumpDisplay: '2.88" IPS LCD',
      color: "White",
    },
    notes: ['2.88" IPS LCD on the pump. Fans 123 x 120 x 25mm.'],
  },
  {
    id: "maker-cooler-lianli-ga2alcd36b",
    category: "cooler",
    brand: "Lian Li",
    model: "GALAHAD II LCD 360 Black",
    displayName: "Lian Li Galahad II LCD 360 (Black)",
    partNumber: "GA2ALCD36B",
    productUrl: "https://lian-li.com/product/galahad-ii-lcd/",
    price: null,
    dimensions: {
      asPublished: "Radiator 399.5 x 120 x 30mm · Water block 72.15 × 73.05 × 61.98 mm",
    },
    color: "Black",
    colorSource: "maker_text",
    specs: {
      coolerType: "aio",
      radiatorMm: 360,
      tubingLengthMm: 385,
      pumpDisplay: '2.88" IPS LCD',
      color: "Black",
    },
    notes: ['2.88" IPS LCD on the pump. Fans 123 x 120 x 25mm.'],
  },
  {
    id: "maker-cooler-lianli-hslcd36sw",
    category: "cooler",
    brand: "Lian Li",
    model: "HydroShift LCD 360S White",
    displayName: "Lian Li HydroShift LCD 360S (White)",
    partNumber: "HSLCD36SW",
    productUrl: "https://lian-li.com/product/hydroshift-aio/",
    price: null,
    dimensions: { asPublished: "Radiator 403 x 124.5 x 27mm · Water block 72 x 72 x 59mm" },
    color: "White",
    colorSource: "maker_text",
    specs: {
      coolerType: "aio",
      radiatorMm: 360,
      tubingLengthMm: 475,
      pumpDisplay: '2.88" IPS LCD',
      color: "White",
    },
    notes: ['2.88" IPS LCD (480 × 480). Fans 124 x 120 x 28 mm.'],
  },
  {
    id: "maker-cooler-nzxt-kraken-elite-360-rgb-white",
    category: "cooler",
    brand: "NZXT",
    model: "Kraken Elite 360 RGB White",
    displayName: "NZXT Kraken Elite 360 RGB (White)",
    partNumber: null,
    productUrl: "https://nzxt.com/products/kraken-360-elite-rgb-1",
    price: null,
    dimensions: { asPublished: "Radiator 401 x 120 x 27 mm (L x W x H)" },
    color: "White",
    colorSource: "maker_text",
    specs: { coolerType: "aio", radiatorMm: 360, pumpDisplay: "2.72 in IPS LCD", color: "White" },
    notes: [
      "2.72 in (69 mm) IPS LCD, 640 x 640; pump cap 93.5 mm across.",
      "The store price shown could not be tied to the 360 White option, so the price is unknown.",
    ],
  },
  {
    id: "maker-cooler-deepcool-r-ak620-bknnmt-g-1",
    category: "cooler",
    brand: "DeepCool",
    model: "AK620 ZERO DARK",
    displayName: "DeepCool AK620 ZERO DARK",
    partNumber: "R-AK620-BKNNMT-G-1",
    productUrl:
      "https://www.deepcool.com/products/Cooling/cpuaircoolers/AK620-ZERO-DARK-High-Performance-CPU-Cooler-1851-1700-AM5/2024/16124.shtml",
    price: null,
    dimensions: {
      asPublished: "129×138×160 mm (L×W×H); heatsink 127×110×157 mm",
    },
    color: "Black",
    colorSource: "maker_text",
    specs: { coolerType: "air", heightMm: 160, color: "Black" },
    notes: ['DeepCool: "an all-black edition of the dominant AK620". Net weight 1456 g.'],
  },
  {
    id: "maker-ram-corsair-cmh32gx5m2e6000c36w",
    category: "ram",
    brand: "Corsair",
    model: "VENGEANCE RGB 32GB (2x16GB) DDR5 6000 CL36 White",
    displayName: "Corsair VENGEANCE RGB 32GB DDR5-6000 CL36 (White)",
    partNumber: "CMH32GX5M2E6000C36W",
    productUrl:
      "https://www.corsair.com/us/en/p/memory/cmh32gx5m2e6000c36w/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mts-cl36-memory-kit-white-cmh32gx5m2e6000c36w",
    price: {
      amount: 509.99,
      url: "https://www.corsair.com/us/en/p/memory/cmh32gx5m2e6000c36w/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mts-cl36-memory-kit-white-cmh32gx5m2e6000c36w",
    },
    dimensions: null,
    color: "White",
    colorSource: "maker_text",
    specs: {
      capacityGb: 32,
      speedMt: 6000,
      ramType: "DDR5",
      sticks: 2,
      latency: "CL36",
      profile: "Intel XMP",
      lighting: "RGB",
      color: "White",
    },
    notes: ["Module height is not on the product page."],
  },
  {
    id: "maker-ram-corsair-cmh32gx5m2e6000c36",
    category: "ram",
    brand: "Corsair",
    model: "VENGEANCE RGB 32GB (2x16GB) DDR5 6000 CL36 Black",
    displayName: "Corsair VENGEANCE RGB 32GB DDR5-6000 CL36 (Black)",
    partNumber: "CMH32GX5M2E6000C36",
    productUrl:
      "https://www.corsair.com/ww/en/p/ddr5-ram/cmh32gx5m2e6000c36/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mt-s-c36-memory-kit-black-cmh32gx5m2e6000c36",
    price: null,
    dimensions: null,
    color: "Black",
    colorSource: "maker_text",
    specs: {
      capacityGb: 32,
      speedMt: 6000,
      ramType: "DDR5",
      sticks: 2,
      latency: "CL36",
      lighting: "RGB",
      color: "Black",
    },
    notes: ["Module height is not on the product page. No price was shown on the page."],
  },
  {
    id: "maker-mobo-asus-rog-strix-b850-a-gaming-wifi",
    category: "motherboard",
    brand: "ASUS",
    model: "ROG STRIX B850-A GAMING WIFI",
    displayName: "ASUS ROG STRIX B850-A GAMING WIFI",
    partNumber: null,
    productUrl: "https://rog.asus.com/motherboards/rog-strix/rog-strix-b850-a-gaming-wifi/spec/",
    price: null,
    dimensions: { asPublished: "ATX Form Factor, 12 inch x 9.6 inch ( 30.5 cm x 24.4 cm )" },
    color: "White",
    colorSource: "maker_text",
    specs: {
      socket: "AM5",
      chipset: "B850",
      formFactor: "ATX",
      ramType: "DDR5",
      maxRamGb: 256,
      color: "White",
    },
    notes: ['ASUS: "striking white PCB". ASUS also notes PCB colour is subject to change.'],
  },
  {
    id: "maker-mobo-asus-rog-strix-z890-a-gaming-wifi",
    category: "motherboard",
    brand: "ASUS",
    model: "ROG STRIX Z890-A GAMING WIFI",
    displayName: "ASUS ROG STRIX Z890-A GAMING WIFI",
    partNumber: null,
    productUrl: "https://rog.asus.com/motherboards/rog-strix/rog-strix-z890-a-gaming-wifi/spec/",
    price: null,
    dimensions: { asPublished: "ATX Form Factor, 12 inch x 9.6 inch ( 30.5 cm x 24.4 cm )" },
    color: "White",
    colorSource: "maker_text",
    specs: { chipset: "Z890", formFactor: "ATX", ramType: "DDR5", maxRamGb: 256, color: "White" },
    notes: [
      'ASUS: "sleek white surface". The spec page names the processors, not the socket, so the socket is unknown.',
    ],
  },
];

export const expansionMeta: Record<
  string,
  { partNumber: string | null; dimensions: ShowcaseDimensions | null; notes: string[] }
> = Object.fromEntries(
  sources.map((source) => [
    source.id,
    { partNumber: source.partNumber, dimensions: source.dimensions, notes: source.notes ?? [] },
  ]),
);

function searchUrl(brand: string, model: string) {
  return `https://www.newegg.com/p/pl?d=${encodeURIComponent(`${brand} ${model}`)}`;
}

export const expansionParts: Part[] = sources.map((source) => ({
  id: source.id,
  category: source.category,
  brand: source.brand,
  model: source.model,
  displayName: source.displayName,
  // Unknown prices are flagged and excluded from totals; 0 is only a placeholder number.
  price: source.price?.amount ?? 0,
  priceStatus: source.price ? undefined : "unknown",
  priceSource: source.price
    ? { label: EXPANSION_PRICE_LABEL, url: source.price.url, verifiedAt: EXPANSION_VERIFIED }
    : undefined,
  source: "catalog",
  productUrl: source.productUrl,
  searchUrl: searchUrl(source.brand, source.model),
  ...(source.partNumber && { partNumber: source.partNumber }),
  color: source.color,
  colorSource: source.colorSource,
  ...(source.colorSourceUrl && { colorSourceUrl: source.colorSourceUrl }),
  availability: "unknown",
  lastUpdated: EXPANSION_VERIFIED,
  specs: source.specs,
  compatibilityTags: ["maker-sourced"],
}));
