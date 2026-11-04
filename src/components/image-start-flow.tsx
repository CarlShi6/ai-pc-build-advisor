import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { AlertCircle, ImageUp } from "lucide-react";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import type { CandidateReview } from "@/lib/v3/candidate-matcher";
import { slotLabel } from "@/lib/v3/build-document";
import { readDraft, writeDraft } from "@/lib/v3/draft-session";
import { funnel } from "@/lib/v3/funnel-analytics";
import {
  confirmImageBuild,
  suggestParts,
  type ImageReviews,
  type SuggestedParts,
} from "@/lib/v3/image-build";
import { observationGroup, type ObservationGroup } from "@/lib/v3/observation-tags";
import { prepareImageForAnalysis, requestImageAnalysis } from "@/lib/v3/image-client";
import { hasReplay, loadReplay, replayKeyOf } from "@/lib/v3/image-replay";
import { AppearanceReview } from "@/components/appearance-review";
import { AnalysisWait } from "@/components/analysis-wait";
import {
  appearanceValue,
  setAppearanceField,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { inspectImage } from "@/lib/v3/image-input";
import { TurnstileCheck } from "@/components/turnstile-check";
import { shortFileName } from "@/lib/v3/file-name";

/** Public Turnstile site key; when set, Analyze waits for the human check. */
const turnstileSiteKey: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;

/**
 * Errors where photo reading is unavailable, so Describe becomes the main way on. "off": a retry
 * cannot help (not configured, or the daily cap), so Retry is hidden; "later": rate limited, so
 * Retry stays as a secondary button.
 */
const unavailableCodes: Record<string, "off" | "later"> = {
  IMAGE_AI_NOT_CONFIGURED: "off",
  DAILY_CAP_REACHED: "off",
  DAILY_CAP_UNAVAILABLE: "off",
  SESSION_RATE_LIMITED: "later",
  RATE_LIMITED: "later",
};

/** Dev-only sample files with a keyless fixture analysis (`src/lib/v3/dev-image-fixture.ts`). */
const devFixtureNames = [
  "og.png",
  "white-build-sketch.png",
  "white-build-glass-front.png",
  "black-mesh-tower.png",
];

/**
 * Photo → observations → part review → "Build it in 3D" change list → confirm. Shared by the home hero and
 * `/start/image`, so both run the same privacy, limit and confirmation rules.
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
  const [suggested, setSuggested] = useState<SuggestedParts | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [analysisState, setAnalysisState] = useState<
    "idle" | "preparing" | "analyzing" | "ready" | "error"
  >("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisErrorCode, setAnalysisErrorCode] = useState("");
  const unavailable =
    analysisState === "error" ? (unavailableCodes[analysisErrorCode] ?? null) : null;
  // Turnstile: a fresh token per Analyze, when the human check is configured.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [reviews, setReviews] = useState<ImageReviews>({});
  // Step A: the look as the user corrects it (null until the analysis has one), and which fields.
  const [appearance, setAppearance] = useState<AppearanceParams | null>(null);
  const [appearanceUserSet, setAppearanceUserSet] = useState<string[]>([]);
  function showAnalysis(result: ImageAnalysisResult | null) {
    setAnalysis(result);
    setAppearance(result?.appearance ?? null);
    setAppearanceUserSet([]);
  }
  function changeAppearance(path: string, value: string) {
    if (!appearance || !analysis?.appearance) return;
    setAppearance(setAppearanceField(appearance, path, value));
    const read = appearanceValue(analysis.appearance, path);
    setAppearanceUserSet((current) =>
      value === read ? current.filter((item) => item !== path) : [...new Set([...current, path])],
    );
    setSuggested(null);
  }
  const [activeGroup, setActiveGroup] = useState<ObservationGroup | null>(null);
  const [error, setError] = useState("");
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

  useEffect(() => () => analysisController.current?.abort(), []);

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
    showAnalysis(null);
    setAnalysisState("idle");
    setAnalysisError("");
    setAnalysisErrorCode("");
    setReviews({});
    setSuggested(null);
    setImageError("");
    setError("");
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

  async function analyzeImage() {
    if (!file) return;
    const requestId = ++requestNumber.current;
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    showAnalysis(null);
    setReviews({});
    setSuggested(null);
    setAnalysisError("");
    setAnalysisErrorCode("");
    setAnalysisState("preparing");
    funnel.imageSubmitted({ fixture: false });
    try {
      const prepared = await prepareImageForAnalysis(file);
      if (requestId !== requestNumber.current) return;
      setAnalysisState("analyzing");
      const result = await requestImageAnalysis(
        prepared,
        controller.signal,
        import.meta.env.DEV ? (replayKey ?? undefined) : undefined,
        turnstileToken ?? undefined,
      );
      if (requestId !== requestNumber.current) return;
      showAnalysis(result);
      setAnalysisState("ready");
      funnel.imageAnalysisCompleted(result);
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
    const { devImageFixtures } = await import("@/lib/v3/dev-image-fixture");
    // A recorded real analysis of this photo wins over a name-based fixture.
    const fixture =
      (replayable && replayKey ? await loadReplay(replayKey) : null) ??
      devImageFixtures[file.name]?.();
    if (requestId !== requestNumber.current || !fixture) return;
    funnel.imageSubmitted({ fixture: true });
    showAnalysis(fixture);
    setAnalysisState("ready");
    funnel.imageAnalysisCompleted(fixture);
    setAnalysisError("");
    setAnalysisErrorCode("");
    setReviews({});
    setSuggested(null);
  }

  function reviewCandidate(category: VisibleCatalogCategory, review: CandidateReview) {
    setReviews((current) => ({ ...current, [category]: review }));
    setSuggested(null);
    funnel.candidateReviewed(category, review);
  }

  /** `declined`: filled-in rows the user unticked in the change list; they stay unconfirmed. */
  function previewSuggestedParts(declined: VisibleCatalogCategory[] = []) {
    if (!analysis) return;
    try {
      // Photo drafts carry no target budget (budget-aware photo optimization is deferred).
      const looked = appearance ? { ...analysis, appearance } : analysis;
      setSuggested(
        suggestParts(
          looked,
          reviews,
          null,
          readDraft(),
          declined,
          appearance ? appearanceUserSet : [],
        ),
      );
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The suggested parts could not be previewed.",
      );
    }
  }

  function confirmSuggestedParts() {
    if (!suggested) return;
    try {
      const draft = confirmImageBuild(suggested.proposal, readDraft());
      setReviews(suggested.reviews);
      for (const [category, review] of Object.entries(suggested.reviews))
        if (review && review !== reviews[category as VisibleCatalogCategory])
          funnel.candidateReviewed(category as VisibleCatalogCategory, review);
      writeDraft(draft);
      if (analysis) funnel.matchGaps(analysis, suggested.reviews);
      funnel.draftCreated(draft);
      void navigate({ to: "/studio" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The image draft changed. Preview it again.",
      );
      setSuggested(null);
    }
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
      {imageUrl && !analysis && (
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
              disabled={
                analysisState === "preparing" ||
                analysisState === "analyzing" ||
                (!!turnstileSiteKey && !turnstileToken)
              }
            >
              {analysisState === "error" ? "Retry analysis" : "Analyze image"}
            </button>
          )}
          <button type="button" className="v3-text-button" onClick={clearImage}>
            Remove image
          </button>
          {import.meta.env.DEV && (devFixtureNames.includes(file.name) || replayable) && (
            <button
              type="button"
              className="v3-text-button"
              onClick={() => void loadLocalFixture()}
            >
              Load local fixture (no AI call)
            </button>
          )}
        </div>
      )}
      {analysisState === "preparing" && (
        <p role="status" className="v3-analysis-status">
          Preparing a private, resized copy…
        </p>
      )}
      {analysisState === "analyzing" && <AnalysisWait />}
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
      {analysis && (
        <div className="v3-review-layout">
          <aside className="v3-review-photo" aria-label="Image observations">
            {imageUrl && (
              <div className="v3-image-preview-wrap">
                <img
                  className="v3-preview-image"
                  src={imageUrl}
                  alt="Selected PC reference preview"
                />
                {analysis.observations
                  .filter((item) => item.region && item.visibleInImage)
                  .map((item) => (
                    <span
                      key={item.id}
                      className={`v3-evidence-region ${activeGroup === observationGroup(item) ? "active" : ""}`}
                      data-group={observationGroup(item)}
                      title={`${item.category}: ${item.evidence}`}
                      style={{
                        left: `${item.region!.x * 100}%`,
                        top: `${item.region!.y * 100}%`,
                        width: `${item.region!.width * 100}%`,
                        height: `${item.region!.height * 100}%`,
                      }}
                    />
                  ))}
              </div>
            )}
            <span className="v3-kicker">
              {analysis.provider === "fixture"
                ? "LOCAL TEST FIXTURE · NO AI CALL"
                : "AI VISUAL OBSERVATIONS · REVIEW REQUIRED"}
            </span>
            <p className="v3-review-summary">{analysis.summary}</p>
            <p className="v3-review-quality">
              Image quality: {analysis.quality}
              {analysis.qualityIssues.length ? ` · ${analysis.qualityIssues.join(", ")}` : ""}
              {analysis.observations.length === 0 &&
                " · No reliable visual details were found. Choose parts yourself or try a clearer photo."}
            </p>
          </aside>
          <div className="v3-review-parts">
            <ImageCandidateReview
              key={analysis.analysisId}
              analysis={analysis}
              reviews={reviews}
              onReviewChange={reviewCandidate}
              onActiveGroup={setActiveGroup}
            />
            {appearance && analysis.appearance && (
              <AppearanceReview
                read={analysis.appearance}
                value={appearance}
                userSet={appearanceUserSet}
                corrections={analysis.appearanceCorrections ?? []}
                onChange={changeAppearance}
              />
            )}
            <section className="v3-image-build" aria-label="Image to Build preview">
              {!suggested && (
                <>
                  <button
                    className="v3-primary v3-build-3d"
                    type="button"
                    onClick={() => previewSuggestedParts()}
                  >
                    Build it in 3D
                  </button>
                  <p className="v3-build-3d-note">
                    Uses your choices and fills open parts with the top match. You see every change
                    first; nothing is applied until you confirm. The photo itself is not saved.
                  </p>
                </>
              )}
              {suggested && (
                <SuggestedChanges
                  suggested={suggested}
                  onConfirm={confirmSuggestedParts}
                  onToggle={(category, filled) =>
                    previewSuggestedParts(
                      suggested.changes
                        .filter((row) =>
                          row.category === category ? !filled : row.decision === "declined",
                        )
                        .map((row) => row.category),
                    )
                  }
                  onCancel={() => setSuggested(null)}
                />
              )}
              {error && (
                <p className="v3-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </div>
        </div>
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
        <AlertCircle size={17} /> Retention: AIPC never stores the photo, the resized copy or its
        file name. The copy is sent with OpenAI response storage turned off; OpenAI's own data
        policies still apply. Only the text findings stay in this tab's draft, and they are kept
        with the build if you save it. Each browser session can run 3 analyses per minute and 15 per
        day. <Link to="/privacy">Privacy details</Link>
      </p>
    </>
  );
}

/** The change list behind "Build it in 3D": nothing is applied until the user confirms. */
function SuggestedChanges({
  suggested,
  onConfirm,
  onToggle,
  onCancel,
}: {
  suggested: SuggestedParts;
  onConfirm: () => void;
  /** Tick or untick a filled-in top match; an unticked slot stays unconfirmed. */
  onToggle: (category: VisibleCatalogCategory, filled: boolean) => void;
  onCancel: () => void;
}) {
  const { changes, total, compatibility, proposal } = suggested;
  return (
    <div className="v3-suggested-changes" role="region" aria-label="Suggested parts preview">
      <h3>Your Build · preview, not applied</h3>
      <p>
        Your choices, with the top match filled in where you left a part open. Every row is a
        planning choice you can change in the Studio.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Slot</th>
            <th scope="col">Becomes</th>
            <th scope="col">Price</th>
            <th scope="col">Appearance</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr
              key={change.category}
              data-category={change.category}
              data-decision={change.decision}
            >
              <th scope="row">
                {change.decision === "suggested" || change.decision === "declined" ? (
                  <label className="v3-fill-toggle">
                    <input
                      type="checkbox"
                      checked={change.decision === "suggested"}
                      onChange={(event) => onToggle(change.category, event.target.checked)}
                      aria-label={`Fill in ${change.label} with ${change.partName}`}
                    />
                    {change.label}
                  </label>
                ) : (
                  change.label
                )}
              </th>
              <td>
                {change.partName ? (
                  <>
                    <strong>{change.partName}</strong>
                    <small>
                      {change.decision === "yours"
                        ? "Your choice"
                        : change.decision === "declined"
                          ? "Top match, not filled in"
                          : "Top match, filled in"}{" "}
                      · {change.match}
                    </small>
                  </>
                ) : change.equallyLikely.length ? (
                  <>
                    <strong>{change.match}</strong>
                    <small>
                      {change.equallyLikely.join(" · ")}. Choose one above; nothing is picked by
                      name.
                    </small>
                  </>
                ) : (
                  <strong>
                    {change.decision === "kept"
                      ? "Kept unknown"
                      : change.decision === "note"
                        ? "Your note, stays open"
                        : "Stays unresolved"}
                  </strong>
                )}
              </td>
              <td>{change.price}</td>
              <td>{change.appearance}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="v3-suggested-summary">
        <div>
          <dt>Total</dt>
          <dd>
            ${total.known.toLocaleString()}
            {total.unknown > 0 &&
              ` + ${total.unknown} unknown price${total.unknown === 1 ? "" : "s"}, not counted`}
          </dd>
        </div>
        <div>
          <dt>Compatibility</dt>
          <dd>{compatibility}</dd>
        </div>
        <div>
          <dt>Still open</dt>
          <dd>
            {proposal.remaining.length
              ? `${proposal.remaining.map((slot) => slotLabel[slot]).join(", ")}: not identified from the photo, choose in Studio`
              : "Nothing"}
          </dd>
        </div>
      </dl>
      {proposal.visualWarnings.length > 0 && (
        <ul className="v3-image-build-warnings">
          {proposal.visualWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <div className="v3-image-build-actions">
        <button className="v3-primary" type="button" onClick={onConfirm}>
          Confirm and open Build Studio
        </button>
        <button className="v3-text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
