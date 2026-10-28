import { z } from "zod";

/**
 * Step A, the appearance layer: what a photo shows about each visible part's look, as strict
 * enums. Anything the photo does not clearly show is "unknown"; nothing is guessed. These drive
 * the parametric 3D look-alikes and never name a model or a maker's dimensions.
 */
const bodyColor = z.enum(["white", "black", "silver", "gray", "pink", "unknown"]);
const lightColor = z.enum([
  "blue",
  "cyan",
  "purple",
  "pink",
  "red",
  "green",
  "orange",
  "white",
  "multicolor",
  "none",
  "unknown",
]);
const count = z.enum(["0", "1", "2", "3", "4", "5", "6", "unknown"]);

export const appearanceParamsSchema = z
  .object({
    case: z
      .object({
        type: z.enum(["dual-chamber", "mesh-front-mid-tower", "itx", "other", "unknown"]),
        color: bodyColor,
        glass: z.enum(["side", "front", "both", "none", "unknown"]),
        orientation: z.enum(["upright", "horizontal", "unknown"]),
      })
      .strict(),
    gpu: z
      .object({
        fanCount: z.enum(["1", "2", "3", "unknown"]),
        length: z.enum(["short", "medium", "long", "unknown"]),
        color: bodyColor,
        mount: z.enum(["horizontal", "vertical", "unknown"]),
        light: lightColor,
      })
      .strict(),
    cooler: z
      .object({
        type: z.enum(["air-tower", "aio", "unknown"]),
        radiatorSize: z.enum(["240", "280", "360", "420", "unknown"]),
        radiatorPosition: z.enum(["top", "side", "front", "unknown"]),
        pumpStyle: z.enum(["round", "square", "screen", "unknown"]),
        color: bodyColor,
      })
      .strict(),
    fans: z
      .object({
        front: count,
        top: count,
        side: count,
        bottom: count,
        rear: count,
        ringColor: lightColor,
      })
      .strict(),
    memory: z
      .object({
        sticks: z.enum(["1", "2", "3", "4", "unknown"]),
        lightBar: z.enum(["yes", "no", "unknown"]),
        color: bodyColor,
      })
      .strict(),
    motherboard: z.object({ color: bodyColor }).strict(),
  })
  .strict();

export type AppearanceParams = z.infer<typeof appearanceParamsSchema>;
export type ParamColor = AppearanceParams["case"]["color"];
export type ParamLight = AppearanceParams["fans"]["ringColor"];

/** Everything unknown: what an analysis without appearance parameters (older ones) means. */
export const unknownAppearance: AppearanceParams = {
  case: { type: "unknown", color: "unknown", glass: "unknown", orientation: "unknown" },
  gpu: {
    fanCount: "unknown",
    length: "unknown",
    color: "unknown",
    mount: "unknown",
    light: "unknown",
  },
  cooler: {
    type: "unknown",
    radiatorSize: "unknown",
    radiatorPosition: "unknown",
    pumpStyle: "unknown",
    color: "unknown",
  },
  fans: {
    front: "unknown",
    top: "unknown",
    side: "unknown",
    bottom: "unknown",
    rear: "unknown",
    ringColor: "unknown",
  },
  memory: { sticks: "unknown", lightBar: "unknown", color: "unknown" },
  motherboard: { color: "unknown" },
};

/** True when the photo showed at least one thing about this category. */
export function anyKnown(params: Record<string, string>): boolean {
  return Object.values(params).some((value) => value !== "unknown");
}

/** A count field as a number, or null when unknown. */
export function countOf(value: string): number | null {
  return value === "unknown" ? null : Number(value);
}

/** Reads stored parameters; anything malformed counts as not provided. */
export function readAppearanceParams(value: unknown): AppearanceParams | undefined {
  const parsed = appearanceParamsSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** JSON schema for the provider's structured output: every field required, enums only. */
function enumOf(schema: z.ZodEnum<[string, ...string[]]>) {
  return { type: "string", enum: [...schema.options] } as const;
}

function objectOf(shape: Record<string, z.ZodEnum<[string, ...string[]]>>) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(shape),
    properties: Object.fromEntries(Object.entries(shape).map(([key, item]) => [key, enumOf(item)])),
  };
}

export const appearanceParamsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(appearanceParamsSchema.shape),
  properties: Object.fromEntries(
    Object.entries(appearanceParamsSchema.shape).map(([key, item]) => [
      key,
      objectOf(item.shape as Record<string, z.ZodEnum<[string, ...string[]]>>),
    ]),
  ),
};

export const APPEARANCE_PROMPT =
  'Fill "appearance" only from what the photo clearly shows; use "unknown" for any field you cannot see. Case type: dual-chamber (separate rear chamber, glass front and side), mesh-front-mid-tower, itx (small form factor), other. Glass: where the case has glass panels. GPU length: short (about 2 fans long or less), medium, long (3 fans). Cooler: air-tower or aio; radiator size and position (top, side, front) only for an aio. Fans: how many case fans at each position, not counting radiator fans. Memory: visible sticks and whether they have a lit bar. Motherboard color only when the board is visible. Never infer a model from these.';
