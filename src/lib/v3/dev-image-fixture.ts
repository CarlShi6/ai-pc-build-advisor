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
