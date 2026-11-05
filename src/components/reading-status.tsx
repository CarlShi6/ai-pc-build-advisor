import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { dismissNotice, type ReadingState } from "@/lib/v3/live-reading";

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
