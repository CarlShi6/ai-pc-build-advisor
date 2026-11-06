import { afterEach, describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import { createImageAnalysisResult, type ImageAnalyzer } from "@/lib/v3/image-contract";
import { NDJSON, readEvents, type AnalysisStreamEvent } from "@/lib/v3/analysis-stream";
import { createImagePrecheck, ImagePrecheckError } from "@/lib/v3/image-precheck.server";
import { ipDayKey, MemoryDailyCap, utcDay } from "@/lib/v3/image-daily-cap.server";
import { ImageSessionLimiter } from "@/lib/v3/image-rate-limit.server";

function png() {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  return bytes;
}

function imageRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/image-analyses", {
    method: "POST",
    headers: { "content-type": "image/png", accept: NDJSON, ...headers },
    body: png(),
  });
}

const result = () =>
  createImageAnalysisResult(
    { summary: "PC", quality: "clear", qualityIssues: [], observations: [] },
    { mime: "image/png", width: 64, height: 64 },
  );

/** The provider as the OpenAI SDK sees it: moderation and the yes/no check, recorded in order. */
function fakeProvider(answer: { flagged?: boolean; kind?: unknown; status?: number }) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push(url.endsWith("/moderations") ? "moderation" : `check:${body.model}`);
    if (answer.status) return new Response("{}", { status: answer.status });
    if (url.endsWith("/moderations"))
      return Response.json({
        id: "modr",
        model: "omni-moderation-latest",
        results: [{ flagged: !!answer.flagged, categories: {}, category_scores: {} }],
      });
    return Response.json({
      id: "resp",
      object: "response",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              annotations: [],
              text: JSON.stringify({ kind: answer.kind ?? "pc_build" }),
            },
          ],
        },
      ],
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

/** A complete 1×1 PNG, so metadata stripping can parse it. */
const image = {
  bytes: Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ),
    (char) => char.charCodeAt(0),
  ),
  mime: "image/png" as const,
};

describe("checks before the photo is read", () => {
  afterEach(() => vi.unstubAllEnvs());
  const configure = () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "local-test-placeholder");
    vi.stubEnv("IMAGE_PRECHECK_MODEL", "");
  };

  it("runs moderation and the cheap kind check, and lets a PC photo through", async () => {
    configure();
    const provider = fakeProvider({});
    const result = await createImagePrecheck({ fetch: provider.fetch })(image);
    expect(provider.calls.sort()).toEqual(["check:gpt-4.1-mini", "moderation"]);
    expect(result).toMatchObject({ kind: "pc_build" });
    expect(result!.ms).toBeGreaterThanOrEqual(0);
  });

  it("reads PC parts and unclear photos; only not_pc is refused", async () => {
    configure();
    for (const kind of ["pc_part", "unclear"])
      expect(
        await createImagePrecheck({ fetch: fakeProvider({ kind }).fetch })(image),
      ).toMatchObject({ kind });
  });

  it("refuses a flagged photo and a photo that is not a PC", async () => {
    configure();
    await expect(
      createImagePrecheck({ fetch: fakeProvider({ flagged: true }).fetch })(image),
    ).rejects.toMatchObject({ code: "CONTENT_BLOCKED", status: 422 });
    await expect(
      createImagePrecheck({ fetch: fakeProvider({ kind: "not_pc" }).fetch })(image),
    ).rejects.toMatchObject({ code: "NOT_A_PC", status: 422 });
  });

  it("fails closed when a check cannot run or answers nonsense", async () => {
    configure();
    await expect(
      createImagePrecheck({ fetch: fakeProvider({ status: 500 }).fetch })(image),
    ).rejects.toMatchObject({ code: "ANALYSIS_FAILED" });
    await expect(
      createImagePrecheck({ fetch: fakeProvider({ status: 429 }).fetch })(image),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      createImagePrecheck({ fetch: fakeProvider({ kind: "yes" }).fetch })(image),
    ).rejects.toMatchObject({ code: "PRECHECK_FAILED" });
  });

  it("leaves an unconfigured provider to the read, which answers with its own code", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    const provider = fakeProvider({});
    expect(await createImagePrecheck({ fetch: provider.fetch })(image)).toBeNull();
    expect(provider.calls).toEqual([]);
  });

  it("tells Studio an unclear photo is being read anyway, in the started event", async () => {
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: async ({ onStarted }) => {
        onStarted?.();
        return result();
      },
      imagePrecheck: async () => ({ kind: "unclear", ms: 5, usage: null }),
      imageLimiter: new ImageSessionLimiter(),
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: null,
    }))!;
    const events: AnalysisStreamEvent[] = [];
    await readEvents(response.body!, (event) => events.push(event));
    expect(events[0]).toEqual({ type: "started", photo: "unclear" });
  });

  it("answers a refused photo with its status before any stream, and the analyzer never runs", async () => {
    const analyzer = vi.fn<ImageAnalyzer>(async () => result());
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: analyzer,
      imagePrecheck: async () => {
        throw new ImagePrecheckError("NOT_A_PC");
      },
      imageLimiter: new ImageSessionLimiter(),
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: null,
    }))!;
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error.code).toBe("NOT_A_PC");
    expect(analyzer).not.toHaveBeenCalled();
  });
});

describe("launch limits on Analyze", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("the kill switch stops analysis before the photo is read or counted", async () => {
    vi.stubEnv("IMAGE_ANALYSIS_PAUSED", "true");
    const analyzer = vi.fn<ImageAnalyzer>(async () => result());
    const cap = new MemoryDailyCap();
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: analyzer,
      imageDailyCap: cap,
      workerBindings: null,
    }))!;
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("IMAGE_ANALYSIS_PAUSED");
    expect(analyzer).not.toHaveBeenCalled();
    expect(await cap.reserve(utcDay(), 1)).toBe(true);
    vi.stubEnv("IMAGE_ANALYSIS_PAUSED", "false");
    const open = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: analyzer,
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: null,
    }))!;
    expect(open.status).toBe(200);
  });

  it("caps each client IP per day, even with a fresh session cookie each time", async () => {
    vi.stubEnv("IMAGE_ANALYSIS_IP_DAILY_CAP", "2");
    const analyzer = vi.fn<ImageAnalyzer>(async () => result());
    const ipCap = new MemoryDailyCap();
    const send = (ip: string) =>
      handleInternalApiRequest(imageRequest({ "cf-connecting-ip": ip }), {
        imageAnalyzer: analyzer,
        imageLimiter: new ImageSessionLimiter(),
        imageDailyCap: new MemoryDailyCap(),
        imageIpDailyCap: ipCap,
        workerBindings: null,
      }).then((response) => response!);
    expect((await send("203.0.113.7")).status).toBe(200);
    expect((await send("203.0.113.7")).status).toBe(200);
    const third = await send("203.0.113.7");
    expect(third.status).toBe(429);
    expect((await third.json()).error.code).toBe("IP_DAILY_CAP_REACHED");
    expect((await send("198.51.100.4")).status).toBe(200);
    expect(analyzer).toHaveBeenCalledTimes(3);
  });

  it("keys the IP count by a hash, never the address itself", async () => {
    const key = await ipDayKey("2026-11-05", "203.0.113.7");
    expect(key).toMatch(/^2026-11-05\|ip:[0-9a-f]{32}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(await ipDayKey("2026-11-06", "203.0.113.7")).not.toBe(key.replace("11-05", "11-06"));
  });
});
