import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import type { D1Like, D1Statement } from "@/lib/v3/cloudflare-env.server";
import { createImageAnalysisResult } from "@/lib/v3/image-contract";
import {
  D1DailyCap,
  DEFAULT_DAILY_CAP,
  dailyCapOf,
  MemoryDailyCap,
  utcDay,
} from "@/lib/v3/image-daily-cap.server";
import { ImageSessionLimiter } from "@/lib/v3/image-rate-limit.server";
import { verifyTurnstile } from "@/lib/v3/turnstile.server";

/** D1's statement API over a real SQLite database, so the cap's SQL itself is tested. */
function sqliteD1(): D1Like {
  const db = new DatabaseSync(":memory:");
  const statement = (query: string, values: unknown[] = []): D1Statement => ({
    bind: (...next) => statement(query, next),
    first: async <T>() => (db.prepare(query).get(...(values as never[])) as T | undefined) ?? null,
    run: async () => db.prepare(query).run(...(values as never[])),
  });
  return { prepare: (query) => statement(query) };
}

function imageRequest(headers: Record<string, string> = {}) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  return new Request("http://localhost/api/image-analyses", {
    method: "POST",
    headers: { "content-type": "image/png", ...headers },
    body: bytes,
  });
}

const analyzer = () =>
  vi.fn(async () =>
    createImageAnalysisResult(
      { summary: "PC", quality: "clear", qualityIssues: [], observations: [] },
      { mime: "image/png", width: 64, height: 64 },
    ),
  );

describe("global daily analysis cap", () => {
  it("stops at the cap in D1, per UTC day, and gives back a released analysis", async () => {
    const cap = new D1DailyCap(sqliteD1());
    for (let i = 0; i < 3; i += 1) expect(await cap.reserve("2026-10-28", 3)).toBe(true);
    expect(await cap.reserve("2026-10-28", 3)).toBe(false);
    expect(await cap.reserve("2026-10-29", 3)).toBe(true);
    await cap.release("2026-10-28");
    expect(await cap.reserve("2026-10-28", 3)).toBe(true);
    expect(await cap.reserve("2026-10-28", 0)).toBe(false);
    expect(utcDay(Date.UTC(2026, 9, 28, 23, 59))).toBe("2026-10-28");
  });

  it("reads the configured cap, never treating a bad value as no cap", () => {
    expect(dailyCapOf(undefined)).toBe(DEFAULT_DAILY_CAP);
    expect(dailyCapOf("25")).toBe(25);
    expect(dailyCapOf("0")).toBe(0);
    for (const bad of ["", "-1", "ten", "2.5"]) expect(dailyCapOf(bad)).toBe(DEFAULT_DAILY_CAP);
  });

  it("returns a friendly paused message over the cap and never calls the provider", async () => {
    vi.stubEnv("IMAGE_ANALYSIS_DAILY_CAP", "2");
    const run = analyzer();
    const dependencies = {
      imageAnalyzer: run,
      imageLimiter: new ImageSessionLimiter([]),
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: null,
    };
    for (let i = 0; i < 2; i += 1)
      expect((await handleInternalApiRequest(imageRequest(), dependencies))?.status).toBe(200);
    const over = await handleInternalApiRequest(imageRequest(), dependencies);
    expect(over?.status).toBe(429);
    await expect(over?.json()).resolves.toMatchObject({
      error: {
        code: "DAILY_CAP_REACHED",
        message: expect.stringMatching(/^Photo reading is paused for today/),
      },
    });
    expect(run).toHaveBeenCalledTimes(2);
    vi.unstubAllEnvs();
  });

  it("keeps analysis off when no shared store is configured", async () => {
    const run = analyzer();
    const response = await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: run,
      imageLimiter: new ImageSessionLimiter([]),
      imageDailyCap: null,
      workerBindings: null,
    });
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "DAILY_CAP_UNAVAILABLE" },
    });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("abuse limits on Analyze", () => {
  it("uses the platform rate limit before the provider", async () => {
    const run = analyzer();
    const limit = vi.fn(async () => ({ success: false }));
    const response = await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: run,
      imageLimiter: new ImageSessionLimiter([]),
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: { IMAGE_RATE_LIMITER: { limit } },
    });
    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "SESSION_RATE_LIMITED" },
    });
    expect(limit).toHaveBeenCalledWith({ key: "unidentified" });
    expect(run).not.toHaveBeenCalled();
  });

  it("checks Turnstile only when the secret is set, and fails closed", async () => {
    const passed = vi.fn(async () => Response.json({ success: true }));
    await expect(verifyTurnstile(imageRequest(), undefined, passed)).resolves.toBeUndefined();
    expect(passed).not.toHaveBeenCalled();
    await expect(verifyTurnstile(imageRequest(), "secret", passed)).rejects.toMatchObject({
      code: "TURNSTILE_FAILED",
    });
    await expect(
      verifyTurnstile(imageRequest({ "x-turnstile-token": "t" }), "secret", passed),
    ).resolves.toBeUndefined();
    const failed = vi.fn(async () => Response.json({ success: false }));
    await expect(
      verifyTurnstile(imageRequest({ "x-turnstile-token": "t" }), "secret", failed),
    ).rejects.toMatchObject({ status: 403 });
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      verifyTurnstile(imageRequest({ "x-turnstile-token": "t" }), "secret", down),
    ).rejects.toMatchObject({ code: "TURNSTILE_FAILED" });
  });

  it("rejects Analyze without a passed check when Turnstile is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const run = analyzer();
    const response = await handleInternalApiRequest(imageRequest(), {
      imageAnalyzer: run,
      imageDailyCap: new MemoryDailyCap(),
      workerBindings: null,
      turnstileFetch: vi.fn(async () => Response.json({ success: false })),
    });
    expect(response?.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
