import { z } from "zod";
import { primarySlots, type SlotId } from "@/lib/v3/build-document";
import type { ImageMime } from "@/lib/v3/image-input";

const regionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .strict();

export const observationDraftSchema = z
  .object({
    summary: z.string().min(1).max(500),
    quality: z.enum(["clear", "limited", "poor"]),
    qualityIssues: z.array(z.string().max(120)).max(8),
    observations: z
      .array(
        z
          .object({
            category: z.enum(["case", "gpu", "cooler", "fan", "motherboard", "theme", "lighting"]),
            attribute: z.string().min(1).max(80),
            value: z.string().min(1).max(180),
            evidence: z.string().min(1).max(300),
            origin: z.enum(["observed", "inferred", "unknown"]),
            confidenceBand: z.enum(["high", "medium", "low", "unknown"]),
            visibleInImage: z.boolean(),
            region: regionSchema.nullable(),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

export type ObservationDraft = z.infer<typeof observationDraftSchema>;
export type VisualObservation = ObservationDraft["observations"][number] & {
  id: string;
  imageId: string;
};

export interface ImageAnalysisResult {
  analysisId: string;
  imageId: string;
  status: "ready";
  createdAt: string;
  provider: "openai" | "fixture";
  image: { mime: ImageMime; width: number; height: number };
  summary: string;
  quality: ObservationDraft["quality"];
  qualityIssues: string[];
  observations: VisualObservation[];
  unknownPartIdentities: SlotId[];
}

export type ImageAnalyzer = (input: {
  bytes: Uint8Array;
  mime: ImageMime;
  width: number;
  height: number;
}) => Promise<ImageAnalysisResult>;

export const observationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "quality", "qualityIssues", "observations"],
  properties: {
    summary: { type: "string" },
    quality: { type: "string", enum: ["clear", "limited", "poor"] },
    qualityIssues: { type: "array", items: { type: "string" } },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "category",
          "attribute",
          "value",
          "evidence",
          "origin",
          "confidenceBand",
          "visibleInImage",
          "region",
        ],
        properties: {
          category: {
            type: "string",
            enum: ["case", "gpu", "cooler", "fan", "motherboard", "theme", "lighting"],
          },
          attribute: { type: "string" },
          value: { type: "string" },
          evidence: { type: "string" },
          origin: { type: "string", enum: ["observed", "inferred", "unknown"] },
          confidenceBand: { type: "string", enum: ["high", "medium", "low", "unknown"] },
          visibleInImage: { type: "boolean" },
          region: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["x", "y", "width", "height"],
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
} as const;

export function createImageAnalysisResult(
  raw: unknown,
  image: ImageAnalysisResult["image"],
  imageId: string = crypto.randomUUID(),
  provider: ImageAnalysisResult["provider"] = "openai",
): ImageAnalysisResult {
  const draft = observationDraftSchema.parse(raw);
  const observations: VisualObservation[] = draft.observations.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    imageId,
    origin: item.origin === "observed" && !item.visibleInImage ? ("unknown" as const) : item.origin,
    confidenceBand: item.visibleInImage ? item.confidenceBand : ("unknown" as const),
    region:
      item.visibleInImage &&
      item.region &&
      item.region.x + item.region.width <= 1 &&
      item.region.y + item.region.height <= 1
        ? item.region
        : null,
  }));
  return {
    analysisId: crypto.randomUUID(),
    imageId,
    status: "ready",
    createdAt: new Date().toISOString(),
    provider,
    image,
    summary: draft.summary,
    quality: draft.quality,
    qualityIssues: draft.qualityIssues,
    observations,
    unknownPartIdentities: [...primarySlots],
  };
}
