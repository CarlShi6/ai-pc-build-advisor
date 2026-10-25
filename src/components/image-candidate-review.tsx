import { useMemo, useState } from "react";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import {
  chooseCandidate,
  emptyCandidateReview,
  excludeCandidate,
  keepCandidateUnknown,
  matchVisualCandidates,
  noteManualModel,
  type CandidateReview,
} from "@/lib/v3/candidate-matcher";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";

const categoryLabels: Record<VisibleCatalogCategory, string> = {
  case: "Case",
  gpu: "GPU",
  cooler: "Cooler",
  fan: "Fans",
  motherboard: "Motherboard",
};

export function ImageCandidateReview({
  analysis,
  onReviewChange,
}: {
  analysis: ImageAnalysisResult;
  onReviewChange?: (category: VisibleCatalogCategory, review: CandidateReview) => void;
}) {
  const sets = useMemo(() => matchVisualCandidates(analysis), [analysis]);
  const [reviews, setReviews] = useState<Partial<Record<VisibleCatalogCategory, CandidateReview>>>(
    {},
  );
  const [manualInputs, setManualInputs] = useState<Partial<Record<VisibleCatalogCategory, string>>>(
    {},
  );
  const [message, setMessage] = useState("");

  function update(category: VisibleCatalogCategory, next: CandidateReview) {
    setReviews((current) => ({ ...current, [category]: next }));
    onReviewChange?.(category, next);
    setMessage("");
  }

  return (
    <section className="v3-candidate-review" aria-label="Catalog candidate review">
      <span className="v3-kicker">CATALOG CANDIDATES · YOUR REVIEW</span>
      <h2>Possible parts, with the evidence beside them</h2>
      <p>
        These are options from the existing local catalog. Choosing one records a planning
        preference on this page only; it does not identify the exact part in the photo or change
        your Build.
      </p>
      {sets.length === 0 && (
        <p>
          No visible part category has enough information for a catalog search. Keep the build
          manual.
        </p>
      )}
      {sets.map((set) => {
        const review = reviews[set.category] ?? emptyCandidateReview();
        const chosen = set.candidates.find((candidate) => candidate.partId === review.chosenPartId);
        return (
          <div className="v3-candidate-set" key={set.category}>
            <div className="v3-candidate-heading">
              <h3>{categoryLabels[set.category]}</h3>
              <small>
                {set.status === "no_catalog_coverage"
                  ? "No catalog coverage"
                  : set.status === "unresolved"
                    ? "Unresolved"
                    : `${set.candidates.length} alternatives`}
              </small>
            </div>
            <p>{set.explanation}</p>
            {chosen && (
              <p className="v3-review-choice">
                Planned option: {chosen.displayName}. Original photo identity remains unverified.
              </p>
            )}
            {review.status === "manual" && (
              <p className="v3-review-choice">
                Manual note: {review.manualText}. This is not a catalog match.
              </p>
            )}
            {set.candidates.map((candidate) => {
              const excluded = review.excludedPartIds.includes(candidate.partId);
              const selected = review.chosenPartId === candidate.partId;
              return (
                <article
                  key={candidate.partId}
                  className={`v3-candidate-card ${selected ? "chosen" : ""} ${excluded ? "excluded" : ""}`}
                >
                  <div>
                    <strong>{candidate.displayName}</strong>
                    <small>
                      {candidate.visualMatchBand} visual match ·{" "}
                      {candidate.identityEvidence === "visible_marking"
                        ? "visible marking"
                        : "appearance only"}{" "}
                      · local catalog
                    </small>
                  </div>
                  <ul>
                    {candidate.matchedSignals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                    {candidate.observationEvidence.map((evidence, index) => (
                      <li key={`${index}:${evidence}`}>Photo evidence: {evidence}</li>
                    ))}
                    {candidate.missingEvidence.map((missing) => (
                      <li key={missing}>{missing}</li>
                    ))}
                  </ul>
                  <p className="v3-candidate-meta">
                    Catalog specs: {candidate.catalogSpecFields} fields · Compatibility: not checked
                    until added to a Build
                  </p>
                  <div className="v3-candidate-actions">
                    <button
                      type="button"
                      disabled={excluded || selected}
                      onClick={() =>
                        update(set.category, chooseCandidate(set, review, candidate.partId))
                      }
                    >
                      {selected
                        ? "Chosen for plan"
                        : review.chosenPartId
                          ? "Choose alternative"
                          : "Confirm planned option"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          set.category,
                          excluded
                            ? {
                                ...review,
                                excludedPartIds: review.excludedPartIds.filter(
                                  (id) => id !== candidate.partId,
                                ),
                              }
                            : excludeCandidate(review, candidate.partId),
                        )
                      }
                    >
                      {excluded ? "Restore" : "Exclude"}
                    </button>
                  </div>
                </article>
              );
            })}
            <div className="v3-review-other">
              <button
                type="button"
                onClick={() => update(set.category, keepCandidateUnknown(review))}
              >
                Keep unknown
              </button>
              <label>
                Enter model manually
                <input
                  value={manualInputs[set.category] ?? ""}
                  maxLength={180}
                  onChange={(event) =>
                    setManualInputs((current) => ({
                      ...current,
                      [set.category]: event.target.value,
                    }))
                  }
                  placeholder="Your own model note"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  try {
                    update(set.category, noteManualModel(review, manualInputs[set.category] ?? ""));
                  } catch {
                    setMessage("Enter a model note before recording it.");
                  }
                }}
              >
                Record note
              </button>
            </div>
          </div>
        );
      })}
      {message && (
        <p className="v3-error" role="alert">
          {message}
        </p>
      )}
      <p className="v3-review-disclosure">
        Review decisions stay on this page until you preview and confirm the Build draft below. You
        can continue manually without applying any image candidate.
      </p>
    </section>
  );
}
