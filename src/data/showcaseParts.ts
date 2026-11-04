import type { Part, PartCategory } from "@/types/parts";

/**
 * White showcase parts for the demo track (week 3), all read on 2026-10-25 from each
 * manufacturer's own product page (`productUrl`) and, for prices, the manufacturer's own store.
 *
 * Rules: nothing is estimated or taken from third parties. A field the page did not state
 * clearly is left out (the compatibility rules then report "not enough data"). When the
 * manufacturer shows no price, the price is unknown (`priceStatus: "unknown"`), never $0.
 * Dimensions are millimetres exactly as published.
 *
 * These parts are v3-only (`src/lib/v3/catalog.ts`); the pre-v3 pages keep `seedParts`.
 */
const VERIFIED = "2026-10-25";

export interface ShowcaseDimensions {
  /** Exactly as the manufacturer prints it. */
  asPublished: string;
  /** Parsed millimetre values; omitted when the page gives no clear unit. */
  mm?: { width: number; height: number; depth: number };
}

interface ShowcaseSource {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  partNumber: string;
  productUrl: string;
  /** Manufacturer store price page and amount, or null when no price is shown. */
  price: { amount: number; url: string } | null;
  dimensions: ShowcaseDimensions | null;
  specs: Part["specs"];
  notes?: string[];
}

const sources: ShowcaseSource[] = [
  {
    id: "showcase-case-lianli-o11dew",
    category: "case",
    brand: "Lian Li",
    model: "O11 Dynamic EVO White",
    displayName: "Lian Li O11 Dynamic EVO (White)",
    partNumber: "O11DEW",
    productUrl: "https://lian-li.com/product/o11-dynamic-evo/",
    price: null,
    dimensions: {
      asPublished: "(D)465mm × (W)285mm × (H)459mm",
      mm: { width: 285, height: 459, depth: 465 },
    },
    specs: {
      formFactorSupport: "E-ATX,ATX,mATX,Mini-ITX",
      gpuClearanceMm: 426,
      coolerClearanceMm: 167,
      psuClearanceMm: 220,
      radiatorSupportMm: 360,
      color: "White",
    },
    notes: ["E-ATX boards under 280 mm wide."],
  },
  {
    id: "showcase-case-nzxt-cc-h52fw-01",
    category: "case",
    brand: "NZXT",
    model: "H5 Flow White",
    displayName: "NZXT H5 Flow (White)",
    partNumber: "CC-H52FW-01",
    productUrl: "https://nzxt.com/products/h5-flow",
    price: { amount: 94.99, url: "https://nzxt.com/products/h5-flow" },
    dimensions: {
      asPublished: "465 x 225 x 430 mm (H x W x D)",
      mm: { width: 225, height: 465, depth: 430 },
    },
    specs: {
      formFactorSupport: "E-ATX,ATX,mATX,Mini-ITX",
      gpuClearanceMm: 410,
      coolerClearanceMm: 170,
      psuClearanceMm: 200,
      color: "White",
    },
    notes: ["E-ATX up to 277 mm. Radiator support was not read from the page, so it is unknown."],
  },
  {
    id: "showcase-case-corsair-cc-9011201-ww",
    category: "case",
    brand: "Corsair",
    model: "4000D Airflow White",
    displayName: "Corsair 4000D Airflow (White)",
    partNumber: "CC-9011201-WW",
    productUrl:
      "https://www.corsair.com/us/en/p/pc-cases/cc-9011201-ww/4000d-airflow-tempered-glass-mid-tower-atx-case-white-cc-9011201-ww",
    price: null,
    dimensions: {
      asPublished: "Case Height 466 · Case Length 453 · Case Width 230",
      mm: { width: 230, height: 466, depth: 453 },
    },
    specs: {
      formFactorSupport: "E-ATX,ATX,mATX,Mini-ITX",
      gpuClearanceMm: 360,
      coolerClearanceMm: 170,
      psuClearanceMm: 220,
      radiatorSupportMm: 360,
      color: "White",
    },
    notes: [
      "Corsair: fits GPUs under 340 mm with a front-mounted AIO, and up to 360 mm with a top-mounted AIO.",
      "No price shown for the case on Corsair's store page.",
    ],
  },
  {
    id: "showcase-gpu-msi-g507t-16gtcw",
    category: "gpu",
    brand: "MSI",
    model: "GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE",
    displayName: "MSI GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE",
    partNumber: "G507T-16GTCW",
    productUrl:
      "https://www.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-GAMING-TRIO-OC-WHITE/Specification",
    price: {
      amount: 1249.99,
      url: "https://us-store.msi.com/GeForce-RTX-5070-Ti-16G-GAMING-TRIO-OC-WHITE",
    },
    dimensions: { asPublished: "338 x 140 x 50 mm", mm: { width: 338, height: 140, depth: 50 } },
    specs: {
      chipset: "RTX 5070 Ti",
      vramGb: 16,
      lengthMm: 338,
      powerDrawW: 300,
      recommendedPsuW: 750,
      powerConnector: "16-pin x 1",
      color: "White",
    },
  },
  {
    id: "showcase-gpu-asus-prime-rtx5070-o12g-white",
    category: "gpu",
    brand: "ASUS",
    model: "PRIME GeForce RTX 5070 White OC Edition 12GB",
    displayName: "ASUS PRIME GeForce RTX 5070 White OC Edition",
    partNumber: "PRIME-RTX5070-O12G-WHITE",
    productUrl:
      "https://www.asus.com/us/motherboards-components/graphics-cards/prime/prime-rtx5070-o12g-white/techspec/",
    price: {
      amount: 919.99,
      url: "https://eshop.asus.com/us/90yv0m19-mvaa00-asus-prime-geforce-rtxtm-5070-white-oc-edition-12gb-gddr7.html",
    },
    dimensions: { asPublished: "304 x 126 x 50 mm", mm: { width: 304, height: 126, depth: 50 } },
    specs: {
      chipset: "RTX 5070",
      vramGb: 12,
      lengthMm: 304,
      recommendedPsuW: 750,
      powerConnector: "1 x 16-pin",
      slotWidth: "2.5 slot",
      color: "White",
    },
    notes: ["ASUS eShop part number 90YV0M19-MVAA00. Board power is not listed, so it is unknown."],
  },
  {
    id: "showcase-cooler-corsair-cw-9061021-ww",
    category: "cooler",
    brand: "Corsair",
    model: "iCUE LINK TITAN 360 RX RGB White",
    displayName: "Corsair iCUE LINK TITAN 360 RX RGB AIO (White)",
    partNumber: "CW-9061021-WW",
    productUrl:
      "https://www.corsair.com/us/en/p/cpu-coolers/cw-9061021-ww/icue-link-titan-360-rx-rgb-aio-liquid-cpu-cooler-white-cw-9061021-ww",
    price: {
      amount: 199.99,
      url: "https://www.corsair.com/us/en/p/cpu-coolers/cw-9061021-ww/icue-link-titan-360-rx-rgb-aio-liquid-cpu-cooler-white-cw-9061021-ww",
    },
    // The page lists "Product Length 396 / Height 125 / Width 125" without units.
    dimensions: { asPublished: "Product Length 396 · Product Height 125 · Product Width 125" },
    specs: {
      coolerType: "aio",
      radiatorMm: 360,
      tubingLengthMm: 450,
      socketSupport: "LGA1851,LGA1700,AM5,AM4",
      color: "White",
    },
    notes: ["Three RX120 RGB fans; iCUE LINK connectivity."],
  },
  {
    id: "showcase-ram-corsair-cmh32gx5m2b6000c30w",
    category: "ram",
    brand: "Corsair",
    model: "VENGEANCE RGB 32GB (2x16GB) DDR5 6000 CL30 White",
    displayName: "Corsair VENGEANCE RGB 32GB DDR5-6000 CL30 (White)",
    partNumber: "CMH32GX5M2B6000C30W",
    productUrl:
      "https://www.corsair.com/us/en/p/memory/cmh32gx5m2b6000c30w/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mt-s-cl30-memory-kit-white-cmh32gx5m2b6000c30w",
    price: {
      amount: 657.99,
      url: "https://www.corsair.com/us/en/p/memory/cmh32gx5m2b6000c30w/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mt-s-cl30-memory-kit-white-cmh32gx5m2b6000c30w",
    },
    dimensions: null,
    specs: {
      capacityGb: 32,
      speedMt: 6000,
      ramType: "DDR5",
      sticks: 2,
      latency: "CL30",
      profile: "Intel XMP",
      color: "White",
    },
    notes: [
      "Module size is not on the product page; the 3D model uses Corsair's DDR5 module dimensions page (VENGEANCE RGB, CMH: 135 x 8 x 44 mm), verified 2026-10-26.",
    ],
  },
  {
    id: "showcase-psu-corsair-cp-9020274-na",
    category: "psu",
    brand: "Corsair",
    model: "RM850x SHIFT White",
    displayName: "Corsair RM850x SHIFT 850W (White)",
    partNumber: "CP-9020274-NA",
    productUrl:
      "https://www.corsair.com/us/en/p/psu/cp-9020274-na/rm850x-shift-80-plus-gold-fully-modular-atx-power-supply-white-na-cp-9020274-na",
    price: {
      amount: 189.99,
      url: "https://www.corsair.com/us/en/p/psu/cp-9020274-na/rm850x-shift-80-plus-gold-fully-modular-atx-power-supply-white-na-cp-9020274-na",
    },
    dimensions: null,
    specs: {
      wattageW: 850,
      efficiency: "80+ Gold",
      modular: true,
      atxVersion: "ATX 3.1",
      fanSizeMm: 140,
      color: "White",
    },
    notes: ["Side-mounted modular connectors. PSU length is not on the page, so it is unknown."],
  },
];

export const SHOWCASE_PRICE_LABEL = `Manufacturer store price, verified ${VERIFIED}`;

export interface ShowcaseMeta {
  partNumber: string;
  dimensions: ShowcaseDimensions | null;
  notes: string[];
  verifiedAt: string;
}

export const showcaseMeta: Record<string, ShowcaseMeta> = Object.fromEntries(
  sources.map((source) => [
    source.id,
    {
      partNumber: source.partNumber,
      dimensions: source.dimensions,
      notes: source.notes ?? [],
      verifiedAt: VERIFIED,
    },
  ]),
);

/**
 * Case appearance for photo matching (visual redesign slice A2), read on 2026-10-26 from each
 * case's `productUrl`. A field is set only when the page names it in words; anything the page
 * leaves unsaid is null (unknown), and an unknown never counts for or against a candidate.
 */
export type FrontPanelMaterial = "glass" | "mesh" | "perforated";

export interface CaseAppearance {
  frontPanel: FrontPanelMaterial | null;
  layout: "dual-chamber" | null;
  /** The manufacturer's own words behind each field, or why it stays unknown. */
  evidence: string[];
  sourceUrl: string;
  verifiedAt: string;
}

const APPEARANCE_VERIFIED = "2026-10-26";
const STEP_C_APPEARANCE_VERIFIED = "2026-11-04";

export const caseAppearance: Record<string, CaseAppearance> = {
  "showcase-case-lianli-o11dew": {
    frontPanel: "glass",
    layout: "dual-chamber",
    evidence: [
      'Front: "Front and side tempered glass panels for components and RGB display".',
      'Layout: "Dual-chamber layout with hooks friendly cable management compartment".',
    ],
    sourceUrl: "https://lian-li.com/product/o11-dynamic-evo/",
    verifiedAt: APPEARANCE_VERIFIED,
  },
  "showcase-case-nzxt-cc-h52fw-01": {
    frontPanel: "mesh",
    layout: null,
    evidence: [
      'Front: "Ultra-fine mesh on the top, front, and side panels".',
      "Layout: the page does not describe a chamber layout, so it is unknown.",
    ],
    sourceUrl: "https://nzxt.com/products/h5-flow",
    verifiedAt: APPEARANCE_VERIFIED,
  },
  "showcase-case-corsair-cc-9011201-ww": {
    frontPanel: null,
    layout: null,
    evidence: [
      'Front: the page says "High-airflow optimized steel front panel" but not whether it is mesh or perforated, so the material is unknown.',
      "Layout: the page does not describe a chamber layout, so it is unknown.",
    ],
    sourceUrl:
      "https://www.corsair.com/us/en/p/pc-cases/cc-9011201-ww/4000d-airflow-tempered-glass-mid-tower-atx-case-white-cc-9011201-ww",
    verifiedAt: APPEARANCE_VERIFIED,
  },
  // Step C cases (src/data/catalogExpansion.ts), read on 2026-11-04 by the same rule.
  "maker-case-montech-king-95-white": {
    frontPanel: null,
    layout: "dual-chamber",
    evidence: [
      'Front: the case ships with a glass and a mesh panel ("Elegant Glass Mode" and "Turbo Mesh Mode"), so the front can be either and stays unknown.',
      'Layout: "Hardware Harmony with Dual Chamber".',
    ],
    sourceUrl: "https://www.montechpc.com/king-95",
    verifiedAt: STEP_C_APPEARANCE_VERIFIED,
  },
  "maker-case-phanteks-ph-nv523tg-dmw01": {
    frontPanel: null,
    layout: null,
    evidence: [
      'Front: the page says "Near-seamless glass panels" without naming the front, so it is unknown.',
      "Layout: the page does not describe a chamber layout, so it is unknown.",
    ],
    sourceUrl: "https://phanteks.com/product/nv5-white/",
    verifiedAt: STEP_C_APPEARANCE_VERIFIED,
  },
  "maker-case-nzxt-cm-h92fw-01": {
    frontPanel: null,
    layout: "dual-chamber",
    evidence: [
      'Front: the page names "wraparound tempered glass paneling" and also mesh and perforated panels, but not which is the front, so it is unknown.',
      'Layout: "Dual-Chamber Design: Separates main components from the PSU and drives".',
    ],
    sourceUrl: "https://nzxt.com/products/h9-flow",
    verifiedAt: STEP_C_APPEARANCE_VERIFIED,
  },
  "maker-case-hyte-cs-hyte-y60-ww": {
    frontPanel: null,
    layout: "dual-chamber",
    evidence: [
      'Front: the page says "3-piece panoramic tempered glass design" without naming the front, so it is unknown.',
      'Layout: "Type | Dual Chamber Mid-Tower ATX Case".',
    ],
    sourceUrl: "https://hyte.com/store/y60/cs-hyte-y60-ww",
    verifiedAt: STEP_C_APPEARANCE_VERIFIED,
  },
};

function searchUrl(brand: string, model: string) {
  return `https://www.newegg.com/p/pl?d=${encodeURIComponent(`${brand} ${model}`)}`;
}

export const showcaseParts: Part[] = sources.map((source) => ({
  id: source.id,
  category: source.category,
  brand: source.brand,
  model: source.model,
  displayName: source.displayName,
  // Unknown prices are flagged and excluded from totals; 0 is only a placeholder number.
  price: source.price?.amount ?? 0,
  priceStatus: source.price ? undefined : "unknown",
  priceSource: source.price
    ? { label: SHOWCASE_PRICE_LABEL, url: source.price.url, verifiedAt: VERIFIED }
    : undefined,
  source: "catalog",
  productUrl: source.productUrl,
  searchUrl: searchUrl(source.brand, source.model),
  partNumber: source.partNumber,
  color: "White",
  // Every showcase part names its colour in the model name or specs.
  colorSource: "maker_text",
  availability: "unknown",
  lastUpdated: VERIFIED,
  specs: source.specs,
  compatibilityTags: ["white-showcase"],
}));
