import { z } from "zod";
import { primarySlots, type SlotId } from "@/lib/v3/build-document";
import type { ImageMime } from "@/lib/v3/image-input";
import {
  appearanceParamsJsonSchema,
  appearanceParamsSchema,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";

/** Visible parts a photo can show are *not installed* (an empty case). Hidden parts never qualify. */
export const absentPartCategories = ["gpu", "cooler", "fan", "motherboard"] as const;
export type AbsentPartCategory = (typeof absentPartCategories)[number];

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
    // Optional for older fixtures and saved drafts; the live provider must always send it.
    absentParts: z.array(z.enum(absentPartCategories)).max(4).default([]),
    // Step A appearance parameters; optional for older fixtures and saved analyses.
    appearance: appearanceParamsSchema.optional(),
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
  /** Categories the photo clearly shows are not installed; dropped for poor-quality photos. */
  absentParts: AbsentPartCategory[];
  /** Per-category look (Step A); absent on older analyses, which then draw the older way. */
  appearance?: AppearanceParams;
}

export type ImageAnalyzer = (input: {
  bytes: Uint8Array;
  mime: ImageMime;
  width: number;
  height: number;
  /** Dev only: hash of the original photo, to save the response as a local replay. */
  replayKey?: string;
}) => Promise<ImageAnalysisResult>;

export const observationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "quality", "qualityIssues", "observations", "absentParts", "appearance"],
  properties: {
    appearance: appearanceParamsJsonSchema,
    summary: { type: "string" },
    quality: { type: "string", enum: ["clear", "limited", "poor"] },
    qualityIssues: { type: "array", items: { type: "string" } },
    absentParts: {
      type: "array",
      items: { type: "string", enum: [...absentPartCategories] },
    },
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
    // A poor photo can't show that something is missing.
    absentParts: draft.quality === "poor" ? [] : [...new Set(draft.absentParts)],
    ...(draft.appearance && { appearance: draft.appearance }),
  };
}
