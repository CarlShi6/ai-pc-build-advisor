import { readDraft, writeDraft } from "@/lib/v3/draft-session";
import type { BuildDocumentV3, SlotId } from "@/lib/v3/build-document";
import type { AnalysisStreamEvent, StreamedCategory } from "@/lib/v3/analysis-stream";
import {
  applyFullResult,
  applyStreamedPart,
  endReadingDraft,
  foundLabel,
  readingSlots,
  resumeReadingDraft,
  slotOfCategory,
  startReadingDraft,
} from "@/lib/v3/progressive-draft";
import { clearReadingRetry, saveReadingRetry, type ReadingRetry } from "@/lib/v3/reading-retry";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";

/**
 * The photo being read into Studio. Analyze opens Studio right away; this store keeps reading
 * across the navigation, writes each part into the session draft and tells Studio. One read at a
 * time: a new one, or a draft from elsewhere, stops the old one.
 */
export interface ReadingNotice {
  id: number;
  text: string;
}

export interface ReadingState {
  id: string;
  status: "reading" | "done" | "failed";
  /** Categories drawn so far, in arrival order. */
  found: StreamedCategory[];
  error?: { code: string; message: string };
  notices: ReadingNotice[];
  /** Replays only: the result to report as a fixture load. */
  fixture: boolean;
  /** The full result's analysis id, which the draft carries once the read is done. */
  resultId?: string;
}

/** The read behind this draft, if it is the current one. */
export function readingOf(current: ReadingState | null, analysisId: string | undefined) {
  return current && analysisId && (analysisId === current.id || analysisId === current.resultId)
    ? current
    : null;
}

/** Overall wait for a read, after which it stops as a timeout (the server stops at 75 s). */
export const READING_TIMEOUT_MS = 90_000;

let state: ReadingState | null = null;
let controller: AbortController | null = null;
let noticeId = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function subscribeReading(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const readingState = () => state;

function update(patch: Partial<ReadingState>) {
  if (!state) return;
  state = { ...state, ...patch };
  emit();
}

function notify(text: string) {
  if (!state) return;
  update({ notices: [...state.notices, { id: ++noticeId, text }].slice(-4) });
}

export function dismissNotice(id: number) {
  if (state) update({ notices: state.notices.filter((item) => item.id !== id) });
}

/** Slots still waiting for their part (empty once the read ends, finished or not). */
export function pendingSlots(current: ReadingState | null): SlotId[] {
  if (current?.status !== "reading") return [];
  const found = new Set(current.found.map((category) => slotOfCategory[category]));
  return readingSlots.filter((slot) => !found.has(slot));
}

/** The session draft, only while it is still this read's draft. */
function ownDraft(id: string) {
  const draft = readDraft();
  return draft?.imageContext?.analysisId === id ? draft : null;
}

export type ReadingSource = (
  onEvent: (event: AnalysisStreamEvent) => void,
  signal: AbortSignal,
) => Promise<void>;

/**
 * Starts reading into a new Studio draft, or again into an interrupted one (`resume`).
 * `retry` is kept while reading so a reload can offer to read again. `onResult` reports the
 * full result (analytics). Resolves when the read has ended.
 */
export async function beginReading(
  source: ReadingSource,
  options: {
    fixture?: boolean;
    resume?: BuildDocumentV3;
    retry?: ReadingRetry;
    onResult?: (result: ImageAnalysisResult) => void;
    onFailure?: (code: string) => void;
  } = {},
) {
  controller?.abort();
  const own = new AbortController();
  controller = own;
  const id = `reading-${crypto.randomUUID()}`;
  writeDraft(options.resume ? resumeReadingDraft(options.resume, id) : startReadingDraft(id));
  if (options.retry) saveReadingRetry(id, options.retry);
  else clearReadingRetry();
  state = { id, status: "reading", found: [], notices: [], fixture: !!options.fixture };
  emit();
  const timer = setTimeout(() => own.abort("timeout"), READING_TIMEOUT_MS);
  let ended = false;
  const fail = (code: string, message: string) => {
    if (ended || state?.id !== id) return;
    ended = true;
    clearReadingRetry();
    const draft = ownDraft(id);
    if (draft) writeDraft(endReadingDraft(draft));
    update({ status: "failed", error: { code, message } });
    options.onFailure?.(code);
  };
  const onEvent = (event: AnalysisStreamEvent) => {
    if (ended || state?.id !== id) return;
    const draft = ownDraft(id);
    // The user opened another draft: this read no longer has anywhere to go.
    if (!draft) {
      ended = true;
      own.abort();
      state = null;
      emit();
      return;
    }
    if (event.type === "started") {
      if (event.photo === "unclear" && draft.imageContext)
        writeDraft({ ...draft, imageContext: { ...draft.imageContext, photoUnclear: true } });
    } else if (event.type === "part") {
      writeDraft(applyStreamedPart(draft, event));
      if (!state.found.includes(event.category)) {
        update({ found: [...state.found, event.category] });
        notify(foundLabel[event.category]);
      }
    } else if (event.type === "done") {
      ended = true;
      clearReadingRetry();
      const { document, adjusted } = applyFullResult(draft, event.result);
      writeDraft(document);
      update({ status: "done", resultId: event.result.analysisId });
      if (adjusted.length) notify("Adjusted after full read");
      options.onResult?.(event.result);
    } else if (event.type === "error") fail(event.code, event.message);
  };
  try {
    await source(onEvent, own.signal);
    if (!ended) fail("INVALID_ANALYSIS", "The image analysis was incomplete.");
  } catch {
    if (own.signal.reason === "timeout")
      fail("ANALYSIS_TIMEOUT", "Reading the photo took too long.");
    else if (!own.signal.aborted)
      fail("NETWORK_ERROR", "The connection was lost while reading the photo.");
  } finally {
    clearTimeout(timer);
  }
}

/** Stops the current read (for example when its draft is replaced); drawn parts stay. */
export function stopReading() {
  controller?.abort();
  controller = null;
  state = null;
  emit();
}
