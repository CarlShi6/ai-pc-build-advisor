import type { ReadingSource } from "@/lib/v3/live-reading";
import { hasReplay, loadReplayRecord, replaySource, resultSource } from "@/lib/v3/image-replay";

/**
 * What a read needs to run again after a reload interrupted it: the resized, metadata-free copy
 * that was sent (never the original), or, for a dev fixture, which fixture it was. Kept in this
 * tab's session storage only while the photo is read; removed when the read ends.
 */
export type ReadingRetry =
  | { kind: "photo"; dataUrl: string; replayKey?: string }
  | { kind: "fixture"; fileName: string; replayKey?: string; speed: number };

const KEY = "aipc-v3-reading-retry";

export function saveReadingRetry(readingId: string, retry: ReadingRetry) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ readingId, retry }));
  } catch {
    // Storage full or blocked: an interrupted read then offers the upload page instead.
    clearReadingRetry();
  }
}

export function loadReadingRetry(readingId: string): ReadingRetry | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    return value?.readingId === readingId ? (value.retry as ReadingRetry) : null;
  } catch {
    return null;
  }
}

export function clearReadingRetry() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Decoded in place: the content policy does not let the page fetch data: URLs. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, base64 = ""] = dataUrl.split(",", 2);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Dev only: a recorded replay of this photo, else the named sample's fixture. */
export async function localFixtureSource(
  fileName: string,
  replayKey: string | undefined,
  speed: number,
): Promise<ReadingSource | null> {
  if (!import.meta.env.DEV) return null;
  const replay = replayKey && hasReplay(replayKey) ? await loadReplayRecord(replayKey) : null;
  if (replay) return replaySource(replay, speed);
  const { devImageFixtures } = await import("@/lib/v3/dev-image-fixture");
  const fixture = devImageFixtures[fileName]?.();
  return fixture ? resultSource(fixture, speed) : null;
}
