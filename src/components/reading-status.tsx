import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { beginReading, dismissNotice, type ReadingState } from "@/lib/v3/live-reading";
import type { BuildDocumentV3 } from "@/lib/v3/build-document";
import { openImageAnalysisStream, unavailableCodes } from "@/lib/v3/image-client";
import {
  dataUrlToBlob,
  loadReadingRetry,
  localFixtureSource,
  type ReadingRetry,
} from "@/lib/v3/reading-retry";
import { funnel } from "@/lib/v3/funnel-analytics";
import { TurnstileCheck } from "@/components/turnstile-check";

/** Public Turnstile site key; when set, reading again waits for the human check. */
const turnstileSiteKey: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const NOTICE_MS = 3_500;

/**
 * Studio's line about the photo being read: what is still being read, short notices as parts are
 * found (they fade on their own and never block), and what to do if reading stops.
 */
export function ReadingStatus({
  reading,
  onDismissFailure,
}: {
  reading: ReadingState;
  onDismissFailure: () => void;
}) {
  const notices = reading.notices;
  // Each notice stays NOTICE_MS from when it is first on screen (Studio may still be loading
  // when a part is found), on its own clock.
  const shownAt = useRef(new Map<number, number>());
  useEffect(() => {
    const now = performance.now();
    const timers = notices.map((notice) => {
      if (!shownAt.current.has(notice.id)) shownAt.current.set(notice.id, now);
      const left = shownAt.current.get(notice.id)! + NOTICE_MS - now;
      return setTimeout(() => dismissNotice(notice.id), Math.max(0, left));
    });
    return () => timers.forEach(clearTimeout);
  }, [notices]);
  return (
    <>
      {reading.status === "reading" && (
        <p className="v3-reading-line" role="status" aria-label="Reading the photo">
          <span className="v3-reading-dot" aria-hidden />
          Reading your photo · parts appear as they are found. You can turn, zoom and choose parts
          meanwhile; what you choose stays.
        </p>
      )}
      {reading.status === "failed" && (
        <div
          className="v3-paused v3-reading-failed"
          role="alert"
          aria-label="Photo reading stopped"
        >
          <p>
            <strong>Photo reading stopped.</strong> {reading.error?.message}
          </p>
          <p>
            {reading.found.length
              ? "The parts found so far stay. Choose the rest yourself, or start from a description."
              : "Choose the parts yourself, or start from a description."}
          </p>
          <div className="v3-paused-actions">
            <Link className="v3-primary" to="/start/$mode" params={{ mode: "describe" }}>
              Describe your dream PC
            </Link>
            <button type="button" className="v3-text-button" onClick={onDismissFailure}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <ul className="v3-reading-notices" aria-live="polite">
        {notices.map((notice) => (
          <li key={notice.id}>{notice.text}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * A draft whose read stopped with the page (a reload, or the tab was closed and restored). Drawn
 * parts stay, the other slots are ordinary manual slots, and the photo can be read again: that
 * request goes through the same limits, daily cap and human check as Analyze.
 */
export function InterruptedReading({
  document,
  onDismiss,
}: {
  document: BuildDocumentV3;
  onDismiss: () => void;
}) {
  const analysisId = document.imageContext?.analysisId ?? "";
  const [retry] = useState<ReadingRetry | null>(() => loadReadingRetry(analysisId));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const needsCheck = !!turnstileSiteKey && retry?.kind === "photo";
  const off = error ? unavailableCodes[error.code] === "off" : false;

  async function readAgain() {
    if (!retry) return;
    setStarting(true);
    setError(null);
    const fixture = retry.kind === "fixture";
    funnel.imageSubmitted({ fixture });
    try {
      const source =
        retry.kind === "fixture"
          ? await localFixtureSource(retry.fileName, retry.replayKey, retry.speed)
          : await openImageAnalysisStream(
              dataUrlToBlob(retry.dataUrl),
              undefined,
              import.meta.env.DEV ? retry.replayKey : undefined,
              turnstileToken ?? undefined,
            );
      if (!source)
        throw Object.assign(new Error("This sample has no local fixture."), { code: "" });
      void beginReading(source, {
        fixture,
        resume: document,
        retry,
        onResult: (result) => funnel.imageAnalysisCompleted(result),
        onFailure: (code) => funnel.imageAnalysisFailed({ fixture }, code),
      });
    } catch (caught) {
      const code =
        caught && typeof caught === "object" && "code" in caught && typeof caught.code === "string"
          ? caught.code
          : "UNKNOWN";
      funnel.imageAnalysisFailed({ fixture }, code);
      setError({
        code,
        message: caught instanceof Error ? caught.message : "The photo could not be read again.",
      });
      setStarting(false);
      if (needsCheck) setTurnstileReset((count) => count + 1);
    }
  }

  return (
    <div className="v3-paused v3-reading-failed" role="alert" aria-label="Reading was interrupted">
      <p>
        <strong>Reading was interrupted.</strong> The page was reloaded before the photo was fully
        read.
      </p>
      <p>
        {document.build.parts.length || Object.keys(document.unresolved).length
          ? "What was drawn stays. Choose the rest yourself, read the photo again, or start from a description."
          : "Choose the parts yourself, read the photo again, or start from a description."}
      </p>
      {error && <p className="v3-error">{error.message}</p>}
      <div className="v3-paused-actions">
        <Link className="v3-primary" to="/start/$mode" params={{ mode: "describe" }}>
          Describe your dream PC
        </Link>
        {retry && !off ? (
          <button
            type="button"
            className="v3-secondary"
            disabled={starting || (needsCheck && !turnstileToken)}
            onClick={() => void readAgain()}
          >
            {starting ? "Starting the read…" : "Read the photo again"}
          </button>
        ) : (
          !retry && (
            <Link className="v3-secondary" to="/start/$mode" params={{ mode: "image" }}>
              Choose the photo again
            </Link>
          )
        )}
        <button type="button" className="v3-text-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      {needsCheck && !off && (
        <TurnstileCheck
          siteKey={turnstileSiteKey!}
          resetKey={turnstileReset}
          onToken={setTurnstileToken}
        />
      )}
    </div>
  );
}
