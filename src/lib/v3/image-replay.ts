import { createImageAnalysisResult, type ImageAnalysisResult } from "@/lib/v3/image-contract";
import type { ImageMime } from "@/lib/v3/image-input";

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
  /** Provider token usage for this one analysis, when recorded. */
  usage?: { inputTokens: number; outputTokens: number } | null;
  image: { mime: ImageMime; width: number; height: number };
  raw: unknown;
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
