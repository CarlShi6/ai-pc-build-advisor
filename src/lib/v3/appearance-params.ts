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

export const APPEARANCE_PROMPT = [
  'Fill "appearance" only from what the photo clearly shows; use "unknown" for any field you cannot see, and never fill a field from what a part usually has.',
  "Case type: dual-chamber (a showcase case with glass on both the front and the side, usually with a separate rear chamber), mesh-front-mid-tower (the front panel itself is a mesh or perforated grille), itx (small form factor), other.",
  'A perforated PSU shroud, bottom cover or top vent is not a mesh front. If the front corner of the case is clear glass, glass is "both" and the case is not mesh-front.',
  "GPU fan count: count only fans you can actually see. A horizontally mounted card seen from the side shows its edge, not its fans (they face down), so the fan count is unknown then. Length can still be judged from its span: short (about 2 fan widths or less), medium, long (about 3 fan widths).",
  "Cooler: air-tower or aio; radiator size and position (top, side, front) only for an aio. Pump style: screen when the pump top shows a display, picture or numbers; round or square only for a plain cap.",
  "Fans: case fans at each position. The fans on a radiator belong to the cooler; never count them as top, front or side case fans.",
  "Memory: visible sticks and whether they have a lit bar. Motherboard color only when the board is visible.",
  "Never infer a model from these.",
].join(" ");

/** One automatic correction, shown with the photo's appearance so nothing changes silently. */
export interface AppearanceCorrection {
  field: string;
  from: string;
  to: string;
  reason: string;
}

const RADIATOR_FANS: Partial<Record<AppearanceParams["cooler"]["radiatorSize"], number>> = {
  "240": 2,
  "280": 2,
  "360": 3,
  "420": 3,
};

/**
 * Fixes only contradictions that are certain from the parameters themselves, never a guess:
 * - A radiator's fans belong to the cooler. When the analysis also counted them as case fans at
 *   the radiator's position, they come off that count (never below 0). Needs a known radiator
 *   size, position and fan count; with any of them unknown nothing changes.
 */
export function reconcileAppearance(params: AppearanceParams): {
  params: AppearanceParams;
  corrections: AppearanceCorrection[];
} {
  const corrections: AppearanceCorrection[] = [];
  const next: AppearanceParams = structuredClone(params);
  // Two values that cannot both be true: which one is wrong is not certain, so the dependent one
  // becomes unknown; nothing is replaced with a guessed value.
  const toUnknown = (path: string, reason: string) => {
    const [category, field] = path.split(".") as [AppearanceCategory, string];
    const values = next[category] as Record<string, string>;
    if (values[field] === "unknown") return;
    corrections.push({ field: path, from: values[field], to: "unknown", reason });
    values[field] = "unknown";
  };
  if (params.cooler.type === "air-tower")
    for (const field of ["radiatorSize", "radiatorPosition", "pumpStyle"])
      toUnknown(`cooler.${field}`, "An air tower has no radiator or pump.");
  if (
    params.case.type === "mesh-front-mid-tower" &&
    (params.case.glass === "front" || params.case.glass === "both")
  )
    toUnknown("case.type", "A mesh-front case cannot also have a glass front.");
  if (params.gpu.fanCount === "3" && params.gpu.length === "short")
    toUnknown("gpu.length", "A short card fits at most two fans, but three were read.");
  const cooler = next.cooler;
  const radiatorFans = RADIATOR_FANS[cooler.radiatorSize];
  const position = cooler.radiatorPosition;
  if (cooler.type !== "air-tower" && radiatorFans && position !== "unknown") {
    const counted = countOf(params.fans[position]);
    if (counted !== null && counted > 0) {
      const kept = Math.max(0, counted - radiatorFans);
      next.fans[position] = String(kept) as AppearanceParams["fans"]["top"];
      corrections.push({
        field: `fans.${position}`,
        from: String(counted),
        to: String(kept),
        reason: `The ${cooler.radiatorSize} mm ${position} radiator's own ${radiatorFans} fans belong to the cooler, not the case.`,
      });
    }
  }
  return { params: next, corrections };
}

export type AppearanceCategory = keyof AppearanceParams;

/** Every appearance field with its fixed options (unknown included), in schema order. */
export const appearanceFields: Array<{
  category: AppearanceCategory;
  field: string;
  path: string;
  options: readonly string[];
}> = Object.entries(appearanceParamsSchema.shape).flatMap(([category, schema]) =>
  Object.entries(schema.shape as Record<string, z.ZodEnum<[string, ...string[]]>>).map(
    ([field, options]) => ({
      category: category as AppearanceCategory,
      field,
      path: `${category}.${field}`,
      options: options.options,
    }),
  ),
);

export function appearanceValue(params: AppearanceParams, path: string): string {
  const [category, field] = path.split(".") as [AppearanceCategory, string];
  return (params[category] as Record<string, string>)[field];
}

/** Sets one field to one of its fixed options; anything else is refused. */
export function setAppearanceField(
  params: AppearanceParams,
  path: string,
  value: string,
): AppearanceParams {
  const field = appearanceFields.find((item) => item.path === path);
  if (!field || !field.options.includes(value))
    throw new Error(`"${value}" is not an option for ${path}.`);
  return {
    ...params,
    [field.category]: { ...params[field.category], [field.field]: value },
  } as AppearanceParams;
}
