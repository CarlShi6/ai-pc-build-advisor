import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { AlertCircle, ImageUp } from "lucide-react";
import { funnel } from "@/lib/v3/funnel-analytics";
import {
  openImageAnalysisStream,
  prepareImageForAnalysis,
  unavailableCodes,
} from "@/lib/v3/image-client";
import { hasReplay, replayKeyOf } from "@/lib/v3/image-replay";
import { beginReading, type ReadingSource } from "@/lib/v3/live-reading";
import { blobToDataUrl, localFixtureSource, type ReadingRetry } from "@/lib/v3/reading-retry";
import { inspectImage } from "@/lib/v3/image-input";
import { TurnstileCheck } from "@/components/turnstile-check";
import { shortFileName } from "@/lib/v3/file-name";

/** Public Turnstile site key; when set, Analyze waits for the human check. */
const turnstileSiteKey: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;

/** Dev-only sample files with a keyless fixture analysis (`src/lib/v3/dev-image-fixture.ts`). */
const devFixtureNames = [
  "og.png",
  "white-build-sketch.png",
  "white-build-glass-front.png",
  "black-mesh-tower.png",
];

/**
 * Photo → Analyze → Studio. Shared by the home hero and `/start/image`, so both run the same
 * privacy and limit rules. Every check before the provider accepts the photo answers here; once
 * reading starts, Studio opens and draws each part as it is read (live-reading.ts).
 */
export function ImageStartFlow({
  variant = "page",
  onFileChange,
}: {
  variant?: "hero" | "page";
  onFileChange?: (file: File | null) => void;
}) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analysisState, setAnalysisState] = useState<"idle" | "starting" | "error">("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisErrorCode, setAnalysisErrorCode] = useState("");
  const unavailable =
    analysisState === "error" ? (unavailableCodes[analysisErrorCode] ?? null) : null;
  // Turnstile: a fresh token per Analyze, when the human check is configured.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  // Dev only: play a replay twice as fast.
  const [fastReplay, setFastReplay] = useState(false);
  const analysisController = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Dev only: a recorded analysis of this exact photo (see image-replay.ts).
  const [replayKey, setReplayKey] = useState<string | null>(null);
  function updateFile(next: File | null) {
    setFile(next);
    setReplayKey(null);
    onFileChange?.(next);
    if (import.meta.env.DEV && next) void replayKeyOf(next).then((key) => setReplayKey(key));
  }
  const replayable = !!replayKey && hasReplay(replayKey);

  function clearImage() {
    requestNumber.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    updateFile(null);
    setAnalysisState("idle");
    setAnalysisError("");
    setAnalysisErrorCode("");
    setImageError("");
  }

  async function onImageChange(next: File | undefined) {
    clearImage();
    const selectionId = requestNumber.current;
    if (!next) return;
    try {
      inspectImage(new Uint8Array(await next.arrayBuffer()), next.type);
      if (selectionId !== requestNumber.current) return;
      updateFile(next);
    } catch (caught) {
      if (selectionId !== requestNumber.current) return;
      setImageError(caught instanceof Error ? caught.message : "Choose a supported image.");
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void onImageChange(event.dataTransfer.files?.[0]);
  }

  /** Opens Studio and reads into it; Studio shows the parts, failures and the match drawer. */
  function readIntoStudio(source: ReadingSource, fixture: boolean, retry?: ReadingRetry) {
    void beginReading(source, {
      fixture,
      retry,
      onResult: (result) => funnel.imageAnalysisCompleted(result),
      onFailure: (code) => funnel.imageAnalysisFailed({ fixture }, code),
    });
    void navigate({ to: "/studio" });
  }

  async function analyzeImage() {
    if (!file) return;
    const requestId = ++requestNumber.current;
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    setAnalysisError("");
    setAnalysisErrorCode("");
    setAnalysisState("starting");
    funnel.imageSubmitted({ fixture: false });
    try {
      const prepared = await prepareImageForAnalysis(file);
      if (requestId !== requestNumber.current) return;
      const source = await openImageAnalysisStream(
        prepared,
        controller.signal,
        import.meta.env.DEV ? (replayKey ?? undefined) : undefined,
        turnstileToken ?? undefined,
      );
      if (requestId !== requestNumber.current) return;
      // The stream now belongs to Studio; leaving this page must not cancel it.
      analysisController.current = null;
      const dataUrl = await blobToDataUrl(prepared).catch(() => null);
      readIntoStudio(
        source,
        false,
        dataUrl ? { kind: "photo", dataUrl, replayKey: replayKey ?? undefined } : undefined,
      );
    } catch (caught) {
      if (requestId !== requestNumber.current) return;
      const code =
        caught && typeof caught === "object" && "code" in caught && typeof caught.code === "string"
          ? caught.code
          : "UNKNOWN";
      funnel.imageAnalysisFailed({ fixture: false }, code);
      setAnalysisErrorCode(code);
      setAnalysisError(
        caught instanceof Error ? caught.message : "Image analysis failed. Try again.",
      );
      setAnalysisState("error");
    } finally {
      if (turnstileSiteKey) setTurnstileReset((count) => count + 1);
    }
  }

  async function loadLocalFixture() {
    if (!import.meta.env.DEV || !file) return;
    if (!devFixtureNames.includes(file.name) && !replayable) return;
    const requestId = ++requestNumber.current;
    analysisController.current?.abort();
    const speed = fastReplay ? 2 : 1;
    // A recorded real analysis of this photo wins over a name-based fixture.
    const key = replayable ? (replayKey ?? undefined) : undefined;
    const source = await localFixtureSource(file.name, key, speed);
    if (requestId !== requestNumber.current || !source) return;
    funnel.imageSubmitted({ fixture: true });
    readIntoStudio(source, true, { kind: "fixture", fileName: file.name, replayKey: key, speed });
  }

  return (
    <div className={`v3-image-flow v3-image-flow-${variant}`}>
      <label
        className={`v3-upload ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const next = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void onImageChange(next);
          }}
        />
        <ImageUp size={variant === "hero" ? 38 : 29} strokeWidth={1.5} />
        {file ? (
          <span className="v3-upload-file" title={file.name}>
            {shortFileName(file.name)}
          </span>
        ) : (
          <strong>{variant === "hero" ? "Upload a PC photo" : "Choose a PC photo"}</strong>
        )}
        <span>
          {variant === "hero"
            ? "Drop a photo here or click to choose · JPEG, PNG or WebP · up to 10 MB"
            : "JPEG, PNG, or WebP · up to 10 MB · private browser preview"}
        </span>
      </label>
      {imageUrl && (
        <div className="v3-image-preview-wrap">
          <img className="v3-preview-image" src={imageUrl} alt="Selected PC reference preview" />
        </div>
      )}
      {imageError && <p className="v3-error">{imageError}</p>}
      {variant === "hero" ? (
        <details className="v3-privacy-details">
          <summary>
            <AlertCircle size={15} /> Your photo stays private · how analysis works
          </summary>
          <PrivacyNotes />
        </details>
      ) : (
        <PrivacyNotes />
      )}
      {file && (
        <div className="v3-image-actions">
          {unavailable !== "off" && (
            <button
              type="button"
              className={variant === "hero" && !unavailable ? "v3-primary" : "v3-secondary"}
              onClick={() => void analyzeImage()}
              disabled={analysisState === "starting" || (!!turnstileSiteKey && !turnstileToken)}
            >
              {analysisState === "error" ? "Retry analysis" : "Analyze image"}
            </button>
          )}
          <button type="button" className="v3-text-button" onClick={clearImage}>
            Remove image
          </button>
          {import.meta.env.DEV && (devFixtureNames.includes(file.name) || replayable) && (
            <>
              <button
                type="button"
                className="v3-text-button"
                onClick={() => void loadLocalFixture()}
              >
                Load local fixture (no AI call)
              </button>
              <label className="v3-replay-speed">
                <input
                  type="checkbox"
                  checked={fastReplay}
                  onChange={(event) => setFastReplay(event.target.checked)}
                />{" "}
                2× speed
              </label>
            </>
          )}
        </div>
      )}
      {analysisState === "starting" && (
        <p role="status" className="v3-analysis-status">
          Preparing a private, resized copy and starting the read…
        </p>
      )}
      {file && turnstileSiteKey && unavailable !== "off" && (
        <TurnstileCheck
          siteKey={turnstileSiteKey}
          resetKey={turnstileReset}
          onToken={setTurnstileToken}
        />
      )}
      {unavailable ? (
        <div className="v3-paused" role="status" aria-label="Photo reading unavailable">
          <p>{analysisError}</p>
          <p>You can still start without a photo:</p>
          <div className="v3-paused-actions">
            <Link className="v3-primary" to="/start/$mode" params={{ mode: "describe" }}>
              Describe your dream PC
            </Link>
            <Link to="/start/$mode" params={{ mode: "blank" }}>
              Start from scratch (manual)
            </Link>
          </div>
        </div>
      ) : (
        analysisState === "error" && (
          <p className="v3-error" role="alert">
            {analysisError}
            {/manually/i.test(analysisError) ? "" : " You can also continue manually."}
          </p>
        )
      )}
    </div>
  );
}

function PrivacyNotes() {
  return (
    <>
      <p className="v3-inline-note">
        <AlertCircle size={17} /> Analysis is optional. When you click Analyze, a resized copy
        without image metadata is sent to the configured OpenAI service. The original stays in this
        browser tab; AIPC does not save it. Visual findings are estimates, and no hidden hardware is
        identified from the photo.
      </p>
      <p className="v3-inline-note" aria-label="Image retention">
        <AlertCircle size={17} /> Retention: the AIPC server never stores the photo, the resized
        copy or its file name. The copy is sent with OpenAI response storage turned off; OpenAI's
        own data policies still apply. While the photo is read, the resized copy is kept in this tab
        so an interrupted read can run again; it is removed once reading ends. Only the text
        findings stay in this tab's draft, and they are kept with the build if you save it. Each
        browser session can run 3 analyses per minute and 15 per day, and each network 10 per day.{" "}
        <Link to="/privacy">Privacy details</Link>
      </p>
    </>
  );
}
