import { selectedPart, type BuildDocumentV3 } from "@/lib/v3/build-document";

export interface ScenePresentation {
  layout: "showcase" | "tower";
  caseColor: string;
  accentColor: string;
  gpuVertical: boolean;
  fanAccentCount: number;
  geometryAccuracy: "illustrative";
}

const palette: Record<string, string> = {
  // Material base colors for the studio scene (PBR lighting does the shading).
  black: "#1f2124",
  white: "#e9ebee",
  silver: "#b9bfc5",
  green: "#76d56f",
  blue: "#78a7e2",
  red: "#e47f77",
  purple: "#a98fe2",
  pink: "#e799be",
};

function swatch(value: string | undefined, fallback: string) {
  const key = value?.toLowerCase().match(/black|white|silver|green|blue|red|purple|pink/)?.[0];
  return key ? palette[key] : fallback;
}

export function scenePresentation(document: BuildDocumentV3): ScenePresentation {
  const priorities = document.imageContext?.visualPriorities ?? [];
  const casePart = selectedPart(document, "case");
  const caseStyle = String(
    casePart?.specs.style ?? priorities.find((item) => item.category === "case_style")?.value ?? "",
  ).toLowerCase();
  const caseColor =
    casePart?.color ??
    priorities.find((item) => item.category === "colorway" && item.sourceCategory === "case")
      ?.value;
  const lighting = priorities.find((item) => item.category === "lighting")?.value;
  const placement = priorities.find(
    (item) => item.category === "component_placement" && item.sourceCategory === "gpu",
  )?.value;
  const fans = priorities.find((item) => item.category === "fan_layout")?.value;
  const count = fans?.match(/\b[1-6]\b/)?.[0];
  return {
    layout: /showcase|panoramic|dual.chamber/.test(caseStyle) ? "showcase" : "tower",
    caseColor: swatch(caseColor, "#2a2d31"),
    accentColor: swatch(lighting, "#6aa6ff"),
    gpuVertical:
      document.imageContext?.appearance?.gpu.mount === "vertical" ||
      (!!placement && /vertical|upright/.test(placement.toLowerCase())),
    fanAccentCount: count ? Number(count) : 0,
    geometryAccuracy: "illustrative",
  };
}
