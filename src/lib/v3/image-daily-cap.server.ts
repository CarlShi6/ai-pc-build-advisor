import { ImageAnalysisError } from "@/lib/v3/image-analysis.server";
import type { D1Like } from "@/lib/v3/cloudflare-env.server";

/**
 * Global daily cap on photo analyses across all users (docs/DEPLOY.md, Stage 2). Counted per UTC
 * day in shared storage: a D1 table on Cloudflare (`IMAGE_CAP_DB`), memory in dev and tests.
 * Once the cap is reached the provider is never called that day.
 *
 * The same stores also count per client IP (`ipDayKey`): the key is the day plus a hash of the
 * day and the IP, so a cleared cookie does not reset the count and no IP address is stored.
 */
export const DEFAULT_DAILY_CAP = 30;
export const DEFAULT_IP_DAILY_CAP = 10;

export interface DailyCapStore {
  /** Counts one analysis for `day`; false when the day's cap is already reached. */
  reserve(day: string, cap: number): Promise<boolean>;
  /** Gives one back, for a request that never reached the provider. */
  release(day: string): Promise<void>;
}

export class MemoryDailyCap implements DailyCapStore {
  private readonly counts = new Map<string, number>();

  async reserve(day: string, cap: number) {
    const count = this.counts.get(day) ?? 0;
    if (count >= cap) return false;
    // Earlier days are done with.
    for (const key of this.counts.keys())
      if (key.slice(0, 10) !== day.slice(0, 10)) this.counts.delete(key);
    this.counts.set(day, count + 1);
    return true;
  }

  async release(day: string) {
    const count = this.counts.get(day) ?? 0;
    if (count > 0) this.counts.set(day, count - 1);
  }
}

/**
 * D1 store. The upsert only increments while below the cap and returns no row once it is
 * reached, so concurrent requests on different isolates can never pass the cap together.
 */
export class D1DailyCap implements DailyCapStore {
  private ready: Promise<unknown> | undefined;

  constructor(private readonly db: D1Like) {}

  private table() {
    // Created on first use; rows of earlier days (global and per-IP) are cleared once per isolate.
    this.ready ??= this.db
      .prepare(
        "CREATE TABLE IF NOT EXISTS image_analysis_daily (day TEXT PRIMARY KEY, count INTEGER NOT NULL)",
      )
      .run()
      .then(() =>
        this.db
          .prepare("DELETE FROM image_analysis_daily WHERE substr(day, 1, 10) < ?1")
          .bind(utcDay())
          .run(),
      );
    return this.ready;
  }

  async reserve(day: string, cap: number) {
    if (cap <= 0) return false;
    await this.table();
    const row = await this.db
      .prepare(
        "INSERT INTO image_analysis_daily (day, count) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1 WHERE count < ?2 RETURNING count",
      )
      .bind(day, cap)
      .first<{ count: number }>();
    return row !== null;
  }

  async release(day: string) {
    await this.table();
    await this.db
      .prepare("UPDATE image_analysis_daily SET count = count - 1 WHERE day = ?1 AND count > 0")
      .bind(day)
      .run();
  }
}

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** The configured cap; a missing or malformed value means the default, never "no cap". */
export function dailyCapOf(value: string | undefined, fallback = DEFAULT_DAILY_CAP) {
  const parsed = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

/** The per-IP counter key for `day`: the day, then a hash of the day and the IP. */
export async function ipDayKey(day: string, ip: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${day}|ip:${hex.join("").slice(0, 32)}`;
}

/** The client IP as Cloudflare reports it; elsewhere (dev, tests) there may be none. */
export const clientIp = (request: Request) =>
  request.headers.get("cf-connecting-ip")?.trim() || null;

export class DailyCapError extends ImageAnalysisError {
  constructor(code: "DAILY_CAP_REACHED" | "DAILY_CAP_UNAVAILABLE") {
    super(
      code === "DAILY_CAP_REACHED"
        ? "Photo reading is paused for today: the daily limit for photo analyses has been reached. It starts again tomorrow (UTC)."
        : "Photo reading is not available right now.",
      code === "DAILY_CAP_REACHED" ? 429 : 503,
      code,
    );
    this.name = "DailyCapError";
  }
}

export class IpDailyCapError extends ImageAnalysisError {
  constructor() {
    super(
      "This network has reached today's limit for photo analyses. It starts again tomorrow (UTC); you can still describe your PC or build it by hand.",
      429,
      "IP_DAILY_CAP_REACHED",
    );
    this.name = "IpDailyCapError";
  }
}

export const memoryDailyCap = new MemoryDailyCap();
export const memoryIpDailyCap = new MemoryDailyCap();
