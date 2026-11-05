import { describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import {
  createPartScanner,
  NDJSON,
  readEvents,
  type AnalysisStreamEvent,
  type StreamedPart,
} from "@/lib/v3/analysis-stream";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { ImageAnalysisError } from "@/lib/v3/image-analysis.server";
import type { ImageAnalyzer } from "@/lib/v3/image-contract";
import { observationJsonSchema } from "@/lib/v3/image-contract";
import { ImageSessionLimiter } from "@/lib/v3/image-rate-limit.server";
import { MemoryDailyCap } from "@/lib/v3/image-daily-cap.server";
import { resultSource } from "@/lib/v3/image-replay";

const fixture = createGlassFrontFixture();

/** The provider's JSON for the fixture, in schema order, as one string. */
function providerText() {
  const raw = {
    appearance: fixture.appearance,
    absentParts: [],
    quality: "clear",
    qualityIssues: [],
    summary: 'A white "showcase" build {with} glass.',
    observations: [],
    modelGuesses: [],
    visibleText: [],
  };
  return JSON.stringify(raw, null, 1);
}

function imageRequest(headers: Record<string, string> = {}) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  return new Request("http://localhost/api/image-analyses", {
    method: "POST",
    headers: { "content-type": "image/png", accept: NDJSON, ...headers },
    body: bytes,
  });
}

const dependencies = (imageAnalyzer: ImageAnalyzer) => ({
  imageAnalyzer,
  imageLimiter: new ImageSessionLimiter([]),
  imageDailyCap: new MemoryDailyCap(),
  workerBindings: null,
});

async function eventsOf(response: Response | null) {
  const events: AnalysisStreamEvent[] = [];
  await readEvents(response!.body!, (event) => events.push(event));
  return events;
}

describe("streamed photo reading", () => {
  it("asks the provider for appearance first, observations and guesses last", () => {
    expect(Object.keys(observationJsonSchema.properties)).toEqual([
      "appearance",
      "absentParts",
      "quality",
      "qualityIssues",
      "summary",
      "observations",
      "modelGuesses",
      "visibleText",
    ]);
    expect(observationJsonSchema.required).toEqual(Object.keys(observationJsonSchema.properties));
  });

  it("finds each category as soon as its object closes, in any chunking", () => {
    const text = providerText();
    for (const size of [1, 3, 17, text.length]) {
      const parts: StreamedPart[] = [];
      const feed = createPartScanner((part) => parts.push(part));
      let caseAt = -1;
      for (let i = 0; i < text.length; i += size) {
        feed(text.slice(i, i + size));
        if (caseAt < 0 && parts.length) caseAt = i + size;
      }
      expect(parts.map((part) => part.category)).toEqual([
        "case",
        "gpu",
        "cooler",
        "fans",
        "memory",
        "motherboard",
      ]);
      expect(parts[0].value).toEqual(fixture.appearance!.case);
      // The case is known long before the text ends.
      if (size < text.length) expect(caseAt).toBeLessThan(text.length / 2);
    }
  });

  it("skips a category that fails the strict schema; the full parse decides later", () => {
    const parts: StreamedPart[] = [];
    const feed = createPartScanner((part) => parts.push(part));
    feed('{"appearance":{"case":{"type":"spaceship"},"gpu":');
    feed(JSON.stringify(fixture.appearance!.gpu));
    feed("}}");
    expect(parts.map((part) => part.category)).toEqual(["gpu"]);
  });

  it("streams parts and the result after every check, as NDJSON", async () => {
    const analyzer: ImageAnalyzer = async ({ onStarted, onPart }) => {
      onStarted?.();
      const feed = createPartScanner((part) => onPart?.(part));
      feed(providerText());
      return fixture;
    };
    const response = await handleInternalApiRequest(imageRequest(), dependencies(analyzer));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain(NDJSON);
    const events = await eventsOf(response);
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "part",
      "part",
      "part",
      "part",
      "part",
      "part",
      "done",
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      result: { analysisId: fixture.analysisId },
    });
  });

  it("answers with a status for errors before the provider starts, and an event after", async () => {
    const notConfigured = vi.fn<ImageAnalyzer>(async () => {
      throw new ImageAnalysisError(
        "Image analysis is not configured here.",
        503,
        "IMAGE_AI_NOT_CONFIGURED",
      );
    });
    const before = await handleInternalApiRequest(imageRequest(), dependencies(notConfigured));
    expect(before?.status).toBe(503);
    await expect(before?.json()).resolves.toMatchObject({
      error: { code: "IMAGE_AI_NOT_CONFIGURED" },
    });
    const late: ImageAnalyzer = async ({ onStarted }) => {
      onStarted?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new ImageAnalysisError(
        "Image analysis timed out. Please retry.",
        504,
        "ANALYSIS_TIMEOUT",
      );
    };
    const after = await handleInternalApiRequest(imageRequest(), dependencies(late));
    expect(after?.status).toBe(200);
    expect(await eventsOf(after)).toEqual([
      { type: "started" },
      {
        type: "error",
        code: "ANALYSIS_TIMEOUT",
        message: "Image analysis timed out. Please retry.",
      },
    ]);
  });

  it("still answers plain JSON when the client does not ask for a stream", async () => {
    const response = await handleInternalApiRequest(
      imageRequest({ accept: "application/json" }),
      dependencies(async () => fixture),
    );
    expect(response?.headers.get("content-type")).toContain("application/json");
    await expect(response?.json()).resolves.toMatchObject({ analysisId: fixture.analysisId });
  });

  it("plays a finished result as a stream: the parts it shows, then the result", async () => {
    vi.useFakeTimers();
    const events: AnalysisStreamEvent[] = [];
    const done = resultSource(fixture, 2)(
      (event) => events.push(event),
      new AbortController().signal,
    );
    await vi.runAllTimersAsync();
    await done;
    vi.useRealTimers();
    expect(events[0]).toEqual({ type: "started" });
    expect(events.filter((event) => event.type === "part").length).toBeGreaterThan(2);
    expect(events.at(-1)).toEqual({ type: "done", result: fixture });
  });
});
