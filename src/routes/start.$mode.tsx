import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  FileText,
  ListChecks,
  Plus,
  AlertCircle,
} from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import {
  createDraft,
  previewPartsList,
  type ImportMatch,
  type SlotId,
} from "@/lib/v3/build-document";
import { writeDraft } from "@/lib/v3/draft-session";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { prepareImageForAnalysis, requestImageAnalysis } from "@/lib/v3/image-client";
import { inspectImage } from "@/lib/v3/image-input";
import {
  confirmImageBuild,
  imageBuildPreviewText,
  proposeImageBuild,
  type ImageBuildProposal,
  type ImageReviews,
} from "@/lib/v3/image-build";
import { readDraft } from "@/lib/v3/draft-session";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import type { CandidateReview } from "@/lib/v3/candidate-matcher";
import { funnel } from "@/lib/v3/funnel-analytics";

export const Route = createFileRoute("/start/$mode")({ component: StartPage });
const modes = ["image", "describe", "import", "blank"] as const;
type Mode = (typeof modes)[number];
const details = {
  image: {
    title: "Build from an image",
    subtitle: "Bring your inspiration. We’ll keep visible details and unknown hardware separate.",
    Icon: Camera,
  },
  describe: {
    title: "Describe your PC",
    subtitle: "Capture your goals, then shape the actual parts in the studio.",
    Icon: FileText,
  },
  import: {
    title: "Import a parts list",
    subtitle: "Check catalog matches before they enter your draft.",
    Icon: ListChecks,
  },
  blank: {
    title: "Start with a blank build",
    subtitle: "Eight clear slots. You decide what goes in each one.",
    Icon: Plus,
  },
};

function StartPage() {
  const { mode: routeMode } = Route.useParams();
  const mode = modes.includes(routeMode as Mode) ? (routeMode as Mode) : "blank";
  const { title, subtitle, Icon } = details[mode];
  const navigate = useNavigate();
  const [budget, setBudget] = useState("2500");
  const [description, setDescription] = useState("");
  const [useCase, setUseCase] = useState("");
  const [list, setList] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [analysisState, setAnalysisState] = useState<
    "idle" | "preparing" | "analyzing" | "ready" | "error"
  >("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [reviews, setReviews] = useState<ImageReviews>({});
  const [imageProposal, setImageProposal] = useState<ImageBuildProposal | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const [error, setError] = useState("");
  const matches = useMemo(() => previewPartsList(list), [list]);

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

  function clearImage() {
    requestNumber.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setFile(null);
    setAnalysis(null);
    setAnalysisState("idle");
    setAnalysisError("");
    setReviews({});
    setImageProposal(null);
    setImageError("");
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

  function reviewCandidate(category: VisibleCatalogCategory, review: CandidateReview) {
    setReviews((current) => ({ ...current, [category]: review }));
    setImageProposal(null);
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

  async function loadLocalFixture() {
    if (!import.meta.env.DEV || file?.name !== "og.png") return;
    const requestId = ++requestNumber.current;
    analysisController.current?.abort();
    const { createOgImageFixture } = await import("@/lib/v3/dev-image-fixture");
    if (requestId !== requestNumber.current) return;
    const fixture = createOgImageFixture();
    funnel.imageSubmitted({ fixture: true });
    setAnalysis(fixture);
    setAnalysisState("ready");
    funnel.imageAnalysisCompleted(fixture);
    setAnalysisError("");
    setReviews({});
    setImageProposal(null);
  }

  function begin() {
    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setError("Enter a valid budget of $0 or more.");
      return;
    }
    if (mode === "describe" && !description.trim() && !useCase.trim()) {
      setError("Add a goal or a short description to continue.");
      return;
    }
    if (mode === "import" && !list.trim()) {
      setError("Paste at least one part before continuing.");
      return;
    }
    if (mode === "image" && !file) {
      setError("Choose an image to preview, or start blank instead.");
      return;
    }
    const selected =
      mode === "import"
        ? matches
            .filter(
              (item): item is ImportMatch & { part: NonNullable<ImportMatch["part"]> } =>
                !!item.part,
            )
            .map((item) => item.part)
        : [];
    const chosen = [...new Map(selected.map((part) => [part.category, part])).values()];
    const draft = createDraft(mode, {
      name:
        mode === "describe"
          ? "Description draft"
          : mode === "import"
            ? "Imported parts draft"
            : mode === "image"
              ? "Reference photo draft"
              : "Untitled build",
      budget: parsedBudget,
      useCases: useCase.trim() ? [useCase.trim()] : [],
      sourceInput: mode === "import" ? list : mode === "describe" ? description : undefined,
      parts: chosen,
      unresolved: mode === "import" ? unresolvedBySlot(matches) : {},
    });
    writeDraft(draft);
    funnel.draftCreated(draft);
    void navigate({ to: "/studio" });
  }

  async function onImageChange(next: File | undefined) {
    clearImage();
    const selectionId = requestNumber.current;
    setError("");
    if (!next) return;
    try {
      inspectImage(new Uint8Array(await next.arrayBuffer()), next.type);
      if (selectionId !== requestNumber.current) return;
      setFile(next);
    } catch (caught) {
      if (selectionId !== requestNumber.current) return;
      setImageError(caught instanceof Error ? caught.message : "Choose a supported image.");
    }
  }

  return (
    <V3Shell>
      <main className="v3-page">
        <Link className="v3-back" to="/">
          <ArrowLeft size={16} /> All starting points
        </Link>
        <div className="v3-page-intro">
          <span className="v3-icon">
            <Icon size={25} />
          </span>
          <span className="v3-kicker">NEW BUILD / {mode.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="v3-form-layout">
          <section className="v3-form-card">
            {mode === "image" && (
              <>
                <label className="v3-upload">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const next = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void onImageChange(next);
                    }}
                  />
                  <Camera size={29} />
                  <strong>{file ? file.name : "Choose a PC photo"}</strong>
                  <span>JPEG, PNG, or WebP · up to 10 MB · private browser preview</span>
                </label>
                {imageUrl && (
                  <div className="v3-image-preview-wrap">
                    <img
                      className="v3-preview-image"
                      src={imageUrl}
                      alt="Selected PC reference preview"
                    />
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
                <p className="v3-inline-note">
                  <AlertCircle size={17} /> Analysis is optional. When you click Analyze, a resized
                  copy without image metadata is sent to the configured OpenAI service. The original
                  stays in this browser tab; AIPC does not save it. Visual findings are estimates,
                  and no hidden hardware is identified from the photo.
                </p>
                {file && (
                  <div className="v3-image-actions">
                    <button
                      type="button"
                      className="v3-secondary"
                      onClick={() => void analyzeImage()}
                      disabled={analysisState === "preparing" || analysisState === "analyzing"}
                    >
                      {analysisState === "error" ? "Retry analysis" : "Analyze image"}
                    </button>
                    <button type="button" className="v3-text-button" onClick={clearImage}>
                      Remove image
                    </button>
                    {import.meta.env.DEV && file.name === "og.png" && (
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
                      {analysis.qualityIssues.length
                        ? ` · ${analysis.qualityIssues.join(", ")}`
                        : ""}
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
                      <p>
                        No reliable visual details were found. Continue manually or try a clearer
                        photo.
                      </p>
                    )}
                    <p>
                      Exact identity remains unknown until you review catalog candidates. Hidden
                      CPU, storage, and power supply cannot be identified from this image.
                    </p>
                  </section>
                )}
                {analysis && (
                  <ImageCandidateReview
                    key={analysis.analysisId}
                    analysis={analysis}
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
                    <button className="v3-secondary" type="button" onClick={previewImageBuild}>
                      Preview Build draft
                    </button>
                    {imageProposal && (
                      <div className="v3-image-build-preview">
                        <h3>Full draft preview · not applied</h3>
                        <ul>
                          {imageBuildPreviewText(imageProposal).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                        <p>
                          Seed catalog total: $
                          {imageProposal.candidate.build.totalPrice.toLocaleString()} · Rule
                          findings: {imageProposal.candidate.build.compatibilityWarnings.length} ·
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
              </>
            )}
            {mode === "describe" && (
              <>
                <label className="v3-field">
                  What will you use it for?
                  <input
                    value={useCase}
                    onChange={(event) => setUseCase(event.target.value)}
                    placeholder="Gaming, video editing, local AI…"
                  />
                </label>
                <label className="v3-field">
                  Describe the build you want
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="I want a quiet white PC for 1440p gaming…"
                  />
                </label>
                <p className="v3-inline-note">
                  Your description is saved with the draft. Part choices remain yours until
                  recommendation analysis is connected.
                </p>
              </>
            )}
            {mode === "import" && (
              <>
                <label className="v3-field">
                  Paste one part per line
                  <textarea
                    rows={9}
                    value={list}
                    onChange={(event) => setList(event.target.value)}
                    placeholder="Intel Core i7-14700K&#10;Corsair RM850x…"
                  />
                </label>
                {matches.length > 0 && (
                  <div className="v3-import-preview">
                    <strong>Review before creating</strong>
                    {matches.map((match, index) => (
                      <div key={`${index}-${match.line}`}>
                        <span>{match.line}</span>
                        <small className={match.status}>
                          {match.status === "matched"
                            ? `Catalog match · ${match.part?.displayName}`
                            : match.status === "ambiguous"
                              ? "Needs review"
                              : "Unknown · kept in original list"}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
                <p className="v3-inline-note">
                  Only exact single catalog matches enter slots. Unknown lines stay in the original
                  text for review.
                </p>
              </>
            )}
            {mode === "blank" && (
              <div className="v3-blank-message">
                <Plus size={30} />
                <h2>A clear place to begin.</h2>
                <p>
                  Your draft opens with case, motherboard, CPU, cooler, GPU, memory, storage, and
                  power supply slots. Nothing is selected for you.
                </p>
              </div>
            )}
            <label className="v3-field">
              Target budget (USD)
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(event) => {
                  setBudget(event.target.value);
                  setImageProposal(null);
                }}
              />
            </label>
            {error && (
              <p className="v3-error" role="alert">
                {error}
              </p>
            )}
            <div className="v3-form-actions">
              <button className="v3-primary" type="button" onClick={begin}>
                {mode === "import"
                  ? "Create reviewed draft"
                  : mode === "image"
                    ? "Continue manually"
                    : "Create draft"}
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
          <aside className="v3-aside">
            <span className="v3-kicker">WHAT HAPPENS NEXT</span>
            <h2>Your Build Studio</h2>
            <p>
              Each part has a clear status. You can add, replace, or remove catalog parts and review
              compatibility as the plan takes shape.
            </p>
            <div>
              <span>01</span> Create a draft
            </div>
            <div>
              <span>02</span> Choose actual parts
            </div>
            <div>
              <span>03</span> Check the whole build
            </div>
            <Link to="/legacy-workspace">
              Need the current workspace? <span aria-hidden="true">↗</span>
            </Link>
          </aside>
        </div>
      </main>
    </V3Shell>
  );
}

function unresolvedBySlot(matches: ImportMatch[]): Partial<Record<SlotId, string>> {
  const result: Partial<Record<SlotId, string>> = {};
  for (const match of matches) {
    if (match.status === "matched") continue;
    const text = match.line.toLowerCase();
    const slot: SlotId | undefined =
      text.includes("gpu") || text.includes("graphics")
        ? "gpu"
        : text.includes("cpu") || text.includes("processor")
          ? "cpu"
          : text.includes("motherboard")
            ? "motherboard"
            : text.includes("memory") || text.includes("ram")
              ? "memory"
              : text.includes("ssd") || text.includes("storage")
                ? "storage"
                : text.includes("psu") || text.includes("power supply")
                  ? "psu"
                  : text.includes("cooler")
                    ? "cooler"
                    : text.includes("case")
                      ? "case"
                      : undefined;
    if (slot) result[slot] = match.line;
  }
  return result;
}
