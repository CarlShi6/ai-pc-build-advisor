import { useNavigate } from "@tanstack/react-router";
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
  imageBuildPreviewText,
  proposeImageBuild,
  suggestParts,
  type ImageBuildProposal,
  type ImageReviews,
  type SuggestedParts,
} from "@/lib/v3/image-build";
import { prepareImageForAnalysis, requestImageAnalysis } from "@/lib/v3/image-client";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { inspectImage } from "@/lib/v3/image-input";

/** Dev-only sample files with a keyless fixture analysis (`src/lib/v3/dev-image-fixture.ts`). */
const devFixtureNames = ["og.png", "white-build-sketch.png", "white-build-glass-front.png"];

/**
 * Photo → observations → candidate review → Build preview → confirm. Shared by the home hero and
 * `/start/image`, so both run the same privacy, limit and confirmation rules.
 */
export function ImageStartFlow({
  variant = "page",
  budget: budgetProp,
  onFileChange,
}: {
  variant?: "hero" | "page";
  /** Budget from the host page; the flow keeps its own when omitted. */
  budget?: string;
  onFileChange?: (file: File | null) => void;
}) {
  const navigate = useNavigate();
  const [ownBudget, setOwnBudget] = useState("2500");
  const budget = budgetProp ?? ownBudget;
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
  const [reviews, setReviews] = useState<ImageReviews>({});
  const [imageProposal, setImageProposal] = useState<ImageBuildProposal | null>(null);
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

  function updateFile(next: File | null) {
    setFile(next);
    onFileChange?.(next);
  }

  function clearImage() {
    requestNumber.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    updateFile(null);
    setAnalysis(null);
    setAnalysisState("idle");
    setAnalysisError("");
    setReviews({});
    setImageProposal(null);
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
    setAnalysis(null);
    setReviews({});
    setImageProposal(null);
    setSuggested(null);
    setAnalysisError("");
    setAnalysisState("preparing");
    funnel.imageSubmitted({ fixture: false });
    try {
      const prepared = await prepareImageForAnalysis(file);
      if (requestId !== requestNumber.current) return;
      setAnalysisState("analyzing");
      const result = await requestImageAnalysis(prepared, controller.signal);
      if (requestId !== requestNumber.current) return;
      setAnalysis(result);
      setAnalysisState("ready");
      funnel.imageAnalysisCompleted(result);
    } catch (caught) {
      if (requestId !== requestNumber.current) return;
      funnel.imageAnalysisFailed(
        { fixture: false },
        caught && typeof caught === "object" && "code" in caught && typeof caught.code === "string"
          ? caught.code
          : "UNKNOWN",
      );
      setAnalysisError(
        caught instanceof Error ? caught.message : "Image analysis failed. Try again.",
      );
      setAnalysisState("error");
    }
  }

  async function loadLocalFixture() {
    if (!import.meta.env.DEV || !file || !devFixtureNames.includes(file.name)) return;
    const requestId = ++requestNumber.current;
    analysisController.current?.abort();
    const { devImageFixtures } = await import("@/lib/v3/dev-image-fixture");
    if (requestId !== requestNumber.current) return;
    const fixture = devImageFixtures[file.name]();
    funnel.imageSubmitted({ fixture: true });
    setAnalysis(fixture);
    setAnalysisState("ready");
    funnel.imageAnalysisCompleted(fixture);
    setAnalysisError("");
    setReviews({});
    setImageProposal(null);
    setSuggested(null);
  }

  function reviewCandidate(category: VisibleCatalogCategory, review: CandidateReview) {
    setReviews((current) => ({ ...current, [category]: review }));
    setImageProposal(null);
    setSuggested(null);
    funnel.candidateReviewed(category, review);
  }

  function previewImageBuild() {
    if (!analysis) return;
    try {
      setImageProposal(proposeImageBuild(analysis, reviews, Number(budget), readDraft()));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The image draft could not be previewed.",
      );
    }
  }

  function previewSuggestedParts() {
    if (!analysis) return;
    try {
      setSuggested(suggestParts(analysis, reviews, Number(budget), readDraft()));
      setImageProposal(null);
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
      funnel.draftCreated(draft);
      void navigate({ to: "/studio" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The image draft changed. Preview it again.",
      );
      setSuggested(null);
    }
  }

  function confirmImageDraft() {
    if (!imageProposal) return;
    try {
      const draft = confirmImageBuild(imageProposal, readDraft());
      writeDraft(draft);
      funnel.draftCreated(draft);
      void navigate({ to: "/studio" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The image draft changed. Preview it again.",
      );
      setImageProposal(null);
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
        <strong>
          {file ? file.name : variant === "hero" ? "Upload a PC photo" : "Choose a PC photo"}
        </strong>
        <span>
          {variant === "hero"
            ? "Drop a photo here or click to choose · JPEG, PNG or WebP · up to 10 MB"
            : "JPEG, PNG, or WebP · up to 10 MB · private browser preview"}
        </span>
      </label>
      {imageUrl && (
        <div className="v3-image-preview-wrap">
          <img className="v3-preview-image" src={imageUrl} alt="Selected PC reference preview" />
          {analysis?.observations
            .filter((item) => item.region && item.visibleInImage)
            .map((item) => (
              <span
                key={item.id}
                className="v3-evidence-region"
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
          <button
            type="button"
            className={variant === "hero" ? "v3-primary" : "v3-secondary"}
            onClick={() => void analyzeImage()}
            disabled={analysisState === "preparing" || analysisState === "analyzing"}
          >
            {analysisState === "error" ? "Retry analysis" : "Analyze image"}
          </button>
          <button type="button" className="v3-text-button" onClick={clearImage}>
            Remove image
          </button>
          {import.meta.env.DEV && devFixtureNames.includes(file.name) && (
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
      {(analysisState === "preparing" || analysisState === "analyzing") && (
        <p role="status" className="v3-analysis-status">
          {analysisState === "preparing"
            ? "Preparing a private, resized copy…"
            : "Analyzing visible details…"}
        </p>
      )}
      {analysisState === "error" && (
        <p className="v3-error" role="alert">
          {analysisError} You can retry or continue manually.
        </p>
      )}
      {analysis && (
        <section className="v3-observations" aria-label="Image observations">
          <span className="v3-kicker">
            {analysis.provider === "fixture"
              ? "LOCAL TEST FIXTURE · NO AI CALL"
              : "AI VISUAL OBSERVATIONS · REVIEW REQUIRED"}
          </span>
          <h2>{analysis.summary}</h2>
          <p>
            Image quality: {analysis.quality}
            {analysis.qualityIssues.length ? ` · ${analysis.qualityIssues.join(", ")}` : ""}
          </p>
          {analysis.observations.length ? (
            analysis.observations.map((item) => (
              <article key={item.id}>
                <strong>
                  {item.category} · {item.attribute}: {item.value}
                </strong>
                <small>
                  {item.origin} · {item.confidenceBand} confidence
                </small>
                <p>{item.evidence}</p>
              </article>
            ))
          ) : (
            <p>No reliable visual details were found. Continue manually or try a clearer photo.</p>
          )}
          <p>
            Exact identity remains unknown until you review catalog candidates. Hidden CPU, storage,
            and power supply cannot be identified from this image.
          </p>
        </section>
      )}
      {analysis && (
        <ImageCandidateReview
          key={analysis.analysisId}
          analysis={analysis}
          reviews={reviews}
          onReviewChange={reviewCandidate}
        />
      )}
      {analysis && (
        <section className="v3-image-build" aria-label="Image to Build preview">
          <span className="v3-kicker">IMAGE → BUILD · EXPLICIT CONFIRMATION</span>
          <h2>Turn your reviewed choices into a Build</h2>
          <p>
            Only candidates you chose become planned parts. Other visible identities stay
            unresolved; hidden hardware remains unselected. The source image is not saved.
          </p>
          {budgetProp === undefined && (
            <label className="v3-field v3-inline-budget">
              Target budget (USD)
              <input
                type="number"
                min="0"
                value={ownBudget}
                onChange={(event) => {
                  setOwnBudget(event.target.value);
                  setImageProposal(null);
                  setSuggested(null);
                }}
              />
            </label>
          )}
          <div className="v3-image-build-actions">
            <button className="v3-primary" type="button" onClick={previewSuggestedParts}>
              Use suggested parts
            </button>
            <button className="v3-secondary" type="button" onClick={previewImageBuild}>
              Preview Build draft
            </button>
          </div>
          {suggested && (
            <SuggestedChanges
              suggested={suggested}
              onConfirm={confirmSuggestedParts}
              onCancel={() => setSuggested(null)}
            />
          )}
          {error && (
            <p className="v3-error" role="alert">
              {error}
            </p>
          )}
          {imageProposal && (
            <div className="v3-image-build-preview">
              <h3>Full draft preview · not applied</h3>
              <ul>
                {imageBuildPreviewText(imageProposal).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>
                Seed catalog total: ${imageProposal.candidate.build.totalPrice.toLocaleString()} ·
                Rule findings: {imageProposal.candidate.build.compatibilityWarnings.length} ·
                Incomplete until required slots are reviewed.
              </p>
              {imageProposal.visualWarnings.length > 0 && (
                <div className="v3-image-build-warnings">
                  <strong>Appearance differences to review</strong>
                  <ul>
                    {imageProposal.visualWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="v3-primary" type="button" onClick={confirmImageDraft}>
                Confirm and open Build Studio
              </button>
              <button
                className="v3-text-button"
                type="button"
                onClick={() => setImageProposal(null)}
              >
                Cancel preview
              </button>
            </div>
          )}
        </section>
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
        day.
      </p>
    </>
  );
}

/** The change list for "Use suggested parts": nothing is applied until the user confirms. */
function SuggestedChanges({
  suggested,
  onConfirm,
  onCancel,
}: {
  suggested: SuggestedParts;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { changes, total, compatibility, proposal } = suggested;
  return (
    <div className="v3-suggested-changes" role="region" aria-label="Suggested parts preview">
      <h3>Suggested parts · preview, not applied</h3>
      <p>
        The top-ranked catalog option in each category. A photo can show what a part looks like, not
        its exact model, so every row is a planning choice you can change in Studio.
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
            <tr key={change.category} data-category={change.category}>
              <th scope="row">{change.label}</th>
              <td>
                {change.partName ? (
                  <>
                    <strong>{change.partName}</strong>
                    <small>{change.match}</small>
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
                  <strong>Stays unresolved</strong>
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
          Confirm suggested parts and open Build Studio
        </button>
        <button className="v3-text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
