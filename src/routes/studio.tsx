import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  PackagePlus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import {
  catalogForSlot,
  completeness,
  fromSavedBuild,
  primarySlots,
  selectedPart,
  setVisualPriorityLock,
  slotLabel,
  slotOccupancy,
  toSavedBuildPayload,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import {
  confirmPartRemoval,
  confirmPartSelection,
  proposePartRemoval,
  proposePartSelection,
  type PartRemovalProposal,
} from "@/lib/v3/build-proposal";
import { readDraft, writeDraft } from "@/lib/v3/draft-session";
import { ApiClientError, getSavedBuild, saveCurrentBuild } from "@/lib/apiClient";
import { SAVE_CONFLICT_CODE } from "@/lib/persistence/save-version";
import { funnel } from "@/lib/v3/funnel-analytics";
import type { Part } from "@/types/parts";
import type { BuildSceneProps, SceneMode } from "@/features/build-3d/BuildScene";
import { SceneBoundary } from "@/features/build-3d/SceneBoundary";
import { ShoppingPlanPanel } from "@/components/shopping-plan-panel";
import { PartReplaceCard } from "@/components/part-replace-card";
import { SlotGrid2D } from "@/components/slot-grid-2d";
import {
  confirmWithLockOverride,
  lockConflicts,
  optimizationResult,
  traitImpacts,
  type BalanceWeight,
  type OptimizationIntent,
  type OptimizationOption,
} from "@/lib/v3/visual-optimization";

const intentLabels: Array<[OptimizationIntent, string]> = [
  ["preserve_look", "Preserve the look"],
  ["reduce_cost", "Reduce cost"],
  ["improve_performance", "Improve performance"],
  ["balanced", "Balanced"],
];
const balanceLabels: Array<[BalanceWeight, string]> = [
  [0.25, "Favor savings"],
  [0.5, "Even"],
  [0.75, "Favor performance"],
];
import { getValidatedOfficialUrl } from "@/lib/product-trust";
import { priceCoverage, priceUnknown } from "@/lib/v3/catalog";
import { DISCLOSURE_NOTE, sceneDisclosure } from "@/lib/v3/scene-disclosure";

/** Signed price change, or "Unknown" when either price is unknown (unknown is never $0). */
function priceChangeText(delta: number, candidate: Part, current: Part | undefined) {
  if (priceUnknown(candidate) || (current && priceUnknown(current))) return "Unknown";
  return `${delta < 0 ? "−" : "+"}$${Math.abs(delta).toLocaleString()}`;
}

/** A manufacturer page when the catalog has one; otherwise the existing retailer search, labeled as such. */
function partLinkFor(part: Part | undefined) {
  if (!part) return null;
  const official = getValidatedOfficialUrl(part);
  if (official) return { href: official, label: "Manufacturer page" };
  if (!part.searchUrl) return null;
  return {
    href: part.searchUrl,
    label: `Search ${new URL(part.searchUrl).hostname.replace(/^www./, "")}`,
  };
}

export const Route = createFileRoute("/studio")({ component: StudioPage });

function StudioPage() {
  const [document, setDocument] = useState<BuildDocumentV3 | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotId>("case");
  const [candidate, setCandidate] = useState<Part | null>(null);
  const [optimizationIntent, setOptimizationIntent] = useState<OptimizationIntent>("preserve_look");
  const [balanceWeight, setBalanceWeight] = useState<BalanceWeight>(0.5);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [optimizationCandidate, setOptimizationCandidate] = useState<OptimizationOption | null>(
    null,
  );
  const [removalProposal, setRemovalProposal] = useState<PartRemovalProposal | null>(null);
  const [Scene, setScene] = useState<ComponentType<BuildSceneProps> | null>(null);
  const [sceneAvailable, setSceneAvailable] = useState(true);
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [mode, setMode] = useState<SceneMode>("standard");
  const [explode, setExplode] = useState(55);
  const [resetKey, setResetKey] = useState(0);
  const [sidePanelRemoved, setSidePanelRemoved] = useState(false);
  const [focusSlot, setFocusSlot] = useState<SlotId | null>(null);
  const clearFocus = useCallback(() => setFocusSlot(null), []);
  const [saving, setSaving] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saveConflict, setSaveConflict] = useState(false);
  useEffect(() => {
    const draft = readDraft();
    setDocument(draft);
    if (draft?.savedBuildId) setSavedRevision(draft.revision);
  }, []);
  useEffect(() => {
    if (view !== "3d") return;
    let active = true;
    const canvas = window.document.createElement("canvas");
    try {
      if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) {
        setSceneAvailable(false);
        return;
      }
    } catch {
      setSceneAvailable(false);
      return;
    }
    void import("@/features/build-3d/BuildScene")
      .then((module) => {
        if (active) setScene(() => module.default);
      })
      .catch(() => {
        if (active) setSceneAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [view]);
  async function saveDraft(current: BuildDocumentV3) {
    setSaving(true);
    setSaveError("");
    setSaveConflict(false);
    try {
      const response = await saveCurrentBuild({
        id: current.savedBuildId,
        name: current.build.name,
        build: toSavedBuildPayload(current),
        buildNeeds: { budget: current.build.budget, targetUseCase: current.build.targetUseCase },
        expectedUpdatedAt: current.savedBuildId ? current.savedVersion : undefined,
      });
      const next = {
        ...current,
        savedBuildId: response.savedBuild.id,
        savedVersion: response.savedBuild.updatedAt,
      };
      writeDraft(next);
      setDocument(next);
      setSavedRevision(next.revision);
      funnel.buildSaved(next, !current.savedBuildId);
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.code === SAVE_CONFLICT_CODE) {
        setSaveConflict(true);
        funnel.buildSaveConflict(current);
      }
      setSaveError(failure instanceof Error ? failure.message : "This build could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  /** Conflict resolution: either replace this tab's draft with the newer save, or overwrite it. */
  async function resolveSaveConflict(current: BuildDocumentV3, keep: "saved" | "this_tab") {
    if (!current.savedBuildId) return;
    setSaving(true);
    try {
      const latest = await getSavedBuild(current.savedBuildId);
      if (keep === "this_tab") {
        setSaving(false);
        await saveDraft({ ...current, savedVersion: latest.updatedAt });
        return;
      }
      const restored = fromSavedBuild(latest);
      if (!restored) throw new Error("The saved version could not be read.");
      commit(restored);
      setSavedRevision(restored.revision);
      setSaveConflict(false);
      setSaveError("");
    } catch (failure) {
      setSaveError(
        failure instanceof Error ? failure.message : "The saved version could not be loaded.",
      );
    } finally {
      setSaving(false);
    }
  }
  function commit(next: BuildDocumentV3) {
    writeDraft(next);
    setDocument(next);
    setCandidate(null);
    setOptimizationCandidate(null);
    setRemovalProposal(null);
  }
  if (!document)
    return (
      <V3Shell>
        <main className="v3-page v3-empty-page">
          <span className="v3-kicker">BUILD STUDIO</span>
          <h1>Your next build starts here.</h1>
          <p>Choose a starting point to create an editable draft.</p>
          <Link className="v3-primary" to="/start/$mode" params={{ mode: "blank" }}>
            Start blank <ArrowRight size={17} />
          </Link>
        </main>
      </V3Shell>
    );
  const status = completeness(document);
  const current = selectedPart(document, selectedSlot);
  const proposal = candidate ? proposePartSelection(document, selectedSlot, candidate) : null;
  const preview = proposal?.candidate ?? null;
  const previewStatus = preview ? completeness(preview) : null;
  // One short line: every slot under the kind of geometry it is drawn with.
  const disclosure = (
    <p className="v3-scene-disclosure">
      {sceneDisclosure(document).map((group) => (
        <span key={group.kind} data-kind={group.kind}>
          <strong>{group.label}:</strong> {group.items.join(", ")}
        </span>
      ))}
      <span>{DISCLOSURE_NOTE}</span>
    </p>
  );
  const show3D = view === "3d" && sceneAvailable;
  // One replace card for both views: beside the focused part in 3D, under the grid in 2D.
  const replaceCard = focusSlot ? (
    <PartReplaceCard
      key={`${focusSlot}-${document.revision}`}
      document={document}
      slot={focusSlot}
      link={partLinkFor(selectedPart(document, focusSlot))}
      onCommit={commit}
      onClose={clearFocus}
    />
  ) : null;
  const prices = priceCoverage(document.build.parts);
  const optimization =
    document.imageContext && current
      ? optimizationResult(document, selectedSlot, optimizationIntent, balanceWeight)
      : null;
  const options = optimization?.options ?? [];
  const candidateImpacts = candidate ? traitImpacts(document, selectedSlot, candidate) : [];
  const candidateConflicts = candidate ? lockConflicts(document, selectedSlot, candidate) : [];
  const overrideAccepted = !!candidate && overrideFor === candidate.id;
  return (
    <V3Shell>
      <main className="v3-page v3-studio">
        <div className="v3-studio-header">
          <div>
            <span className="v3-kicker">BUILD STUDIO / INTERACTIVE WORKSPACE</span>
            <h1>{document.build.name}</h1>
            <p>
              {document.source === "image"
                ? "Reference-photo draft · source image is not stored in this Build"
                : document.source === "import"
                  ? "Imported parts draft · unmatched lines need review"
                  : document.source === "describe"
                    ? "Description draft · choose hardware below"
                    : document.source === "legacy"
                      ? "Opened from an existing saved build"
                      : document.source === "sample"
                        ? "Sample build · white parts from manufacturer pages; motherboard, CPU and SSD are seed parts. Swap anything; nothing is saved until you save."
                        : "Blank build draft"}
            </p>
          </div>
          <div className="v3-studio-actions">
            <span className="v3-save-status" role="status">
              {saveError
                ? saveError
                : saving
                  ? "Saving…"
                  : savedRevision === document.revision
                    ? "Saved to My Builds"
                    : document.savedBuildId
                      ? "Unsaved changes"
                      : "Not saved yet"}
            </span>
            <button
              type="button"
              className="v3-primary"
              disabled={saving || savedRevision === document.revision}
              onClick={() => void saveDraft(document)}
            >
              <Save size={16} /> {document.savedBuildId ? "Save changes" : "Save build"}
            </button>
            {saveConflict && (
              <div className="v3-save-conflict" role="group" aria-label="Resolve save conflict">
                <button
                  type="button"
                  className="v3-secondary"
                  disabled={saving}
                  onClick={() => void resolveSaveConflict(document, "saved")}
                >
                  Open saved version
                </button>
                <button
                  type="button"
                  className="v3-secondary"
                  disabled={saving}
                  onClick={() => void resolveSaveConflict(document, "this_tab")}
                >
                  Overwrite with this tab
                </button>
              </div>
            )}
            <Link className="v3-secondary" to="/">
              Start another build <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <section className="v3-scene-panel" aria-label="Build visualization">
          <div className="v3-scene-toolbar">
            <div>
              <span className="v3-kicker">YOUR BUILD, IN SPACE</span>
              <strong>{show3D ? "Illustrative layout" : "2D layout"}</strong>
            </div>
            <div className="v3-scene-controls">
              <button
                type="button"
                className={show3D ? "active" : ""}
                onClick={() => setView("3d")}
                disabled={!sceneAvailable}
                title={sceneAvailable ? undefined : "3D needs WebGL, which is off in this browser"}
              >
                3D view
              </button>
              <button
                type="button"
                className={show3D ? "" : "active"}
                onClick={() => setView("2d")}
              >
                2D view
              </button>
            </div>
          </div>
          {show3D ? (
            <>
              {Scene ? (
                <SceneBoundary onFallback={() => setView("2d")}>
                  <Scene
                    document={document}
                    selectedSlot={selectedSlot}
                    mode={mode}
                    explode={explode}
                    resetKey={resetKey}
                    onSelect={(slot) => {
                      setSelectedSlot(slot);
                      setCandidate(null);
                      setOptimizationCandidate(null);
                      setRemovalProposal(null);
                    }}
                    focusSlot={focusSlot}
                    onFocus={setFocusSlot}
                    onClearFocus={clearFocus}
                    partLink={(slot) => partLinkFor(selectedPart(document, slot))}
                    focusCard={replaceCard}
                    sidePanelRemoved={sidePanelRemoved}
                  />
                </SceneBoundary>
              ) : (
                <div className="v3-scene-loading">Loading interactive scene…</div>
              )}
              {/* Controls and the disclosure stack at the bottom: a wrapped line pushes the
                  controls up instead of running off the panel. */}
              <div className="v3-scene-bottom">
                <div className="v3-scene-footer">
                  <div className="v3-scene-controls">
                    {(["standard", "exploded", "review"] as const).map((next) => (
                      <button
                        type="button"
                        key={next}
                        className={mode === next ? "active" : ""}
                        onClick={() => setMode(next)}
                      >
                        {next[0].toUpperCase() + next.slice(1)}
                      </button>
                    ))}
                  </div>
                  {mode === "exploded" && (
                    <label>
                      Explode{" "}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={explode}
                        onChange={(event) => setExplode(Number(event.target.value))}
                      />{" "}
                      {explode}%
                    </label>
                  )}
                  <label className="v3-scene-toggle">
                    <input
                      type="checkbox"
                      checked={sidePanelRemoved}
                      onChange={(event) => setSidePanelRemoved(event.target.checked)}
                    />{" "}
                    Remove side panel
                  </label>
                  <button type="button" onClick={() => setResetKey((value) => value + 1)}>
                    Reset camera
                  </button>
                </div>
                {disclosure}
              </div>
            </>
          ) : (
            <div className="v3-scene-2d">
              <p>
                {sceneAvailable
                  ? "Choose a slot to inspect or swap its part."
                  : "3D needs WebGL, which is off in this browser. Every build action works here in 2D."}
              </p>
              <SlotGrid2D
                document={document}
                selectedSlot={selectedSlot}
                focusSlot={focusSlot}
                focusCard={replaceCard}
                onPick={(slot) => {
                  setSelectedSlot(slot);
                  setCandidate(null);
                  setOptimizationCandidate(null);
                  setRemovalProposal(null);
                  setFocusSlot((current) => (current === slot ? null : slot));
                }}
              />
              {disclosure}
            </div>
          )}
        </section>
        {document.imageContext && (
          <section className="v3-image-priorities" aria-label="Photo inspiration">
            <div>
              <span className="v3-kicker">PHOTO INSPIRATION · IMAGE NOT STORED</span>
              <h2>Keep the visible look in view</h2>
              <p>
                These observations describe appearance, not exact hardware identity or dimensions.
                Lock a trait to keep matching catalog alternatives within its known metadata.
              </p>
            </div>
            <div className="v3-priority-list">
              {document.imageContext.visualPriorities.map((priority) => (
                <label key={priority.id}>
                  <input
                    type="checkbox"
                    checked={priority.locked}
                    onChange={(event) =>
                      commit(setVisualPriorityLock(document, priority.id, event.target.checked))
                    }
                  />
                  <span>
                    <strong>{priority.category.replaceAll("_", " ")}</strong>
                    {priority.value}
                  </span>
                </label>
              ))}
              {!document.imageContext.visualPriorities.length && (
                <p>No reliable appearance traits were recorded.</p>
              )}
            </div>
          </section>
        )}
        <div className="v3-stats">
          <div>
            <small>SELECTED PARTS</small>
            <strong>
              {status.selected}
              <span> / 8</span>
            </strong>
          </div>
          <div>
            <small>UNRESOLVED</small>
            <strong>{status.unresolved}</strong>
          </div>
          <div>
            <small>CATALOG TOTAL</small>
            <strong>${prices.known.toLocaleString()}</strong>
            <em>
              {prices.unknown
                ? `+ ${prices.unknown} unknown price${prices.unknown === 1 ? "" : "s"}, not counted`
                : "Seed or manufacturer prices, not live offers"}
            </em>
          </div>
          <div>
            <small>COMPATIBILITY</small>
            <strong>{status.complete ? document.build.compatibilityStatus : "Incomplete"}</strong>
            <em>
              {status.complete
                ? `${document.build.compatibilityWarnings.length} findings to review`
                : `${status.missing + status.unresolved} slots still need decisions`}
            </em>
          </div>
        </div>
        <div className="v3-studio-layout">
          <section className="v3-slot-panel">
            <div className="v3-panel-heading">
              <div>
                <span className="v3-kicker">YOUR BUILD</span>
                <h2>Eight essential slots</h2>
              </div>
              <span>{status.selected} selected</span>
            </div>
            <div className="v3-slot-list">
              {primarySlots.map((slot, index) => {
                const part = selectedPart(document, slot);
                const occupancy = slotOccupancy(document, slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`v3-slot ${selectedSlot === slot ? "active" : ""}`}
                    onClick={() => {
                      setSelectedSlot(slot);
                      setCandidate(null);
                      setOptimizationCandidate(null);
                      setRemovalProposal(null);
                    }}
                  >
                    <span className="v3-slot-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="v3-slot-main">
                      <strong>{slotLabel[slot]}</strong>
                      <small>
                        {part?.displayName ??
                          document.unresolved[slot] ??
                          (occupancy === "unresolved" ? "Needs review" : "No part selected")}
                      </small>
                    </span>
                    <span className={`v3-slot-status ${occupancy}`}>
                      {occupancy === "selected"
                        ? "Selected"
                        : occupancy === "unresolved"
                          ? "Review"
                          : "Add part"}
                    </span>
                    <ChevronDown size={17} className="v3-slot-chevron" />
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="v3-detail-panel">
            <div className="v3-panel-heading">
              <div>
                <span className="v3-kicker">SLOT DETAIL</span>
                <h2>{slotLabel[selectedSlot]}</h2>
              </div>
            </div>
            {current && (
              <div className="v3-current-part">
                <small>CURRENT CHOICE</small>
                <h3>{current.displayName}</h3>
                <p>
                  {current.brand} · {current.model}
                </p>
                <span>${current.price.toLocaleString()} seed catalog price</span>
                {document.imageContext?.plannedSelections[selectedSlot] && (
                  <span>
                    Planned selection ·{" "}
                    {document.imageContext.plannedSelections[selectedSlot]?.origin ===
                    "image_review"
                      ? "chosen from image candidates"
                      : "changed in Build Studio"}
                    ; photo identity remains unverified.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRemovalProposal(proposePartRemoval(document, selectedSlot));
                    setCandidate(null);
                  }}
                >
                  <X size={15} /> Remove part
                </button>
              </div>
            )}
            {!current && (
              <div className="v3-current-part muted">
                <PackagePlus size={26} />
                <h3>
                  {document.unresolved[selectedSlot] ? "Identity unresolved" : "This slot is open"}
                </h3>
                <p>
                  {document.unresolved[selectedSlot] ??
                    "Choose a catalog part to start a build decision."}
                </p>
              </div>
            )}
            {document.imageContext && current && (
              <section className="v3-optimization" aria-label="Style-preserving alternatives">
                <span className="v3-kicker">STYLE-AWARE OPTIONS</span>
                <h3>Explore a replacement</h3>
                <div className="v3-optimization-intents" role="group" aria-label="Goal">
                  {intentLabels.map(([intent, label]) => (
                    <button
                      key={intent}
                      type="button"
                      aria-pressed={optimizationIntent === intent}
                      className={optimizationIntent === intent ? "active" : ""}
                      onClick={() => {
                        setOptimizationIntent(intent);
                        setOptimizationCandidate(null);
                        setCandidate(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {optimizationIntent === "balanced" && (
                  <div
                    className="v3-optimization-intents v3-balance"
                    role="group"
                    aria-label="Balance between savings and performance"
                  >
                    {balanceLabels.map(([weight, label]) => (
                      <button
                        key={weight}
                        type="button"
                        aria-pressed={balanceWeight === weight}
                        className={balanceWeight === weight ? "active" : ""}
                        onClick={() => {
                          setBalanceWeight(weight);
                          setOptimizationCandidate(null);
                          setCandidate(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {options.length ? (
                  options.map((option) => (
                    <button
                      className="v3-optimization-option"
                      type="button"
                      key={option.part.id}
                      onClick={() => {
                        setCandidate(option.part);
                        setOptimizationCandidate(option);
                        setRemovalProposal(null);
                      }}
                    >
                      <strong>{option.part.displayName}</strong>
                      <small>
                        {priceChangeText(option.proposal.priceDelta, option.part, current)} seed
                        price · {option.proposal.compatibilityAfter} rule status
                      </small>
                      {option.traitImpacts.length > 0 && (
                        <small>
                          {option.traitImpacts
                            .map((impact) => `${impact.label}: ${impact.outcome}`)
                            .join(" · ")}
                        </small>
                      )}
                    </button>
                  ))
                ) : (
                  <p>{optimization?.emptyReason}</p>
                )}
              </section>
            )}
            <label className="v3-field">
              {current ? "Compare with another part" : "Choose a catalog part"}
              <select
                value={candidate?.id ?? ""}
                onChange={(event) => {
                  setRemovalProposal(null);
                  setOptimizationCandidate(null);
                  setCandidate(
                    catalogForSlot(selectedSlot).find((part) => part.id === event.target.value) ??
                      null,
                  );
                }}
              >
                <option value="">Select a part…</option>
                {catalogForSlot(selectedSlot).map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.displayName}
                  </option>
                ))}
              </select>
            </label>
            {removalProposal && (
              <div className="v3-proposal">
                <span className="v3-kicker">REMOVAL PREVIEW · NOT APPLIED</span>
                <h3>Remove {current?.displayName}</h3>
                <div>
                  <span>Seed total change</span>
                  <strong>${removalProposal.priceDelta.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Selected slots after</span>
                  <strong>{completeness(removalProposal.candidate).selected} / 8</strong>
                </div>
                <p>This slot will become empty and the draft will be incomplete.</p>
                <button
                  className="v3-primary"
                  type="button"
                  onClick={() => commit(confirmPartRemoval(document, removalProposal))}
                >
                  Confirm removal
                </button>
                <button
                  className="v3-text-button"
                  type="button"
                  onClick={() => setRemovalProposal(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            {candidate && preview && proposal && (
              <div className="v3-proposal">
                <span className="v3-kicker">PREVIEW · NOT APPLIED</span>
                <h3>{candidate.displayName}</h3>
                <div>
                  <span>Price difference</span>
                  <strong>{priceChangeText(proposal.priceDelta, candidate, current)}</strong>
                </div>
                <div>
                  <span>New seed total</span>
                  <strong>
                    ${preview.build.totalPrice.toLocaleString()}
                    {priceCoverage(preview.build.parts).unknown > 0 &&
                      ` + ${priceCoverage(preview.build.parts).unknown} unknown`}
                  </strong>
                </div>
                <div>
                  <span>Selected slots</span>
                  <strong>{previewStatus?.selected} / 8</strong>
                </div>
                <div>
                  <span>Rule findings</span>
                  <strong>{preview.build.compatibilityWarnings.length}</strong>
                </div>
                <p>
                  Preview uses available catalog specs. Missing parts and dimensions still need
                  review.
                </p>
                {candidateImpacts.length > 0 && optimizationCandidate?.part.id !== candidate.id && (
                  <div className="v3-optimization-impact">
                    <p>
                      <strong>Visual:</strong>{" "}
                      {candidateImpacts
                        .map(
                          (impact) =>
                            `${impact.label} ${impact.outcome}${impact.locked ? " (locked)" : ""}`,
                        )
                        .join("; ")}
                      . Based on catalog color and style fields, not a visual comparison.
                    </p>
                  </div>
                )}
                {candidateConflicts.length > 0 && (
                  <div className="v3-lock-override" role="alert">
                    <p>
                      <strong>This changes your locked look:</strong>{" "}
                      {candidateConflicts.map((impact) => impact.label).join(", ")}.
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={overrideAccepted}
                        onChange={(event) =>
                          setOverrideFor(event.target.checked ? candidate.id : null)
                        }
                      />
                      Change the locked look anyway. This unlocks{" "}
                      {candidateConflicts.length === 1 ? "that trait" : "those traits"}.
                    </label>
                  </div>
                )}
                {optimizationCandidate?.part.id === candidate.id && (
                  <div className="v3-optimization-impact">
                    <p>
                      <strong>Visual:</strong> {optimizationCandidate.visualImpact}
                    </p>
                    <p>
                      <strong>Performance:</strong> {optimizationCandidate.performanceEvidence}
                    </p>
                    <p>
                      <strong>Physical fit:</strong> Exact dimensions and clearance require review.
                    </p>
                  </div>
                )}
                <button
                  className="v3-primary"
                  type="button"
                  disabled={candidateConflicts.length > 0 && !overrideAccepted}
                  onClick={() =>
                    commit(
                      candidateConflicts.length
                        ? confirmWithLockOverride(
                            document,
                            proposal,
                            candidateConflicts.map((impact) => impact.priorityId),
                          )
                        : confirmPartSelection(document, proposal),
                    )
                  }
                >
                  <Check size={17} />{" "}
                  {candidateConflicts.length ? "Confirm and unlock" : "Confirm selection"}
                </button>
                <button className="v3-text-button" type="button" onClick={() => setCandidate(null)}>
                  Cancel preview
                </button>
              </div>
            )}
          </aside>
        </div>
        <ShoppingPlanPanel
          document={document}
          onSelectSlot={(slot) => {
            setSelectedSlot(slot);
            setCandidate(null);
            setOptimizationCandidate(null);
            setRemovalProposal(null);
            window.document
              .querySelector(".v3-detail-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <section className="v3-studio-bottom">
          <div>
            <CircleAlert size={19} />
            <p>
              <strong>Draft status:</strong>{" "}
              {status.complete
                ? "All eight slots have a part. Review rule findings and verify current prices before buying."
                : "This is a partial build. Compatibility results do not mean missing parts or physical fit are approved."}
            </p>
          </div>
          <div>
            <RotateCcw size={17} />
            <p>
              Draft changes stay in this browser tab until you save. Saving keeps open and
              unresolved slots as they are; it does not store the reference photo.
            </p>
          </div>
        </section>
        {document.sourceInput && (
          <details className="v3-source-details">
            <summary>
              Original {document.source === "import" ? "parts list" : "description"}
            </summary>
            <pre>{document.sourceInput}</pre>
          </details>
        )}
      </main>
    </V3Shell>
  );
}
