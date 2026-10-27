import { createImageAnalysisResult, type ImageAnalysisResult } from "@/lib/v3/image-contract";

/** Local development fixture for public/og.png. It never calls an AI provider. */
export function createOgImageFixture(): ImageAnalysisResult {
  return createImageAnalysisResult(
    {
      summary:
        "Local fixture: a PC case appears in the right panel of the AIPC promotional collage.",
      quality: "limited",
      qualityIssues: ["This is a composed promotional image, not a clear hardware photograph."],
      observations: [
        {
          category: "case",
          attribute: "color",
          value: "black",
          evidence: "The right-side tower has a dark exterior.",
          origin: "observed",
          confidenceBand: "medium",
          visibleInImage: true,
          region: { x: 0.79, y: 0.11, width: 0.16, height: 0.32 },
        },
        {
          category: "case",
          attribute: "style",
          value: "tower",
          evidence: "A tall upright tower outline appears at the right.",
          origin: "observed",
          confidenceBand: "medium",
          visibleInImage: true,
          region: { x: 0.79, y: 0.11, width: 0.16, height: 0.32 },
        },
        {
          category: "lighting",
          attribute: "color",
          value: "green",
          evidence: "Green light accents are visible inside and along the case.",
          origin: "observed",
          confidenceBand: "medium",
          visibleInImage: true,
          region: { x: 0.82, y: 0.17, width: 0.12, height: 0.2 },
        },
        {
          category: "gpu",
          attribute: "color",
          value: "black",
          evidence: "A dark graphics card illustration is visible near the center.",
          origin: "observed",
          confidenceBand: "low",
          visibleInImage: true,
          region: { x: 0.46, y: 0.14, width: 0.1, height: 0.17 },
        },
        {
          category: "gpu",
          attribute: "model marking",
          value: "unreadable",
          evidence: "No reliable GPU model marking can be read.",
          origin: "unknown",
          confidenceBand: "unknown",
          visibleInImage: false,
          region: null,
        },
      ],
    },
    { mime: "image/png", width: 1731, height: 909 },
    "local-og-fixture",
    "fixture",
  );
}

const obs = (
  category: "case" | "gpu" | "cooler" | "fan" | "motherboard" | "theme" | "lighting",
  attribute: string,
  value: string,
  evidence: string,
  region: { x: number; y: number; width: number; height: number } | null,
  confidenceBand: "high" | "medium" = "high",
) => ({
  category,
  attribute,
  value,
  evidence,
  origin: "observed" as const,
  confidenceBand,
  visibleInImage: true,
  region,
});

const caseRegion = { x: 0.208, y: 0.122, width: 0.583, height: 0.767 };

/**
 * Local development fixtures for drawn (not photographed) white builds with five blue-lit fans.
 * They never call an AI provider. `white-build-sketch.png` is a straight side view, so nothing
 * shows the front panel; `white-build-glass-front.png` adds the front face, a pillarless clear
 * glass panel.
 */
function whiteSketch(frontGlass: boolean): ImageAnalysisResult {
  return createImageAnalysisResult(
    {
      summary: frontGlass
        ? "Local fixture: a drawn white build with glass side and front panels, five blue-lit fans, a white AIO and a white graphics card."
        : "Local fixture: a drawn white tempered-glass build with five blue-lit fans, a white AIO and a white graphics card.",
      quality: "clear",
      qualityIssues: ["This is a drawing, not a hardware photograph."],
      observations: [
        ...(frontGlass
          ? [
              obs(
                "case",
                "front panel material",
                "tempered glass",
                "The front face is a clear glass panel that meets the side glass with no corner pillar; the fan rings show through it.",
                { x: 0.792, y: 0.122, width: 0.093, height: 0.767 },
              ),
            ]
          : []),
        obs("case", "color", "white", "The case frame and PSU shroud are white.", caseRegion),
        obs(
          "case",
          "side panel",
          "tempered glass",
          "The interior is visible through a full glass side panel with reflections.",
          caseRegion,
        ),
        obs(
          "fan",
          "fan count",
          "5 fans",
          "Three fans run down the right side and two sit on the bottom.",
          { x: 0.3, y: 0.22, width: 0.48, height: 0.65 },
        ),
        obs("fan", "color", "white", "The fan frames and blades are white.", {
          x: 0.68,
          y: 0.22,
          width: 0.1,
          height: 0.44,
        }),
        obs("fan", "lighting", "blue LED rings", "Each fan has a glowing blue ring.", {
          x: 0.68,
          y: 0.22,
          width: 0.1,
          height: 0.44,
        }),
        obs(
          "lighting",
          "color",
          "blue",
          "The fans, pump ring and GPU strip glow blue.",
          caseRegion,
        ),
        obs(
          "cooler",
          "cooler type",
          "360 mm AIO liquid cooler",
          "A round pump head with two tubes runs to a radiator along the top.",
          { x: 0.267, y: 0.167, width: 0.433, height: 0.278 },
        ),
        obs("cooler", "color", "white", "The pump head, tubes and radiator are white.", {
          x: 0.367,
          y: 0.322,
          width: 0.092,
          height: 0.122,
        }),
        obs("gpu", "color", "white", "A white graphics card shroud spans the board.", {
          x: 0.25,
          y: 0.522,
          width: 0.392,
          height: 0.087,
        }),
        obs(
          "motherboard",
          "color",
          "white",
          "The motherboard and its heatsink covers are white.",
          { x: 0.267, y: 0.222, width: 0.317, height: 0.489 },
          "medium",
        ),
        obs("theme", "color", "all-white build", "Every visible part is white.", caseRegion),
        {
          category: "gpu",
          attribute: "model marking",
          value: "none visible",
          evidence: "The drawing has no brand or model text.",
          origin: "unknown",
          confidenceBand: "unknown",
          visibleInImage: false,
          region: null,
        },
      ],
      absentParts: [],
    },
    { mime: "image/png", width: 1200, height: 900 },
    frontGlass ? "local-white-glass-front-fixture" : "local-white-sketch-fixture",
    "fixture",
  );
}

export const createWhiteSketchFixture = () => whiteSketch(false);
export const createGlassFrontFixture = () => whiteSketch(true);

/** Dev-only fixtures keyed by the file name that triggers them. */
export const devImageFixtures: Record<string, () => ImageAnalysisResult> = {
  "og.png": createOgImageFixture,
  "white-build-sketch.png": createWhiteSketchFixture,
  "white-build-glass-front.png": createGlassFrontFixture,
};
