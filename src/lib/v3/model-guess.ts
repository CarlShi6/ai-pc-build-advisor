import { z } from "zod";
import { appearanceProfiles, type AppearanceProfile } from "@/lib/v3/appearance-catalog";

/**
 * Step B, the model layer: what the AI guesses each visible part is, and the text it could read.
 * Both are guesses. They never select a part, never price anything and never change the 3D,
 * which is still drawn from the appearance parameters. A guess that names a catalog part only
 * highlights that candidate; the user still confirms it.
 */
export const modelGuessCategories = [
  "case",
  "gpu",
  "cooler",
  "motherboard",
  "memory",
  "fan",
] as const;
export type ModelGuessCategory = (typeof modelGuessCategories)[number];

// Guesses are extras: an over-long one is clipped rather than failing the whole analysis.
const clipped = (max: number) => z.string().transform((value) => value.trim().slice(0, max));

export const modelGuessSchema = z
  .object({
    category: z.enum(modelGuessCategories),
    brand: clipped(40),
    model: clipped(80),
    basis: z.enum(["visible-text", "appearance"]),
    evidence: clipped(240),
  })
  .strict();
export type ModelGuess = z.output<typeof modelGuessSchema>;

export const visibleTextSchema = z
  .object({
    text: clipped(60),
    location: clipped(100),
    category: z.enum([...modelGuessCategories, "other"]),
  })
  .strict();
export type VisibleText = z.output<typeof visibleTextSchema>;

export const modelGuessJsonSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["category", "brand", "model", "basis", "evidence"],
    properties: {
      category: { type: "string", enum: [...modelGuessCategories] },
      brand: { type: "string" },
      model: { type: "string" },
      basis: { type: "string", enum: ["visible-text", "appearance"] },
      evidence: { type: "string" },
    },
  },
} as const;

export const visibleTextJsonSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["text", "location", "category"],
    properties: {
      text: { type: "string" },
      location: { type: "string" },
      category: { type: "string", enum: [...modelGuessCategories, "other"] },
    },
  },
} as const;

export const MODEL_GUESS_PROMPT = [
  "modelGuesses: for each visible case, GPU, cooler, motherboard, memory or fan you can reasonably guess, give at most one brand and model guess.",
  'Use basis "visible-text" only when legible text in the photo supports the guess, otherwise "appearance".',
  "Evidence says what you saw. Leave a part out when you cannot guess; never put model names in observations.",
  "visibleText: copy only text that is actually legible (a brand, series or logo word), exactly as written; never complete or correct partial letters. Location says where it is (for example: on the GPU side).",
].join(" ");

/** Drops empty guesses and repeats; keeps the first guess per category and model. */
export function cleanGuesses(guesses: ModelGuess[]): ModelGuess[] {
  const seen = new Set<string>();
  return guesses.filter((guess) => {
    const key = `${guess.category}:${guess.brand} ${guess.model}`.toLowerCase().trim();
    if (!guess.model.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function cleanVisibleText(items: VisibleText[]): VisibleText[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.text}`.toLowerCase().trim();
    if (!item.text.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const guessLabel = (guess: ModelGuess) =>
  [guess.brand, guess.model].filter((part) => part.trim()).join(" ");

// Words that say nothing about which model it is: colours and colour names, editions, sizes.
const filler = new Set([
  "white",
  "black",
  "silver",
  // Colour names in catalog models: "Matte White" (NV5), "Pure White" (KING 95), "Snow White" (Y60).
  "matte",
  "pure",
  "snow",
  "edition",
  "single",
  "pack",
  "mm",
  "aio",
  "rgb",
  "argb",
  "geforce",
  "radeon",
  "the",
  "and",
]);

function modelTokens(value: string) {
  return new Set(
    (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      // Memory sizes, and radiator sizes ("Galahad II LCD" names the 360 version too).
      (token) =>
        !filler.has(token) && !/^\d+(gb?|mm)$/.test(token) && !/^(240|280|360|420)$/.test(token),
    ),
  );
}

/**
 * Catalog parts the guess names: same category, and the guess and the catalog name carry the
 * same model words (colour and memory size aside). "Gigabyte RTX 5070 AERO" does not name the
 * "NVIDIA RTX 5070" Founders Edition. Several can match (a white and a black version).
 */
export function catalogMatchesForGuess(
  guess: ModelGuess,
  profiles: AppearanceProfile[] = appearanceProfiles,
): AppearanceProfile[] {
  const wanted = modelTokens(guessLabel(guess));
  if (wanted.size < 2) return [];
  return profiles.filter((profile) => {
    if (profile.category !== guess.category) return false;
    const have = modelTokens(profile.identityText);
    return (
      [...wanted].every((token) => have.has(token)) && [...have].every((token) => wanted.has(token))
    );
  });
}

// Manufacturer sites, for a search limited to the maker's own pages.
const manufacturerSites: Record<string, string> = {
  asus: "asus.com",
  msi: "msi.com",
  gigabyte: "gigabyte.com",
  aorus: "gigabyte.com",
  nvidia: "nvidia.com",
  amd: "amd.com",
  zotac: "zotac.com",
  sapphire: "sapphiretech.com",
  powercolor: "powercolor.com",
  palit: "palit.com",
  evga: "evga.com",
  nzxt: "nzxt.com",
  corsair: "corsair.com",
  "lian li": "lian-li.com",
  hyte: "hyte.com",
  "fractal design": "fractal-design.com",
  phanteks: "phanteks.com",
  montech: "montechpc.com",
  "cooler master": "coolermaster.com",
  thermaltake: "thermaltake.com",
  "be quiet!": "bequiet.com",
  arctic: "arctic.de",
  deepcool: "deepcool.com",
  noctua: "noctua.at",
  thermalright: "thermalright.com",
  "g.skill": "gskill.com",
  kingston: "kingston.com",
};

/** A web search limited to the maker's site when the brand is known, otherwise a plain search. */
export function manufacturerSearch(guess: ModelGuess): { url: string; label: string } {
  const site = manufacturerSites[guess.brand.trim().toLowerCase()];
  const query = site ? `site:${site} ${guess.model}` : `${guessLabel(guess)} specifications`;
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    label: site ? `Search ${site}` : "Search the web",
  };
}
