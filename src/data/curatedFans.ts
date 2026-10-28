/**
 * Hand-curated case fans for appearance matching (UC-01, e.g. white show builds).
 *
 * Every value below was read from the manufacturer's own product page at `sourceUrl` on
 * `verifiedAt`. Fields the page did not state clearly, or stated inconsistently, are `null`
 * (unknown). Nothing is filled in from third-party sites. No prices are recorded.
 *
 * Fans are not one of the eight Build slots, so these records are not `Part`s and never enter
 * a Build total. They only give the image review real catalog candidates for visible fans.
 */
export interface CuratedFan {
  id: string;
  brand: string;
  /** Series and size as the manufacturer names it. */
  model: string;
  displayName: string;
  /** Manufacturer model or article number for this exact colour and pack. */
  partNumber: string;
  color: "white" | "black";
  /** Nominal frame size. */
  sizeMm: 120 | 140;
  /** Dimensions exactly as published (formats differ between manufacturers). */
  dimensionsAsPublished: string;
  thicknessMm: number | null;
  /** As the manufacturer names it ("D-RGB" is Phanteks' term; "LED" when only LEDs are stated). */
  lighting: "ARGB" | "RGB" | "D-RGB" | "LED";
  lightingConnector: string | null;
  fanConnector: string | null;
  fansInPackage: number | null;
  maxRpm: number | null;
  maxAirflowCfm: number | null;
  maxNoiseDba: number | null;
  /** Requirements or caveats the manufacturer page states, quoted or closely paraphrased. */
  notes: string[];
  sourceUrl: string;
  verifiedAt: string;
}

const VERIFIED = "2026-10-25";

/** Step C additions (docs/milestones/STEP_C_CATALOG_CANDIDATES.md). */
const STEP_C_VERIFIED = "2026-10-28";

const lianLiTl = {
  brand: "Lian Li",
  model: "UNI FAN TL 120",
  sizeMm: 120 as const,
  dimensionsAsPublished: "124 x 120 x 28 mm",
  thicknessMm: 28,
  lighting: "LED" as const,
  lightingConnector: null,
  fanConnector: null,
  fansInPackage: 3,
  maxRpm: 2600,
  maxAirflowCfm: null,
  maxNoiseDba: null,
  notes: [
    '"UNI FAN TL series fans without the controller will not be functional." The triple pack includes the controller.',
    "Each fan has 26 LEDs.",
  ],
  sourceUrl: "https://lian-li.com/product/uni-fan-tl/",
  verifiedAt: STEP_C_VERIFIED,
};

const lianLiSlInf = {
  brand: "Lian Li",
  lighting: "ARGB" as const,
  lightingConnector: "3-pin ARGB",
  fanConnector: "4-pin PWM",
  fansInPackage: 1,
  notes: ["Single pack has 4-pin PWM + 3-pin ARGB cables; triple packs use a 7-pin controller."],
  sourceUrl: "https://lian-li.com/product/uni-fan-sl-infinity/",
  verifiedAt: VERIFIED,
};

const corsairRx120 = {
  brand: "Corsair",
  model: "iCUE LINK RX120 RGB",
  sizeMm: 120 as const,
  dimensionsAsPublished: "120 x 25mm",
  thicknessMm: 25,
  lighting: "RGB" as const,
  lightingConnector: "iCUE LINK",
  fanConnector: "iCUE LINK",
  fansInPackage: 1,
  maxRpm: 2100,
  // The page lists both 74.2 and 73.5 CFM as the maximum, so airflow stays unknown.
  maxAirflowCfm: null,
  maxNoiseDba: 36,
  notes: ["Requires iCUE LINK System Hub (included with RX Starter Kits)."],
  verifiedAt: VERIFIED,
};

const nzxtF120Core = {
  brand: "NZXT",
  model: "F120 RGB Core",
  sizeMm: 120 as const,
  dimensionsAsPublished: "120 x 120 x 26 mm",
  thicknessMm: 26,
  lighting: "RGB" as const,
  lightingConnector: "4-pin NZXT RGB",
  fanConnector: "4-pin PWM",
  fansInPackage: null,
  maxRpm: 1800,
  maxAirflowCfm: 78.86,
  maxNoiseDba: 33.88,
  notes: [
    "Lighting uses a 4-pin NZXT RGB connector; requires a PC with an available NZXT RGB lighting connector.",
  ],
  sourceUrl: "https://nzxt.com/products/f120-core-rgb-1",
  verifiedAt: VERIFIED,
};

const arcticP12Argb = {
  brand: "ARCTIC",
  model: "P12 PWM PST A-RGB",
  sizeMm: 120 as const,
  dimensionsAsPublished: "120 x 120 x 25 mm (L x W x H)",
  thicknessMm: 25,
  lighting: "ARGB" as const,
  lightingConnector: "3-pin 5V-DI-GND",
  fanConnector: "4-pin connector + 4-pin socket (PWM PST)",
  fansInPackage: 1,
  maxRpm: 2000,
  maxAirflowCfm: 48.8,
  // The page states noise only in sone (0.3 Sone), not dB(A).
  maxNoiseDba: null,
  notes: ["0 rpm below 5% PWM."],
  verifiedAt: VERIFIED,
};

const beQuietLightWings = {
  brand: "be quiet!",
  lighting: "ARGB" as const,
  lightingConnector: "5V 3-pin ARGB",
  fanConnector: "4-pin PWM",
  fansInPackage: 3,
  notes: ["Sold as a triple pack with an ARGB hub."],
  verifiedAt: VERIFIED,
};

export const curatedFans: CuratedFan[] = [
  {
    ...lianLiSlInf,
    id: "fan-lianli-uf-slin120-1w",
    model: "UNI FAN SL-INF 120",
    displayName: "Lian Li UNI FAN SL-INF 120 White (single)",
    partNumber: "UF-SLIN120-1W",
    color: "white",
    sizeMm: 120,
    dimensionsAsPublished: "120 X 122.1 X 25 (mm)",
    thicknessMm: 25,
    maxRpm: 2100,
    maxAirflowCfm: 61.3,
    maxNoiseDba: 29,
  },
  {
    ...lianLiSlInf,
    id: "fan-lianli-uf-slin120-1b",
    model: "UNI FAN SL-INF 120",
    displayName: "Lian Li UNI FAN SL-INF 120 Black (single)",
    partNumber: "UF-SLIN120-1B",
    color: "black",
    sizeMm: 120,
    dimensionsAsPublished: "120 X 122.1 X 25 (mm)",
    thicknessMm: 25,
    maxRpm: 2100,
    maxAirflowCfm: 61.3,
    maxNoiseDba: 29,
  },
  {
    ...lianLiSlInf,
    id: "fan-lianli-uf-slin140-1w",
    model: "UNI FAN SL-INF 140",
    displayName: "Lian Li UNI FAN SL-INF 140 White (single)",
    partNumber: "UF-SLIN140-1W",
    color: "white",
    sizeMm: 140,
    dimensionsAsPublished: "140 X 142 X 25 (mm)",
    thicknessMm: 25,
    maxRpm: 1600,
    maxAirflowCfm: 72.7,
    maxNoiseDba: 28,
  },
  {
    ...lianLiSlInf,
    id: "fan-lianli-uf-slin140-1b",
    model: "UNI FAN SL-INF 140",
    displayName: "Lian Li UNI FAN SL-INF 140 Black (single)",
    partNumber: "UF-SLIN140-1B",
    color: "black",
    sizeMm: 140,
    dimensionsAsPublished: "140 X 142 X 25 (mm)",
    thicknessMm: 25,
    maxRpm: 1600,
    maxAirflowCfm: 72.7,
    maxNoiseDba: 28,
  },
  {
    ...corsairRx120,
    id: "fan-corsair-co-9051021-ww",
    displayName: "Corsair iCUE LINK RX120 RGB White (single)",
    partNumber: "CO-9051021-WW",
    color: "white",
    sourceUrl:
      "https://www.corsair.com/us/en/p/case-fans/co-9051021-ww/icue-link-rx120-rgb-120mm-pwm-single-fan-expansion-white-co-9051021-ww",
  },
  {
    ...corsairRx120,
    id: "fan-corsair-co-9051017-ww",
    displayName: "Corsair iCUE LINK RX120 RGB Black (single)",
    partNumber: "CO-9051017-WW",
    color: "black",
    sourceUrl:
      "https://www.corsair.com/us/en/p/case-fans/co-9051017-ww/icue-link-rx120-rgb-120mm-pwm-single-fan-expansion-co-9051017-ww",
  },
  {
    ...nzxtF120Core,
    id: "fan-nzxt-rf-c12sf-w1",
    displayName: "NZXT F120 RGB Core White",
    partNumber: "RF-C12SF-W1",
    color: "white",
  },
  {
    ...nzxtF120Core,
    id: "fan-nzxt-rf-c12sf-b1",
    displayName: "NZXT F120 RGB Core Black",
    partNumber: "RF-C12SF-B1",
    color: "black",
  },
  {
    ...arcticP12Argb,
    id: "fan-arctic-acfan00254a",
    displayName: "ARCTIC P12 PWM PST A-RGB White (single)",
    partNumber: "ACFAN00254A",
    color: "white",
    sourceUrl: "https://www.arctic.de/us/P12-PWM-PST-A-RGB/ACFAN00254A",
  },
  {
    ...arcticP12Argb,
    id: "fan-arctic-acfan00231a",
    displayName: "ARCTIC P12 PWM PST A-RGB Black (single)",
    partNumber: "ACFAN00231A",
    color: "black",
    sourceUrl: "https://www.arctic.de/us/P12-PWM-PST-A-RGB/ACFAN00231A",
  },
  {
    ...beQuietLightWings,
    id: "fan-bequiet-bl100",
    model: "Light Wings 120mm PWM",
    displayName: "be quiet! Light Wings 120mm PWM White (3-pack)",
    partNumber: "BL100",
    color: "white",
    sizeMm: 120,
    dimensionsAsPublished: "120 x 25 x 120 (L x W x H, mm)",
    thicknessMm: 25,
    maxRpm: 1700,
    maxAirflowCfm: 41.51,
    maxNoiseDba: 20.6,
    sourceUrl: "https://www.bequiet.com/en/casefans/4132",
  },
  {
    ...beQuietLightWings,
    id: "fan-bequiet-bl076",
    model: "Light Wings 120mm PWM",
    displayName: "be quiet! Light Wings 120mm PWM Black (3-pack)",
    partNumber: "BL076",
    color: "black",
    sizeMm: 120,
    dimensionsAsPublished: "120 x 25 x 120 (L x W x H, mm)",
    thicknessMm: 25,
    maxRpm: 1700,
    maxAirflowCfm: 41.51,
    maxNoiseDba: 20.6,
    sourceUrl: "https://www.bequiet.com/en/casefans/3452",
  },
  {
    ...beQuietLightWings,
    id: "fan-bequiet-bl102",
    model: "Light Wings 140mm PWM",
    displayName: "be quiet! Light Wings 140mm PWM White (3-pack)",
    partNumber: "BL102",
    color: "white",
    sizeMm: 140,
    dimensionsAsPublished: "140 x 25 x 140 (L x W x H, mm)",
    thicknessMm: 25,
    maxRpm: 1500,
    maxAirflowCfm: 56,
    maxNoiseDba: 23.3,
    sourceUrl: "https://www.bequiet.com/en/casefans/4133",
  },
  {
    ...beQuietLightWings,
    id: "fan-bequiet-bl078",
    model: "Light Wings 140mm PWM",
    displayName: "be quiet! Light Wings 140mm PWM Black (3-pack)",
    partNumber: "BL078",
    color: "black",
    sizeMm: 140,
    dimensionsAsPublished: "140 x 25 x 140 (L x W x H, mm)",
    thicknessMm: 25,
    maxRpm: 1500,
    maxAirflowCfm: 56,
    maxNoiseDba: 23.3,
    sourceUrl: "https://www.bequiet.com/en/casefans/3453",
  },
  {
    ...lianLiTl,
    id: "fan-lianli-12tl3w",
    displayName: "Lian Li UNI FAN TL 120 White (3-pack)",
    partNumber: "12TL3W",
    color: "white",
  },
  {
    ...lianLiTl,
    id: "fan-lianli-12tl3b",
    displayName: "Lian Li UNI FAN TL 120 Black (3-pack)",
    partNumber: "12TL3B",
    color: "black",
  },
  {
    id: "fan-phanteks-ph-f120d30-drgb-pwm-wt01-3p",
    brand: "Phanteks",
    model: "D30-120 DRGB PWM",
    displayName: "Phanteks D30-120 DRGB PWM White (3-pack)",
    partNumber: "PH-F120D30_DRGB_PWM_WT01_3P",
    color: "white",
    sizeMm: 120,
    dimensionsAsPublished: "120 x 120 x 30 mm | 4.72 x 4.72 x 1.18 in",
    thicknessMm: 30,
    lighting: "D-RGB",
    lightingConnector: null,
    fanConnector: null,
    fansInPackage: 3,
    maxRpm: 2000,
    maxAirflowCfm: null,
    maxNoiseDba: null,
    notes: ["Speed 250~2000 ± 10% RPM."],
    sourceUrl: "https://phanteks.com/product/d30-120-white/",
    verifiedAt: STEP_C_VERIFIED,
  },
];
