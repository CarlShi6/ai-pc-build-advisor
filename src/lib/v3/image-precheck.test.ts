import { afterEach, describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import { createImageAnalysisResult, type ImageAnalyzer } from "@/lib/v3/image-contract";
import { NDJSON, readEvents, type AnalysisStreamEvent } from "@/lib/v3/analysis-stream";
import { createImagePrecheck, ImagePrecheckError } from "@/lib/v3/image-precheck.server";
import { ImageAnalysisError, providerFailure } from "@/lib/v3/image-analysis.server";
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
function fakeProvider(answer: {
  flagged?: boolean;
  kind?: unknown;
  status?: number;
  outOfCredit?: boolean;
}) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push(url.endsWith("/moderations") ? "moderation" : `check:${body.model}`);
    if (answer.outOfCredit)
      return new Response(
        JSON.stringify({
          error: {
            message: "You exceeded your current quota.",
            type: "insufficient_quota",
            code: "insufficient_quota",
          },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      );
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

  const checks = (answer: Parameters<typeof fakeProvider>[0]) => {
    const provider = fakeProvider(answer);
    return { ...createImagePrecheck({ fetch: provider.fetch }), calls: provider.calls };
  };

  it("runs moderation and the cheap kind check, each timed, and lets a PC photo through", async () => {
    configure();
    const check = checks({});
    expect(await check.moderate(image)).toMatchObject({ ms: expect.any(Number) });
    const result = await check.classify(image);
    expect(check.calls).toEqual(["moderation", "check:gpt-4.1-mini"]);
    expect(result).toMatchObject({ kind: "pc_build", ms: expect.any(Number) });
  });

  it("reads PC parts and unclear photos; only not_pc is refused", async () => {
    configure();
    for (const kind of ["pc_part", "unclear"])
      expect(await checks({ kind }).classify(image)).toMatchObject({ kind });
  });

  it("refuses a flagged photo and a photo that is not a PC", async () => {
    configure();
    await expect(checks({ flagged: true }).moderate(image)).rejects.toMatchObject({
      code: "CONTENT_BLOCKED",
      status: 422,
    });
    await expect(checks({ kind: "not_pc" }).classify(image)).rejects.toMatchObject({
      code: "NOT_A_PC",
      status: 422,
    });
  });

  it("fails closed when a check cannot run or answers nonsense", async () => {
    configure();
    await expect(checks({ status: 500 }).moderate(image)).rejects.toMatchObject({
      code: "ANALYSIS_FAILED",
    });
    await expect(checks({ status: 429 }).classify(image)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await expect(checks({ kind: "yes" }).classify(image)).rejects.toMatchObject({
      code: "PRECHECK_FAILED",
    });
  });

  it("an OpenAI account out of credit reads as a pause, not a rate limit", async () => {
    configure();
    for (const run of [
      (provider: ReturnType<typeof checks>) => provider.moderate(image),
      (provider: ReturnType<typeof checks>) => provider.classify(image),
    ])
      await expect(run(checks({ outOfCredit: true }))).rejects.toMatchObject({
        code: "PROVIDER_QUOTA_EXHAUSTED",
        status: 503,
      });
    // An ordinary 429 is still a rate limit.
    await expect(checks({ status: 429 }).classify(image)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("leaves an unconfigured provider to the read, which answers with its own code", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    const check = checks({});
    expect(await check.moderate(image)).toBeNull();
    expect(await check.classify(image)).toBeNull();
    expect(check.calls).toEqual([]);
  });

  const limits = () => ({
    imageLimiter: new ImageSessionLimiter(),
    imageDailyCap: new MemoryDailyCap(),
    workerBindings: null,
  });

  it("tells Studio an unclear photo is being read anyway, in the started event", async () => {
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: async ({ onStarted }) => {
        onStarted?.();
        return result();
      },
      imagePrecheck: {
        moderate: async () => ({ ms: 1 }),
        classify: async () => ({ kind: "unclear", ms: 5, usage: null }),
      },
      ...limits(),
    }))!;
    const events: AnalysisStreamEvent[] = [];
    await readEvents(response.body!, (event) => events.push(event));
    expect(events[0]).toEqual({ type: "started", photo: "unclear" });
  });

  it("a flagged photo is refused before either read starts", async () => {
    const analyzer = vi.fn<ImageAnalyzer>(async () => result());
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: analyzer,
      imagePrecheck: {
        moderate: async () => {
          throw new ImagePrecheckError("CONTENT_BLOCKED");
        },
        classify: async () => ({ kind: "pc_build", ms: 1, usage: null }),
      },
      ...limits(),
    }))!;
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("CONTENT_BLOCKED");
    expect(analyzer).not.toHaveBeenCalled();
  });

  it("on not_pc, cancels the reads already running and answers 422 before any stream", async () => {
    let cancelled = false;
    const sent: string[] = [];
    let refuse = () => {};
    const response = (await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: async ({ signal, onStarted, onPart }) => {
        // The reads start and even produce a part while the kind check is still running.
        onStarted?.();
        onPart?.({ type: "part", category: "case", value: {} as never });
        sent.push("part");
        refuse();
        await new Promise((resolve) => signal!.addEventListener("abort", resolve));
        cancelled = true;
        throw new ImagePrecheckError("NOT_A_PC");
      },
      imagePrecheck: {
        moderate: async () => ({ ms: 1 }),
        classify: () =>
          new Promise((_, reject) => {
            refuse = () => reject(new ImagePrecheckError("NOT_A_PC"));
          }),
      },
      ...limits(),
    }))!;
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error.code).toBe("NOT_A_PC");
    expect(sent).toEqual(["part"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled).toBe(true);
  });

  it("out of credit during the kind check: the reads are cancelled and the answer is the pause", async () => {
    const response = (await handleInternalApiRequest(imageRequest(), {
      // As the real reads do: a cancelled read ends with its own CANCELLED error.
      imageAnalyzer: async ({ signal }) => {
        await new Promise((resolve) => signal!.addEventListener("abort", resolve));
        throw new ImageAnalysisError("The read was cancelled.", 499, "CANCELLED");
      },
      imagePrecheck: {
        moderate: async () => ({ ms: 1 }),
        classify: async () => {
          throw providerFailure(
            Object.assign(new Error("quota"), { status: 429, code: "insufficient_quota" }),
            false,
          );
        },
      },
      ...limits(),
    }))!;
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error.code).toBe("PROVIDER_QUOTA_EXHAUSTED");
  });

  it("still counts a not_pc photo against the daily cap", async () => {
    const cap = new MemoryDailyCap();
    vi.stubEnv("IMAGE_ANALYSIS_DAILY_CAP", "1");
    const send = () =>
      handleInternalApiRequest(imageRequest(), {
        imageAnalyzer: async ({ signal }) => {
          await new Promise((resolve) => signal!.addEventListener("abort", resolve));
          throw new ImagePrecheckError("NOT_A_PC");
        },
        imagePrecheck: {
          moderate: async () => ({ ms: 1 }),
          classify: async () => {
            throw new ImagePrecheckError("NOT_A_PC");
          },
        },
        imageLimiter: new ImageSessionLimiter(),
        imageDailyCap: cap,
        workerBindings: null,
      }).then(async (response) => (await response!.json()).error.code);
    expect(await send()).toBe("NOT_A_PC");
    expect(await send()).toBe("DAILY_CAP_REACHED");
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

describe("the small copy for the kind check", () => {
  /** A PNG header with the given size, enough for the server's checks. */
  const pngOf = (size: number) => {
    const bytes = new Uint8Array(33);
    bytes.set([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
    ]);
    new DataView(bytes.buffer).setUint32(16, size);
    new DataView(bytes.buffer).setUint32(20, size);
    return new Blob([bytes], { type: "image/png" });
  };
  const analyze = async (preview: Blob | null) => {
    const form = new FormData();
    form.append("image", pngOf(1600), "image");
    if (preview) form.append("preview", preview, "preview");
    const seen: Record<string, number> = {};
    const response = (await handleInternalApiRequest(
      new Request("http://localhost/api/image-analyses", {
        method: "POST",
        headers: { accept: NDJSON },
        body: form,
      }),
      {
        imageAnalyzer: async ({ width, onStarted }) => {
          seen.read = width;
          onStarted?.();
          return result();
        },
        imagePrecheck: {
          moderate: async ({ bytes }) => {
            seen.moderation = new DataView(bytes.buffer, bytes.byteOffset).getUint32(16);
            return { ms: 1 };
          },
          classify: async ({ bytes }) => {
            seen.kind = new DataView(bytes.buffer, bytes.byteOffset).getUint32(16);
            return { kind: "pc_build", ms: 1, usage: null };
          },
        },
        imageLimiter: new ImageSessionLimiter(),
        imageDailyCap: new MemoryDailyCap(),
        workerBindings: null,
      },
    ))!;
    expect(response.status).toBe(200);
    await response.text();
    return seen;
  };

  it("checks the kind on the 512 px copy, and moderates and reads the photo itself", async () => {
    expect(await analyze(pngOf(512))).toEqual({ moderation: 1600, kind: 512, read: 1600 });
  });

  it("uses the photo when the copy is missing or too large", async () => {
    expect((await analyze(null)).kind).toBe(1600);
    expect((await analyze(pngOf(1200))).kind).toBe(1600);
  });
});
