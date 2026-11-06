import { z } from "zod";
import { primarySlots, type SlotId } from "@/lib/v3/build-document";
import type { ImageMime } from "@/lib/v3/image-input";
import {
  appearanceParamsJsonSchema,
  appearanceParamsSchema,
  reconcileAppearance,
  type AppearanceCorrection,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";
import {
  cleanGuesses,
  cleanVisibleText,
  modelGuessJsonSchema,
  modelGuessSchema,
  visibleTextJsonSchema,
  visibleTextSchema,
  type ModelGuess,
  type VisibleText,
} from "@/lib/v3/model-guess";
import type { StreamedPart } from "@/lib/v3/analysis-stream";

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
    // Step B guesses; optional for older fixtures and saved analyses.
    modelGuesses: z
      .array(modelGuessSchema)
      .default([])
      .transform((items) => items.slice(0, 8)),
    visibleText: z
      .array(visibleTextSchema)
      .default([])
      .transform((items) => items.slice(0, 12)),
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
  /** Certain contradictions fixed in `appearance` (see reconcileAppearance), as received. */
  appearanceCorrections?: AppearanceCorrection[];
  /** Step B: AI model guesses and legible text; guesses only, never a selection. */
  modelGuesses?: ModelGuess[];
  visibleText?: VisibleText[];
}

export type ImageAnalyzer = (input: {
  bytes: Uint8Array;
  mime: ImageMime;
  width: number;
  height: number;
  /** Dev only: hash of the original photo, to save the response as a local replay. */
  replayKey?: string;
  /**
   * Called once the provider has accepted the request. Errors before it (not configured, rate
   * limited, refused credentials) still answer with their own status; later ones are stream events.
   */
  onStarted?: () => void;
  /** Each appearance category as soon as it has been read in full (see analysis-stream.ts). */
  onPart?: (part: StreamedPart) => void;
  /** What the precheck found (image-precheck.server.ts); dev replays keep it. */
  precheck?: {
    kind: string;
    ms: number;
    usage: { inputTokens: number; outputTokens: number } | null;
  };
}) => Promise<ImageAnalysisResult>;

export const observationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "appearance",
    "absentParts",
    "quality",
    "qualityIssues",
    "summary",
    "observations",
    "modelGuesses",
    "visibleText",
  ],
  // The provider writes properties in this order. Appearance comes first so a streamed read can
  // draw each part early (analysis-stream.ts); observations and guesses come last.
  properties: {
    appearance: appearanceParamsJsonSchema,
    absentParts: {
      type: "array",
      items: { type: "string", enum: [...absentPartCategories] },
    },
    quality: { type: "string", enum: ["clear", "limited", "poor"] },
    qualityIssues: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
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
    modelGuesses: modelGuessJsonSchema,
    visibleText: visibleTextJsonSchema,
  },
} as const;

function reconciled(appearance: AppearanceParams) {
  const { params, corrections } = reconcileAppearance(appearance);
  return {
    appearance: params,
    ...(corrections.length > 0 && { appearanceCorrections: corrections }),
  };
}

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
    ...(draft.appearance && reconciled(draft.appearance)),
    modelGuesses: cleanGuesses(draft.modelGuesses),
    visibleText: cleanVisibleText(draft.visibleText),
  };
}
