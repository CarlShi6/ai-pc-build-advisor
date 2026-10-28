import { describe, expect, it } from "vitest";
import {
  appearanceFields,
  appearanceValue,
  reconcileAppearance,
  setAppearanceField,
  unknownAppearance,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { fromLegacyBuild, toSavedBuildPayload } from "@/lib/v3/build-document";
import { confirmImageBuild, proposeImageBuild } from "@/lib/v3/image-build";

function with_(
  cooler: Partial<AppearanceParams["cooler"]>,
  fans: Partial<AppearanceParams["fans"]>,
): AppearanceParams {
  return {
    ...unknownAppearance,
    cooler: { ...unknownAppearance.cooler, ...cooler },
    fans: { ...unknownAppearance.fans, ...fans },
  };
}

describe("appearance consistency check", () => {
  it("takes a top 360 radiator's fans off the top case fans (the real-photo misread)", () => {
    const { params, corrections } = reconcileAppearance(
      with_(
        { type: "aio", radiatorSize: "360", radiatorPosition: "top" },
        { top: "3", front: "3" },
      ),
    );
    expect(params.fans.top).toBe("0");
    expect(params.fans.front).toBe("3");
    expect(corrections).toEqual([
      expect.objectContaining({ field: "fans.top", from: "3", to: "0" }),
    ]);
  });

  it("keeps case fans beyond the radiator's and never goes below zero", () => {
    expect(
      reconcileAppearance(
        with_({ type: "aio", radiatorSize: "240", radiatorPosition: "front" }, { front: "3" }),
      ).params.fans.front,
    ).toBe("1");
    expect(
      reconcileAppearance(
        with_({ type: "aio", radiatorSize: "420", radiatorPosition: "side" }, { side: "2" }),
      ).params.fans.side,
    ).toBe("0");
  });

  it("changes nothing when anything it needs is unknown, or there is no radiator", () => {
    const cases: AppearanceParams[] = [
      with_({ type: "aio", radiatorSize: "unknown", radiatorPosition: "top" }, { top: "3" }),
      with_({ type: "aio", radiatorSize: "360", radiatorPosition: "unknown" }, { top: "3" }),
      with_({ type: "aio", radiatorSize: "360", radiatorPosition: "top" }, { top: "unknown" }),
      with_({ type: "aio", radiatorSize: "360", radiatorPosition: "top" }, { top: "0" }),
      with_({ type: "air-tower" }, { top: "3" }),
    ];
    for (const params of cases) {
      const result = reconcileAppearance(params);
      expect(result.params).toEqual(params);
      expect(result.corrections).toEqual([]);
    }
  });

  it("runs on every analysis result and records what it changed", () => {
    // The white sample counts no top fans, so nothing changes there.
    const sample = createGlassFrontFixture();
    expect(sample.appearance?.fans.side).toBe("3");
    expect(sample.appearanceCorrections).toBeUndefined();
  });
});

describe("review-page appearance edits", () => {
  it("lists every schema field with its fixed options, unknown included", () => {
    const paths = appearanceFields.map((field) => field.path);
    expect(paths).toContain("case.type");
    expect(paths).toContain("fans.ringColor");
    for (const field of appearanceFields) expect(field.options).toContain("unknown");
  });

  it("sets only schema options and leaves the input untouched", () => {
    const next = setAppearanceField(unknownAppearance, "case.type", "dual-chamber");
    expect(appearanceValue(next, "case.type")).toBe("dual-chamber");
    expect(appearanceValue(unknownAppearance, "case.type")).toBe("unknown");
    expect(() => setAppearanceField(unknownAppearance, "case.type", "fishbowl")).toThrow();
    expect(() => setAppearanceField(unknownAppearance, "case.nope", "unknown")).toThrow();
  });

  it("an edited look and who set it go through confirm and survive a save round trip", () => {
    const analysis = createGlassFrontFixture();
    const edited = setAppearanceField(
      setAppearanceField(analysis.appearance ?? unknownAppearance, "case.type", "dual-chamber"),
      "case.glass",
      "both",
    );
    const draft = confirmImageBuild(
      proposeImageBuild({ ...analysis, appearance: edited }, {}, null, null, [
        "case.type",
        "case.glass",
      ]),
      null,
    );
    const restored = fromLegacyBuild(toSavedBuildPayload(draft))!;
    expect(restored.imageContext?.appearance?.case).toMatchObject({
      type: "dual-chamber",
      glass: "both",
    });
    expect(restored.imageContext?.appearanceUserSet).toEqual(["case.type", "case.glass"]);
  });
});
