import http from "node:http";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { analyzeReferenceImage } from "@/lib/v3/image-analysis.server";
import { handleInternalApiRequest } from "@/lib/api-router";
import { NDJSON, readEvents, type AnalysisStreamEvent } from "@/lib/v3/analysis-stream";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { MemoryDailyCap } from "@/lib/v3/image-daily-cap.server";
import { replaySource } from "@/lib/v3/image-replay";
import { ImageSessionLimiter } from "@/lib/v3/image-rate-limit.server";

// The fast and full reads run against a local stand-in for the OpenAI API: SSE streams whose
// timing and failures each test sets. Nothing calls OpenAI.
const fixture = createGlassFrontFixture();
const look = fixture.appearance!;
const fastLook = {
  ...look,
  gpu: { ...look.gpu, light: look.gpu.light === "white" ? "blue" : "white" },
};
const full = {
  appearance: look,
  absentParts: [],
  quality: "clear",
  qualityIssues: [],
  summary: "A white build.",
  observations: [],
  modelGuesses: [],
  visibleText: [],
};

type Behaviour = { delayMs: number; fail?: boolean; outOfCredit?: boolean; text: string };
let behaviour: { fast: Behaviour; full: Behaviour };
let calls: string[] = [];
let server: http.Server;
let baseUrl = "";

const sse = (res: http.ServerResponse, data: { type: string } & Record<string, unknown>) =>
  res.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const fast = JSON.parse(body).text?.format?.name === "pc_appearance";
    calls.push(fast ? "fast" : "full");
    const plan = fast ? behaviour.fast : behaviour.full;
    if (plan.fail) return void res.writeHead(500, { "content-type": "application/json" }).end("{}");
    if (plan.outOfCredit)
      return void res.writeHead(429, { "content-type": "application/json" }).end(
        JSON.stringify({
          error: {
            message: "You exceeded your current quota.",
            type: "insufficient_quota",
            code: "insufficient_quota",
          },
        }),
      );
    res.writeHead(200, { "content-type": "text/event-stream" });
    const response = { id: "r", object: "response", status: "in_progress", output: [] };
    sse(res, { type: "response.created", sequence_number: 0, response });
    await sleep(plan.delayMs);
    let sequence = 1;
    for (const delta of plan.text.match(/[\s\S]{1,40}/g)!)
      sse(res, {
        type: "response.output_text.delta",
        sequence_number: sequence++,
        item_id: "m",
        output_index: 0,
        content_index: 0,
        delta,
        logprobs: [],
      });
    sse(res, {
      type: "response.completed",
      sequence_number: sequence,
      response: { ...response, status: "completed", usage: { input_tokens: 1, output_tokens: 1 } },
    });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** A complete 16×16 white PNG (the smallest size Analyze accepts). */
function whitePng(size = 16) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])));
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc(size * (1 + size * 3), 0xff);
  for (let y = 0; y < size; y++) rows[y * (1 + size * 3)] = 0;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(rows)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
const png = whitePng();

function configure(fastRead = "") {
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "local-test-placeholder");
  vi.stubEnv("IMAGE_AI_BASE_URL", baseUrl);
  vi.stubEnv("IMAGE_FAST_READ", fastRead);
  calls = [];
}

async function read() {
  const parts: { category: string; light?: string; at: number }[] = [];
  const started = Date.now();
  const result = await analyzeReferenceImage({
    bytes: png,
    mime: "image/png",
    width: 16,
    height: 16,
    onPart: (part) =>
      parts.push({
        category: part.category,
        light: part.category === "gpu" ? (part.value as { light: string }).light : undefined,
        at: Date.now() - started,
      }),
  });
  return { result, parts };
}

describe("the fast and full reads", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("draws the fast read's parts first; the full read's result is final", async () => {
    configure();
    behaviour = {
      fast: { delayMs: 20, text: JSON.stringify({ appearance: fastLook }) },
      full: { delayMs: 400, text: JSON.stringify(full) },
    };
    const { result, parts } = await read();
    expect(calls.sort()).toEqual(["fast", "full"]);
    // Every category once, all from the fast read, well before the full read's pause ends.
    expect(parts.map((part) => part.category)).toEqual([
      "case",
      "gpu",
      "cooler",
      "fans",
      "memory",
      "motherboard",
    ]);
    expect(parts.find((part) => part.category === "gpu")!.light).toBe(fastLook.gpu.light);
    expect(Math.max(...parts.map((part) => part.at))).toBeLessThan(350);
    // The result is the full read's, which Studio then uses for "Adjusted after full read".
    expect(result.appearance!.gpu.light).toBe(look.gpu.light);
  });

  it("falls back to the full read's parts when the fast read fails", async () => {
    configure();
    behaviour = {
      fast: { delayMs: 0, fail: true, text: "" },
      full: { delayMs: 50, text: JSON.stringify(full) },
    };
    const { result, parts } = await read();
    expect(parts).toHaveLength(6);
    expect(parts.find((part) => part.category === "gpu")!.light).toBe(look.gpu.light);
    expect(result.summary).toBe("A white build.");
  });

  it("fails the analysis when the full read fails, even if the fast read worked", async () => {
    configure();
    behaviour = {
      fast: { delayMs: 0, text: JSON.stringify({ appearance: fastLook }) },
      full: { delayMs: 0, fail: true, text: "" },
    };
    await expect(read()).rejects.toMatchObject({ code: "ANALYSIS_FAILED" });
  });

  it("an account out of credit ends the analysis with the pause code", async () => {
    configure();
    behaviour = {
      fast: { delayMs: 0, outOfCredit: true, text: "" },
      full: { delayMs: 0, outOfCredit: true, text: "" },
    };
    await expect(read()).rejects.toMatchObject({ code: "PROVIDER_QUOTA_EXHAUSTED", status: 503 });
  });

  it("makes one call when the fast read is turned off", async () => {
    configure("off");
    behaviour = {
      fast: { delayMs: 0, text: JSON.stringify({ appearance: fastLook }) },
      full: { delayMs: 0, text: JSON.stringify(full) },
    };
    const { parts } = await read();
    expect(calls).toEqual(["full"]);
    expect(parts).toHaveLength(6);
  });

  it("counts one analysis against the daily cap, not one per call", async () => {
    configure();
    vi.stubEnv("IMAGE_ANALYSIS_DAILY_CAP", "2");
    behaviour = {
      fast: { delayMs: 0, text: JSON.stringify({ appearance: fastLook }) },
      full: { delayMs: 0, text: JSON.stringify(full) },
    };
    const cap = new MemoryDailyCap();
    const analyze = async () => {
      const response = (await handleInternalApiRequest(
        new Request("http://localhost/api/image-analyses", {
          method: "POST",
          headers: { "content-type": "image/png", accept: NDJSON },
          body: png,
        }),
        {
          imagePrecheck: { moderate: async () => null, classify: async () => null },
          imageLimiter: new ImageSessionLimiter([]),
          imageDailyCap: cap,
          workerBindings: null,
        },
      ))!;
      if (response.status !== 200) return (await response.json()).error.code as string;
      const events: AnalysisStreamEvent[] = [];
      await readEvents(response.body!, (event) => events.push(event));
      return events.at(-1)!.type;
    };
    expect(await analyze()).toBe("done");
    expect(await analyze()).toBe("done");
    expect(calls).toHaveLength(4);
    expect(await analyze()).toBe("DAILY_CAP_REACHED");
    expect(calls).toHaveLength(4);
  });
});

describe("replaying a recording of both reads", () => {
  it("draws the fast read's parts at its pace, then ends with the full result", async () => {
    const chunked = (text: string, from: number) =>
      text.match(/[\s\S]{1,40}/g)!.map((part, index) => ({ ms: from + index, text: part }));
    const replay = {
      key: "a".repeat(64),
      recordedAt: "",
      model: "gpt-5.4",
      image: { mime: "image/png" as const, width: 16, height: 16 },
      raw: full,
      stream: { chunks: chunked(JSON.stringify(full), 400) },
      fast: { model: "gpt-5.4", chunks: chunked(JSON.stringify({ appearance: fastLook }), 10) },
      precheck: { kind: "unclear", moderationMs: 1, kindMs: 1, usage: null, usedPreview: true },
    };
    const events: AnalysisStreamEvent[] = [];
    await replaySource(replay, 20)((event) => events.push(event), new AbortController().signal);
    expect(events[0]).toEqual({ type: "started", photo: "unclear" });
    const parts = events.filter((event) => event.type === "part");
    expect(parts).toHaveLength(6);
    const gpu = parts.find((event) => event.type === "part" && event.category === "gpu")!;
    expect(gpu.type === "part" && (gpu.value as { light: string }).light).toBe(fastLook.gpu.light);
    const done = events.at(-1)!;
    expect(done.type === "done" && done.result.appearance!.gpu.light).toBe(look.gpu.light);
  });
});
