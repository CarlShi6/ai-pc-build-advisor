import { afterEach, describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";
import { createImageAnalysisResult } from "@/lib/v3/image-contract";
import {
  IMAGE_SESSION_COOKIE,
  imageSessionKey,
  ImageSessionLimiter,
  ImageSessionLimitError,
} from "@/lib/v3/image-rate-limit.server";

const browserId = "123e4567-e89b-42d3-a456-426614174000";

function pngHeader() {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 64);
  new DataView(bytes.buffer).setUint32(20, 64);
  return bytes;
}

function imageRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/image-analyses", {
    method: "POST",
    headers: { "content-type": "image/png", ...headers },
    body: pngHeader(),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("per-session image analysis limit", () => {
  it("allows 3 per minute and 15 per day per session, with a retry time", () => {
    let now = 0;
    const limiter = new ImageSessionLimiter(undefined, () => now);
    for (let i = 0; i < 3; i += 1) limiter.reserve("browser:a");
    expect(() => limiter.reserve("browser:a")).toThrow(ImageSessionLimitError);
    // Another session is unaffected.
    expect(() => limiter.reserve("browser:b")).not.toThrow();
    try {
      limiter.reserve("browser:a");
    } catch (error) {
      expect((error as ImageSessionLimitError).retryAfterSeconds).toBe(60);
      expect((error as ImageSessionLimitError).status).toBe(429);
    }
    for (let minute = 1; minute < 5; minute += 1) {
      now = minute * 61_000;
      for (let i = 0; i < 3; i += 1) limiter.reserve("browser:a");
    }
    now = 6 * 61_000;
    expect(() => limiter.reserve("browser:a")).toThrow(/limit for this session/);
  });

  it("gives a released reservation back exactly once", () => {
    const limiter = new ImageSessionLimiter([{ limit: 1, windowMs: 60_000 }], () => 1000);
    const release = limiter.reserve("k");
    release();
    release();
    const second = limiter.reserve("k");
    expect(() => limiter.reserve("k")).toThrow(ImageSessionLimitError);
    second();
  });

  it("keys by signed-in user, then image cookie, then IP, then a shared bucket", () => {
    const withCookie = imageRequest({ cookie: `${IMAGE_SESSION_COOKIE}=${browserId}` });
    expect(imageSessionKey(withCookie, "user-1")).toEqual({ key: "user:user-1" });
    expect(imageSessionKey(withCookie, undefined)).toEqual({ key: `browser:${browserId}` });
    const byIp = imageSessionKey(imageRequest({ "cf-connecting-ip": "203.0.113.9" }), undefined);
    expect(byIp.key).toBe("ip:203.0.113.9");
    expect(byIp.setCookie).toMatch(/HttpOnly/);
    expect(
      imageSessionKey(imageRequest({ cookie: `${IMAGE_SESSION_COOKIE}=bad` }), undefined).key,
    ).toBe("unidentified");
  });

  it("returns 429 with Retry-After before calling the provider again", async () => {
    const limiter = new ImageSessionLimiter();
    const analyzer = vi.fn(async () =>
      createImageAnalysisResult(
        { summary: "PC", quality: "clear", qualityIssues: [], observations: [] },
        { mime: "image/png", width: 64, height: 64 },
      ),
    );
    const cookie = { cookie: `${IMAGE_SESSION_COOKIE}=${browserId}` };
    for (let i = 0; i < 3; i += 1) {
      const ok = await handleInternalApiRequest(imageRequest(cookie), {
        imageAnalyzer: analyzer,
        imageLimiter: limiter,
      });
      expect(ok?.status).toBe(200);
    }
    const limited = await handleInternalApiRequest(imageRequest(cookie), {
      imageAnalyzer: analyzer,
      imageLimiter: limiter,
    });
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toBe("60");
    await expect(limited?.json()).resolves.toMatchObject({
      error: { code: "SESSION_RATE_LIMITED" },
    });
    expect(analyzer).toHaveBeenCalledTimes(3);
  });

  it("sets the image-session cookie and doesn't count requests that never reach the provider", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    const limiter = new ImageSessionLimiter();
    for (let i = 0; i < 5; i += 1) {
      const response = await handleInternalApiRequest(imageRequest(), { imageLimiter: limiter });
      expect(response?.status).toBe(503);
      expect(response?.headers.get("set-cookie")).toContain(`${IMAGE_SESSION_COOKIE}=`);
    }
    expect(() => limiter.reserve("unidentified")).not.toThrow();
  });
});
