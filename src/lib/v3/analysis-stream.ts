import { appearanceParamsSchema, type AppearanceParams } from "@/lib/v3/appearance-params";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";

/**
 * Streamed photo reading. The provider writes the JSON in schema order, appearance first (case →
 * gpu → cooler → fans → memory → motherboard), so each category can be drawn as soon as its object
 * closes; observations and guesses come last. The server sends NDJSON events; local replays play
 * the same events, so Studio has one consumer for both.
 */
export const streamedCategories = [
  "case",
  "gpu",
  "cooler",
  "fans",
  "memory",
  "motherboard",
] as const;
export type StreamedCategory = (typeof streamedCategories)[number];

export type StreamedPart<C extends StreamedCategory = StreamedCategory> = {
  type: "part";
  category: C;
  value: AppearanceParams[C];
};

export type AnalysisStreamEvent =
  | { type: "started" }
  | StreamedPart
  | { type: "done"; result: ImageAnalysisResult }
  | { type: "error"; code: string; message: string };

export const NDJSON = "application/x-ndjson";

const isCategory = (value: string): value is StreamedCategory =>
  (streamedCategories as readonly string[]).includes(value);

/**
 * Incremental scanner over the provider's JSON text. Calls `onPart` once per appearance category,
 * when its object has closed and passes the strict schema; a malformed category is skipped here
 * and left to the full parse at the end.
 */
export function createPartScanner(onPart: (part: StreamedPart) => void) {
  const stack: {
    type: "obj" | "arr";
    key: string;
    start: number;
    index: number;
    expectKey: boolean;
  }[] = [];
  let text = "";
  let inString = false;
  let escape = false;
  let token = "";
  let lastKey = "";
  return function feed(chunk: string) {
    const offset = text.length;
    text += chunk;
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') {
          inString = false;
          const top = stack.at(-1);
          if (top?.type === "obj" && top.expectKey) {
            lastKey = token;
            top.expectKey = false;
          }
        } else token += ch;
        continue;
      }
      const top = stack.at(-1);
      if (ch === '"') {
        inString = true;
        token = "";
      } else if (ch === "{" || ch === "[") {
        const key = !top ? "$" : top.type === "obj" ? lastKey : String(top.index);
        stack.push({
          type: ch === "{" ? "obj" : "arr",
          key,
          start: offset + i,
          index: 0,
          expectKey: ch === "{",
        });
      } else if (ch === "}" || ch === "]") {
        const closed = stack.pop();
        const parent = stack.at(-1);
        if (
          closed &&
          parent?.key === "appearance" &&
          stack.length === 2 &&
          isCategory(closed.key)
        ) {
          let value: unknown;
          try {
            value = JSON.parse(text.slice(closed.start, offset + i + 1));
          } catch {
            continue;
          }
          const parsed = appearanceParamsSchema.shape[closed.key].safeParse(value);
          if (parsed.success)
            onPart({ type: "part", category: closed.key, value: parsed.data } as StreamedPart);
        }
      } else if (ch === ",") {
        if (top?.type === "obj") top.expectKey = true;
        else if (top) top.index++;
      }
    }
  };
}

export const encodeEvent = (event: AnalysisStreamEvent) => `${JSON.stringify(event)}\n`;

/** Reads an NDJSON event stream; resolves when it ends. */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AnalysisStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let at: number;
    while ((at = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (line) onEvent(JSON.parse(line) as AnalysisStreamEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AnalysisStreamEvent);
}
