import { ImageAnalysisError } from "@/lib/v3/image-analysis.server";

/**
 * Per-session limit for image analysis, checked before the process-wide cap in
 * `image-analysis.server.ts`. State is in memory: it resets on restart and is per isolate on
 * serverless hosts, so it limits honest overuse and cost spikes, not determined abuse. A
 * durable limit needs a platform binding or shared store at deployment (REUSE_DECISIONS.md).
 */
export interface ImageRateWindow {
  limit: number;
  windowMs: number;
}

export const IMAGE_SESSION_LIMITS: ImageRateWindow[] = [
  { limit: 3, windowMs: 60_000 },
  { limit: 15, windowMs: 24 * 60 * 60_000 },
];

export const IMAGE_SESSION_COOKIE = "aipc_image_session";
const MAX_TRACKED_KEYS = 10_000;

export class ImageSessionLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windows: ImageRateWindow[] = IMAGE_SESSION_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Reserves one analysis for `key`, or throws 429. The returned function gives it back. */
  reserve(key: string): () => void {
    const now = this.now();
    const longest = Math.max(...this.windows.map((window) => window.windowMs));
    const recent = (this.hits.get(key) ?? []).filter((time) => time > now - longest);
    for (const window of this.windows) {
      const inWindow = recent.filter((time) => time > now - window.windowMs);
      if (inWindow.length >= window.limit) {
        const retryAfterMs = inWindow[0] + window.windowMs - now;
        throw new ImageSessionLimitError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
      }
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_TRACKED_KEYS) this.hits.delete(this.hits.keys().next().value!);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const list = this.hits.get(key);
      const index = list?.lastIndexOf(now) ?? -1;
      if (list && index >= 0) list.splice(index, 1);
    };
  }
}

export class ImageSessionLimitError extends ImageAnalysisError {
  constructor(public readonly retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(
      `You've reached the image analysis limit for this session. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or continue manually.`,
      429,
      "SESSION_RATE_LIMITED",
    );
    this.name = "ImageSessionLimitError";
  }
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/**
 * Picks the limiter key: signed-in user, then this browser's image-session cookie, then the
 * client IP, then one shared bucket. Returns a cookie to set when the browser has none yet.
 */
export function imageSessionKey(
  request: Request,
  userId: string | undefined,
): { key: string; setCookie?: string } {
  const cookie = readCookie(request, IMAGE_SESSION_COOKIE);
  const validCookie = cookie && /^[0-9a-f-]{36}$/.test(cookie) ? cookie : null;
  const setCookie = validCookie
    ? undefined
    : `${IMAGE_SESSION_COOKIE}=${crypto.randomUUID()}; Path=/api/image-analyses; SameSite=Lax; HttpOnly; Max-Age=86400`;
  if (userId) return { key: `user:${userId}`, setCookie };
  if (validCookie) return { key: `browser:${validCookie}` };
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { key: ip ? `ip:${ip}` : "unidentified", setCookie };
}

export const imageSessionLimiter = new ImageSessionLimiter();
