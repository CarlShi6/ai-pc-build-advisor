import { describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import { createImageAnalysisResult } from "@/lib/v3/image-contract";
import { inspectImage, stripImageMetadata } from "@/lib/v3/image-input";

function pngHeader(width = 64, height = 64) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const observed = {
  summary: "A dark case with a visible side panel.",
  quality: "limited" as const,
  qualityIssues: ["GPU label is obscured"],
  observations: [
    {
      category: "case" as const,
      attribute: "color",
      value: "black",
      evidence: "The case frame looks dark in the visible left edge.",
      origin: "observed" as const,
      confidenceBand: "medium" as const,
      visibleInImage: true,
      region: { x: 0.1, y: 0.1, width: 0.5, height: 0.7 },
    },
  ],
};

describe("R3 image input and observations", () => {
  it("validates actual bytes, declared type, and pixel cap", () => {
    expect(inspectImage(pngHeader(), "image/png")).toMatchObject({ width: 64, height: 64 });
    expect(() => inspectImage(pngHeader(), "image/jpeg")).toThrow(/does not match/);
    expect(() => inspectImage(pngHeader(8000, 8000), "image/png")).toThrow(/too large/);
    expect(() => inspectImage(new Uint8Array([1, 2, 3]), "image/png")).toThrow(/not a supported/);
  });

  it("removes image metadata before provider processing", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 69, 120, 105, 102, 0, 0, 0xff, 0xc0, 0x00, 0x0a, 0x08,
      0x00, 0x40, 0x00, 0x40, 0x03, 1, 0, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
    ]);
    const clean = stripImageMetadata(jpeg, "image/jpeg");
    expect(new TextDecoder().decode(clean)).not.toContain("Exif");
    expect(inspectImage(clean, "image/jpeg")).toMatchObject({ width: 64, height: 64 });
  });

  it("keeps every part identity unknown and downgrades nonvisible assertions", () => {
    const result = createImageAnalysisResult(
      {
        ...observed,
        observations: [
          ...observed.observations,
          { ...observed.observations[0], visibleInImage: false, origin: "observed", region: null },
        ],
      },
      { mime: "image/png", width: 64, height: 64 },
      "image-test",
    );
    expect(result.unknownPartIdentities).toHaveLength(8);
    expect(result.observations[1]).toMatchObject({
      origin: "unknown",
      confidenceBand: "unknown",
      region: null,
    });
  });

  it("rejects hidden CPU claims and invalid evidence regions", () => {
    expect(() =>
      createImageAnalysisResult(
        { ...observed, observations: [{ ...observed.observations[0], category: "cpu" }] },
        { mime: "image/png", width: 64, height: 64 },
      ),
    ).toThrow();
    expect(() =>
      createImageAnalysisResult(
        {
          ...observed,
          observations: [
            { ...observed.observations[0], region: { x: -1, y: 0, width: 1, height: 1 } },
          ],
        },
        { mime: "image/png", width: 64, height: 64 },
      ),
    ).toThrow();
  });

  it("validates image requests before calling the analyzer and returns no-store results", async () => {
    const analyzer = vi.fn(async () =>
      createImageAnalysisResult(observed, { mime: "image/png", width: 64, height: 64 }),
    );
    const bad = await handleInternalApiRequest(
      new Request("http://localhost/api/image-analyses", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: pngHeader(),
      }),
      { imageAnalyzer: analyzer },
    );
    expect(bad?.status).toBe(415);
    expect(analyzer).not.toHaveBeenCalled();
    const good = await handleInternalApiRequest(
      new Request("http://localhost/api/image-analyses", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: pngHeader(),
      }),
      { imageAnalyzer: analyzer },
    );
    expect(good?.status).toBe(200);
    expect(good?.headers.get("cache-control")).toBe("no-store");
    const result = await good?.json();
    expect(result.observations[0].imageId).toBe(result.imageId);
  });

  it("reports missing AI credentials without claiming a completed analysis", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "openai");
    try {
      const response = await handleInternalApiRequest(
        new Request("http://localhost/api/image-analyses", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: pngHeader(),
        }),
      );
      expect(response?.status).toBe(503);
      await expect(response?.json()).resolves.toMatchObject({
        error: { code: "IMAGE_AI_NOT_CONFIGURED" },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("requires explicit OpenAI provider configuration", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("OPENAI_API_KEY", "local-test-placeholder");
    try {
      const response = await handleInternalApiRequest(
        new Request("http://localhost/api/image-analyses", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: pngHeader(),
        }),
      );
      expect(response?.status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
