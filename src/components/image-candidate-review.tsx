import { useMemo, useState } from "react";
import type { ImageAnalysisResult, VisualObservation } from "@/lib/v3/image-contract";
import {
  chooseCandidate,
  emptyCandidateReview,
  equallyLikelyCandidates,
  excludeCandidate,
  keepCandidateUnknown,
  matchVisualCandidates,
  noteManualModel,
  type AppearanceCandidate,
  type CandidateReview,
  type CandidateSet,
} from "@/lib/v3/candidate-matcher";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import { catalogPartById, colorSourceNote, priceUnknown } from "@/lib/v3/catalog";
import { candidateMatchLabel, type ImageReviews } from "@/lib/v3/image-build";
import {
  observationGroup,
  observationTagLine,
  type ObservationGroup,
} from "@/lib/v3/observation-tags";
import { catalogMatchesForGuess } from "@/lib/v3/model-guess";
import { ModelGuesses } from "@/components/model-guesses";
import { allowedExternalUrl, externalLinkProps } from "@/lib/v3/external-links";

const categoryLabels: Record<VisibleCatalogCategory, string> = {
  case: "Case",
  gpu: "GPU",
  cooler: "Cooler",
  fan: "Fans",
  motherboard: "Motherboard",
  memory: "Memory",
};

/** Memory has no observations (it is read in the appearance parameters), so no tag group. */
const tagGroup = (category: VisibleCatalogCategory): ObservationGroup | null =>
  category === "memory" ? null : category;

type CardState = "yours" | "suggested" | "tie" | "kept" | "note" | "absent" | "none";

const stateLabels: Record<CardState, string> = {
  yours: "Your choice",
  suggested: "Top match",
  tie: "Choose one",
  kept: "Kept unknown",
  note: "Your note",
  absent: "Not in photo",
  none: "No catalog match",
};

/**
 * The right-hand column of the photo review (PRD §4.3): one card per visible part with a tag line
 * of what the photo shows, the top catalog option and one "Use this" button. Other options sit in a
 * fold; exclude, keep unknown and a manual note sit in a secondary menu.
 */
export function ImageCandidateReview({
  analysis,
  reviews = {},
  onReviewChange,
  onActiveGroup,
}: {
  analysis: ImageAnalysisResult;
  /** Owned by the host flow, so "Build it in 3D" and the cards share one review state. */
  reviews?: ImageReviews;
  onReviewChange?: (category: VisibleCatalogCategory, review: CandidateReview) => void;
  /** Hover / focus on a card, so the photo can outline that part's regions. */
  onActiveGroup?: (group: ObservationGroup | null) => void;
}) {
  const sets = useMemo(() => matchVisualCandidates(analysis), [analysis]);
  const [message, setMessage] = useState("");
  const look = observationTagLine(analysis.observations, "look");
  const guesses = useMemo(() => analysis.modelGuesses ?? [], [analysis]);
  // Catalog parts an AI guess names: highlighted where they are offered, never chosen for the user.
  const guessed = useMemo(
    () => new Set(guesses.flatMap((guess) => catalogMatchesForGuess(guess).map((part) => part.id))),
    [guesses],
  );
  const shown = useMemo(
    () => new Set(sets.flatMap((set) => set.candidates.map((candidate) => candidate.partId))),
    [sets],
  );

  function update(category: VisibleCatalogCategory, next: CandidateReview) {
    onReviewChange?.(category, next);
    setMessage("");
  }

  return (
    <section className="v3-candidate-review" aria-label="Catalog candidate review">
      <span className="v3-kicker">PARTS FROM YOUR PHOTO</span>
      <h2>Pick the parts to build</h2>
      <p className="v3-similarity-note" role="note">
        <strong>Visual similarity only.</strong> A photo shows what a part looks like, not its exact
        model, size or price. Every option here is a planning choice you can change in the Studio,
        where compatibility is checked. Hidden parts (CPU, memory, storage, power supply) stay open
        for you to choose.
      </p>
      {sets.length === 0 && (
        <p>
          No visible part category has enough information for a catalog search. Build it in 3D to
          choose every part yourself.
        </p>
      )}
      {look && (
        <article
          className="v3-candidate-set v3-look-card"
          data-category="look"
          onMouseEnter={() => onActiveGroup?.("look")}
          onMouseLeave={() => onActiveGroup?.(null)}
        >
          <div className="v3-candidate-heading">
            <h3>Overall look</h3>
          </div>
          <ObservationTags observations={analysis.observations} group="look" />
        </article>
      )}
      <ModelGuesses
        guesses={guesses}
        visibleText={analysis.visibleText}
        shownCandidateIds={shown}
      />
      {sets.map((set) => (
        <PartCard
          guessed={guessed}
          key={set.category}
          set={set}
          observations={analysis.observations}
          review={reviews[set.category] ?? emptyCandidateReview()}
          onChange={(next) => update(set.category, next)}
          onMessage={setMessage}
          onActive={(active) => onActiveGroup?.(active ? tagGroup(set.category) : null)}
        />
      ))}
      {message && (
        <p className="v3-error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

function cardState(set: CandidateSet, review: CandidateReview, tied: AppearanceCandidate[]) {
  if (set.status === "not_in_photo") return "absent";
  if (review.status === "manual") return "note";
  if (review.kept) return "kept";
  if (review.status === "chosen") return "yours";
  if (!set.candidates.some((item) => !review.excludedPartIds.includes(item.partId))) return "none";
  return tied.length ? "tie" : "suggested";
}

function PartCard({
  set,
  observations,
  review,
  onChange,
  onMessage,
  onActive,
  guessed,
}: {
  guessed: Set<string>;
  set: CandidateSet;
  observations: VisualObservation[];
  review: CandidateReview;
  onChange: (review: CandidateReview) => void;
  onMessage: (message: string) => void;
  onActive: (active: boolean) => void;
}) {
  const label = categoryLabels[set.category];
  const open = set.candidates.filter((item) => !review.excludedPartIds.includes(item.partId));
  const tied = equallyLikelyCandidates(set, review);
  const state: CardState = cardState(set, review, tied);
  const chosen = open.find((item) => item.partId === review.chosenPartId);
  // The options shown up front: the user's pick, the tied options, or the single top match.
  const main =
    state === "kept" || state === "note"
      ? []
      : chosen
        ? [chosen]
        : tied.length
          ? // A long tie folds away; listing it would read like a ranking.
            tied.length > 3
            ? []
            : tied
          : open.slice(0, 1);
  const others = open.filter((item) => !main.includes(item));
  const use = (candidate: AppearanceCandidate) =>
    onChange(chooseCandidate(set, review, candidate.partId));
  return (
    <article
      className="v3-candidate-set"
      data-category={set.category}
      data-state={state}
      onMouseEnter={() => onActive(true)}
      onMouseLeave={() => onActive(false)}
      onFocus={() => onActive(true)}
    >
      <div className="v3-candidate-heading">
        <h3>{label}</h3>
        <span className="v3-state-chip" data-state={state}>
          {stateLabels[state]}
        </span>
        <PartMenu
          set={set}
          review={review}
          label={label}
          main={state === "suggested" || state === "yours" ? main[0] : undefined}
          onChange={onChange}
          onMessage={onMessage}
        />
      </div>
      {tagGroup(set.category) && (
        <ObservationTags observations={observations} group={tagGroup(set.category)!} />
      )}
      {(state === "absent" || state === "none") && (
        <p className="v3-candidate-explanation">{set.explanation}</p>
      )}
      {state === "note" && (
        <p className="v3-review-choice">
          Your note: {review.manualText}. This is not a catalog match; the slot stays open.
        </p>
      )}
      {state === "kept" && (
        <p className="v3-review-choice">
          Kept unknown: nothing is suggested here. Choose an option to undo.
        </p>
      )}
      {state === "tie" && (
        <p className="v3-equally-likely" role="note">
          <strong>{tied.length} options equally likely.</strong> The photo cannot tell them apart,
          so none is picked for you. Use one, or keep it unknown.
        </p>
      )}
      {set.category === "fan" && main.length > 0 && (
        <p className="v3-candidate-explanation">
          Fans are a style note, not one of the eight Build slots, and add nothing to the total.
        </p>
      )}
      {main.map((candidate) => (
        <CandidateOption
          key={candidate.partId}
          candidate={candidate}
          selected={candidate.partId === review.chosenPartId}
          guessed={guessed.has(candidate.partId)}
          primary={!tied.length || !!chosen}
          onUse={() => use(candidate)}
        />
      ))}
      {others.length > 0 && (
        <details
          className="v3-other-options"
          open={others.some((candidate) => guessed.has(candidate.partId)) || undefined}
        >
          <summary>
            {main.length ? "Other options" : "Options"} ({others.length})
          </summary>
          {others.map((candidate) => (
            <CandidateOption
              key={candidate.partId}
              candidate={candidate}
              selected={candidate.partId === review.chosenPartId}
              guessed={guessed.has(candidate.partId)}
              onUse={() => use(candidate)}
            />
          ))}
        </details>
      )}
    </article>
  );
}

function CandidateOption({
  candidate,
  selected,
  primary = false,
  guessed = false,
  onUse,
}: {
  candidate: AppearanceCandidate;
  selected: boolean;
  /** An AI model guess names this part: highlighted only, the user still chooses. */
  guessed?: boolean;
  primary?: boolean;
  onUse: () => void;
}) {
  const part = catalogPartById(candidate.partId);
  const price =
    candidate.category === "fan"
      ? "Not a Build slot"
      : !part || priceUnknown(part)
        ? "Price unknown"
        : `$${part.price.toLocaleString()}`;
  return (
    <div
      className={`v3-candidate-card ${selected ? "chosen" : ""} ${guessed ? "guessed" : ""}`}
      data-part-id={candidate.partId}
    >
      <div className="v3-candidate-main">
        <strong>{candidate.displayName}</strong>
        {guessed && <span className="v3-guess-badge">Matches AI guess</span>}
        <small>
          {candidateMatchLabel(candidate)} · {price}
        </small>
        {part && colorSourceNote(part) && (
          <small className="v3-color-source">{colorSourceNote(part)}</small>
        )}
      </div>
      <button
        type="button"
        className={primary ? "v3-primary" : "v3-secondary"}
        aria-pressed={selected}
        disabled={selected}
        onClick={onUse}
      >
        {selected ? "Using this ✓" : "Use this"}
      </button>
      <details className="v3-candidate-why">
        <summary>Why this match</summary>
        <ul>
          {candidate.matchedSignals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
          {candidate.observationEvidence.map((evidence, index) => (
            <li key={`${index}:${evidence}`}>Photo evidence: {evidence}</li>
          ))}
        </ul>
        <p className="v3-candidate-meta">
          Catalog specs: {candidate.catalogSpecFields} fields
          {candidate.catalogSourceUrl && (
            <>
              {" "}
              ·{" "}
              {allowedExternalUrl(candidate.catalogSourceUrl) ? (
                <a href={allowedExternalUrl(candidate.catalogSourceUrl)!} {...externalLinkProps}>
                  Specs from manufacturer page
                </a>
              ) : (
                "Specs from manufacturer page"
              )}
              , verified {candidate.catalogVerifiedAt}
            </>
          )}
        </p>
      </details>
    </div>
  );
}

/** Tag line of what the photo shows; each observation's reason and confidence on expand. */
function ObservationTags({
  observations,
  group,
}: {
  observations: VisualObservation[];
  group: ObservationGroup;
}) {
  const line = observationTagLine(observations, group);
  const items = observations.filter((item) => observationGroup(item) === group);
  if (!items.length) return null;
  return (
    <details className="v3-observation-tags">
      <summary>
        <span className="v3-tag-line">{line || "Not clearly visible"}</span>
        <span className="v3-tag-more">Why</span>
      </summary>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>
              {item.attribute}: {item.value}
            </strong>{" "}
            {item.evidence}{" "}
            <small>
              {item.visibleInImage ? item.origin : "not visible"} ·{" "}
              {item.confidenceBand === "unknown" ? "unknown" : item.confidenceBand} confidence
            </small>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Secondary actions: exclude or restore options, keep unknown, or a manual model note. */
function PartMenu({
  set,
  review,
  label,
  main,
  onChange,
  onMessage,
}: {
  set: CandidateSet;
  review: CandidateReview;
  label: string;
  main?: AppearanceCandidate;
  onChange: (review: CandidateReview) => void;
  onMessage: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const excluded = set.candidates.filter((item) => review.excludedPartIds.includes(item.partId));
  return (
    <details className="v3-part-menu">
      <summary aria-label={`More options for ${label}`}>More</summary>
      <div className="v3-part-menu-body">
        {main && (
          <button type="button" onClick={() => onChange(excludeCandidate(review, main.partId))}>
            Exclude {main.displayName}
          </button>
        )}
        {excluded.map((item) => (
          <button
            key={item.partId}
            type="button"
            onClick={() =>
              onChange({
                ...review,
                excludedPartIds: review.excludedPartIds.filter((id) => id !== item.partId),
              })
            }
          >
            Restore {item.displayName}
          </button>
        ))}
        {/* Nothing to keep unknown when the photo shows the part isn't there. */}
        {set.status !== "not_in_photo" && !review.kept && (
          <button type="button" onClick={() => onChange(keepCandidateUnknown(review))}>
            Keep unknown
          </button>
        )}
        <label>
          Enter model manually
          <input
            value={note}
            maxLength={180}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Your own model note"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            try {
              onChange(noteManualModel(review, note));
            } catch {
              onMessage("Enter a model note before recording it.");
            }
          }}
        >
          Record note
        </button>
      </div>
    </details>
  );
}
