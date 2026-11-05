import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ImageCandidateReview } from "@/components/image-candidate-review";
import { AppearanceReview } from "@/components/appearance-review";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import { matchVisualCandidates, type CandidateReview } from "@/lib/v3/candidate-matcher";
import {
  selectedPart,
  slotLabel,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { suggestParts, type ImageReviews, type SuggestedParts } from "@/lib/v3/image-build";
import { analysisOfDraft, applyMatches, setDraftAppearance } from "@/lib/v3/progressive-draft";
import { appearanceValue, setAppearanceField } from "@/lib/v3/appearance-params";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { funnel } from "@/lib/v3/funnel-analytics";

/**
 * The photo review as a Studio drawer (it was a page before Studio): the look as read, AI guesses
 * and legible text, and catalog matches to confirm. Studio works without it; nothing here is
 * applied until the user confirms the change list.
 */
export function PhotoMatchDrawer({
  document,
  onCommit,
  onClose,
}: {
  document: BuildDocumentV3;
  onCommit: (next: BuildDocumentV3) => void;
  onClose: () => void;
}) {
  const analysis = useMemo(() => analysisOfDraft(document), [document]);
  const context = document.imageContext;
  const [reviews, setReviews] = useState<ImageReviews>(() =>
    structuredClone(context?.reviews ?? {}),
  );
  const [suggested, setSuggested] = useState<SuggestedParts | null>(null);
  const [error, setError] = useState("");
  if (!analysis || !context) return null;
  const read = context.appearanceRead ?? context.appearance;
  const userSet = context.appearanceUserSet ?? [];

  function reviewCandidate(category: VisibleCatalogCategory, review: CandidateReview) {
    setReviews((current) => ({ ...current, [category]: review }));
    setSuggested(null);
    funnel.candidateReviewed(category, review);
  }

  function changeAppearance(path: string, value: string) {
    if (!context?.appearance || !read) return;
    const next = setAppearanceField(context.appearance, path, value);
    const set =
      value === appearanceValue(read, path)
        ? userSet.filter((item) => item !== path)
        : [...new Set([...userSet, path])];
    onCommit(setDraftAppearance(document, next, set));
    setSuggested(null);
  }

  function preview(declined: VisibleCatalogCategory[] = []) {
    try {
      setSuggested(suggestParts(analysis!, reviews, null, document, declined, userSet));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The matches could not be previewed.");
    }
  }

  function confirm() {
    if (!suggested) return;
    onCommit(applyMatches(document, suggested));
    funnel.matchGaps(analysis!, suggested.reviews);
    setSuggested(null);
    onClose();
  }

  return (
    <aside
      className="v3-match-drawer"
      role="dialog"
      aria-modal="false"
      aria-label="Match parts to a model"
    >
      <div className="v3-match-drawer-head">
        <div>
          <span className="v3-kicker">AI VISUAL OBSERVATIONS · REVIEW OPTIONAL</span>
          <h2>Match parts to a model</h2>
        </div>
        <button type="button" className="v3-icon-button" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {analysis.summary && <p className="v3-review-summary">{analysis.summary}</p>}
      <p className="v3-review-quality">
        Image quality: {analysis.quality}
        {analysis.observations.length === 0 &&
          " · No reliable visual details were found. Choose parts yourself or try a clearer photo."}
      </p>
      <ImageCandidateReview
        key={analysis.analysisId}
        analysis={analysis}
        reviews={reviews}
        onReviewChange={reviewCandidate}
      />
      {context.appearance && read && (
        <AppearanceReview
          read={read}
          value={context.appearance}
          userSet={userSet}
          corrections={context.appearanceCorrections ?? []}
          onChange={changeAppearance}
        />
      )}
      <section className="v3-image-build" aria-label="Apply matches">
        {suggested ? (
          <SuggestedChanges
            suggested={suggested}
            onConfirm={confirm}
            onToggle={(category, filled) =>
              preview(
                suggested.changes
                  .filter((row) =>
                    row.category === category ? !filled : row.decision === "declined",
                  )
                  .map((row) => row.category),
              )
            }
            onCancel={() => setSuggested(null)}
          />
        ) : (
          <>
            <button className="v3-primary" type="button" onClick={() => preview()}>
              Preview matches
            </button>
            <p className="v3-build-3d-note">
              Uses your choices and fills open parts with the top match. You see every change first;
              parts you already chose in Studio stay.
            </p>
          </>
        )}
        {error && (
          <p className="v3-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </aside>
  );
}

/** The change list behind "Preview matches": nothing is applied until the user confirms. */
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
          Apply to this build
        </button>
        <button className="v3-text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
