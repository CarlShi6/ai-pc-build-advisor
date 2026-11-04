import { describe, expect, it } from "vitest";
import {
  catalogMatchesForGuess,
  cleanGuesses,
  manufacturerSearch,
  type ModelGuess,
} from "@/lib/v3/model-guess";
import { createImageAnalysisResult } from "@/lib/v3/image-contract";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { confirmImageBuild, proposeImageBuild } from "@/lib/v3/image-build";
import { fromLegacyBuild, toSavedBuildPayload } from "@/lib/v3/build-document";
import { slotModel } from "@/lib/v3/slot-models";

const guess = (patch: Partial<ModelGuess>): ModelGuess => ({
  category: "gpu",
  brand: "",
  model: "",
  basis: "appearance",
  evidence: "",
  ...patch,
});

describe("model guesses (Step B)", () => {
  it("names a catalog part only when the model words agree, colour and memory aside", () => {
    const ids = (item: ModelGuess) => catalogMatchesForGuess(item).map((part) => part.id);
    // An AERO card is not the Founders Edition with the same GPU.
    expect(ids(guess({ brand: "Gigabyte", model: "AERO GeForce RTX 5070" }))).toEqual([]);
    expect(ids(guess({ brand: "Gigabyte", model: "AERO GeForce RTX" }))).toEqual([]);
    // White and black versions of one case both match.
    expect(
      ids(guess({ category: "case", brand: "Lian Li", model: "O11 Dynamic EVO" })),
    ).toHaveLength(2);
    expect(
      ids(guess({ brand: "MSI", model: "GeForce RTX 5070 Ti Gaming Trio OC White" })),
    ).toHaveLength(1);
    // Colour names and radiator sizes in catalog names do not block a match.
    expect(ids(guess({ category: "case", brand: "Phanteks", model: "NV5" }))).toEqual([
      "maker-case-phanteks-ph-nv523tg-dmw01",
    ]);
    expect(ids(guess({ category: "case", brand: "MONTECH", model: "KING 95" }))).toEqual([
      "maker-case-montech-king-95-white",
    ]);
    expect(
      ids(guess({ category: "cooler", brand: "Lian Li", model: "Galahad II LCD" })).sort(),
    ).toEqual(["maker-cooler-lianli-ga2alcd36b", "maker-cooler-lianli-ga2alcd36w"]);
    // The wrong category, or a vague series, never matches.
    expect(ids(guess({ category: "gpu", brand: "Lian Li", model: "O11 Dynamic EVO" }))).toEqual([]);
    expect(ids(guess({ category: "fan", brand: "Lian Li", model: "UNI FAN series" }))).toEqual([]);
  });

  it("searches the maker's own site when the brand is known, the web otherwise", () => {
    const aero = manufacturerSearch(guess({ brand: "Gigabyte", model: "AERO GeForce RTX" }));
    expect(aero.label).toBe("Search gigabyte.com");
    expect(decodeURIComponent(aero.url)).toBe(
      "https://www.google.com/search?q=site:gigabyte.com AERO GeForce RTX",
    );
    // Brand case does not matter.
    expect(manufacturerSearch(guess({ brand: "MONTECH", model: "KING 95" })).label).toBe(
      "Search montechpc.com",
    );
    const unknown = manufacturerSearch(guess({ brand: "Acme", model: "Tower 9" }));
    expect(unknown.label).toBe("Search the web");
    expect(decodeURIComponent(unknown.url)).toContain("Acme Tower 9 specifications");
    // Text read from a photo cannot break out of the query.
    expect(manufacturerSearch(guess({ model: "x&y=<z>" })).url).not.toMatch(/[&<>]y?=?</);
  });

  it("drops empty and repeated guesses; long fields are clipped, not fatal", () => {
    expect(
      cleanGuesses([
        guess({ brand: "ASUS", model: "TUF" }),
        guess({ brand: "asus", model: "tuf" }),
        guess({ brand: "ASUS", model: " " }),
      ]),
    ).toHaveLength(1);
    const base = createGlassFrontFixture();
    const raw = {
      summary: "s",
      quality: "clear",
      qualityIssues: [],
      observations: [],
      absentParts: [],
      modelGuesses: [{ ...guess({ brand: "B".repeat(90), model: "M".repeat(200) }) }],
      visibleText: [{ text: "AERO", location: "on the GPU side", category: "gpu" }],
    };
    const result = createImageAnalysisResult(raw, base.image);
    expect(result.modelGuesses?.[0].brand).toHaveLength(40);
    expect(result.modelGuesses?.[0].model).toHaveLength(80);
    expect(result.visibleText).toEqual([raw.visibleText[0]]);
    // Older analyses without the fields still parse.
    const { modelGuesses: _g, visibleText: _t, ...older } = raw;
    expect(createImageAnalysisResult(older, base.image).modelGuesses).toEqual([]);
  });

  it("a guess the catalog holds never selects, prices or redraws anything", () => {
    const analysis = createGlassFrontFixture();
    expect(analysis.modelGuesses?.[0].model).toBe("O11 Dynamic EVO");
    const withGuess = confirmImageBuild(proposeImageBuild(analysis, {}, null), null);
    const without = confirmImageBuild(
      proposeImageBuild({ ...analysis, modelGuesses: [] }, {}, null),
      null,
    );
    expect(withGuess.build.parts).toEqual([]);
    expect(withGuess.build.totalPrice).toBe(without.build.totalPrice);
    expect(slotModel(withGuess, "case")).toEqual(slotModel(without, "case"));
    expect(slotModel(withGuess, "case")?.kind).toBe("appearance");
    // Saved with the draft, as guesses.
    const restored = fromLegacyBuild(toSavedBuildPayload(withGuess))!;
    expect(restored.imageContext?.modelGuesses).toEqual(analysis.modelGuesses);
  });
});
