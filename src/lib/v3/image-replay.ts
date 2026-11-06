import {
  createImageAnalysisResult,
  type ImageAnalysisResult,
  type PrecheckRecord,
} from "@/lib/v3/image-contract";
import type { ImageMime } from "@/lib/v3/image-input";
import { anyKnown } from "@/lib/v3/appearance-params";
import {
  createPartScanner,
  streamedCategories,
  type AnalysisStreamEvent,
  type StreamedPart,
} from "@/lib/v3/analysis-stream";
import type { ReadingSource } from "@/lib/v3/live-reading";

/**
 * Development replays of real image analyses. With IMAGE_REPLAY_DIR=local-replays, the dev server
 * saves each provider response under a hash of the original photo; picking the same photo again
 * then loads that response instead of calling the AI. `local-replays/` is gitignored: neither the
 * photos (often not the user's own) nor the responses are committed.
 */
export interface ImageReplay {
  key: string;
  recordedAt: string;
  model: string | null;
  /** Reasoning effort the model ran at, for reasoning models. */
  reasoningEffort?: string | null;
  /** How long the provider took to answer, when recorded. */
  durationMs?: number;
  /** Provider token usage for this one analysis, when recorded. */
  usage?: { inputTokens: number; outputTokens: number } | null;
  image: { mime: ImageMime; width: number; height: number };
  raw: unknown;
  /** Streamed reads: each text chunk with its time since the request (ms), to replay the pace. */
  stream?: { chunks: { ms: number; text: string }[] };
  /** The fast appearance-only read that ran alongside (image-analysis.server.ts), when it did. */
  fast?: {
    model: string;
    reasoningEffort?: string | null;
    usage?: { inputTokens: number; outputTokens: number } | null;
    raw?: unknown;
    chunks?: { ms: number; text: string }[];
    error?: string;
  };
  /** The precheck before the reads: the photo's kind, its time and the check's tokens. */
  precheck?: PrecheckRecord;
}

/** Lowercase hex SHA-256 of a file's original bytes: the replay key. */
export async function replayKeyOf(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const isReplayKey = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

// Dev builds only; the folder may not exist, which gives an empty map.
const replayFiles = import.meta.env.DEV
  ? import.meta.glob<ImageReplay>("/local-replays/*.json", { import: "default" })
  : {};

const pathFor = (key: string) => `/local-replays/${key}.json`;

export function hasReplay(key: string): boolean {
  return pathFor(key) in replayFiles;
}

/** The recorded analysis for this photo, rebuilt through the same strict parser as a live one. */
export async function loadReplay(key: string): Promise<ImageAnalysisResult | null> {
  const load = replayFiles[pathFor(key)];
  if (!load) return null;
  const replay = await load();
  return createImageAnalysisResult(
    replay.raw,
    replay.image,
    `replay-${key.slice(0, 12)}`,
    "fixture",
  );
}

/** The recorded file itself (dev only), for playback at its recorded pace. */
export async function loadReplayRecord(key: string): Promise<ImageReplay | null> {
  const load = replayFiles[pathFor(key)];
  return load ? load() : null;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}

/**
 * Plays a finished result as a stream with a short fixed rhythm: a pause for "reading", each
 * category the photo shows, then the result. For fixtures and replays recorded before streaming.
 */
export function resultSource(result: ImageAnalysisResult, speed = 1): ReadingSource {
  return async (onEvent, signal) => {
    onEvent({ type: "started" });
    await wait(700 / speed, signal);
    for (const category of streamedCategories) {
      const value = result.appearance?.[category];
      if (!value || !anyKnown(value as Record<string, string>)) continue;
      onEvent({ type: "part", category, value } as StreamedPart);
      await wait(160 / speed, signal);
    }
    await wait(500 / speed, signal);
    onEvent({ type: "done", result });
  };
}

/**
 * Plays a recorded stream at its recorded pace (or faster), through the same part scanner. A
 * recording with a fast read plays both, merged by time: the fast read draws the parts, and the
 * full read's parts are drawn only for categories the fast read did not give (as on the server).
 */
export function replaySource(replay: ImageReplay, speed = 1): ReadingSource {
  const result = () =>
    createImageAnalysisResult(
      replay.raw,
      replay.image,
      `replay-${replay.key.slice(0, 12)}`,
      "fixture",
    );
  const chunks = replay.stream?.chunks;
  if (!chunks?.length) return (onEvent, signal) => resultSource(result(), speed)(onEvent, signal);
  const fastChunks = replay.fast?.chunks ?? [];
  const timeline = [
    ...fastChunks.map((chunk) => ({ ...chunk, fast: true })),
    ...chunks.map((chunk) => ({ ...chunk, fast: false })),
  ].sort((a, b) => a.ms - b.ms);
  return async (onEvent, signal) => {
    onEvent({ type: "started", ...(replay.precheck?.kind === "unclear" && { photo: "unclear" }) });
    const drawn = new Set<string>();
    const waiting = new Map<string, StreamedPart>();
    const draw = (event: AnalysisStreamEvent) => {
      if (event.type !== "part" || drawn.has(event.category)) return;
      drawn.add(event.category);
      onEvent(event);
    };
    let fastLeft = fastChunks.length;
    const feedFast = createPartScanner(draw);
    const feedFull = createPartScanner((part) => {
      if (fastLeft > 0) waiting.set(part.category, part);
      else draw(part);
    });
    const start = performance.now();
    for (const chunk of timeline) {
      const due = chunk.ms / speed - (performance.now() - start);
      if (due > 0) await wait(due, signal);
      if (!chunk.fast) feedFull(chunk.text);
      else {
        feedFast(chunk.text);
        if (--fastLeft === 0) for (const part of waiting.values()) draw(part);
      }
    }
    onEvent({ type: "done", result: result() });
  };
}
