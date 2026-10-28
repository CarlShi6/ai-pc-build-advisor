import { useState } from "react";
import { Search } from "lucide-react";
import type { BuildDocumentV3, SlotId } from "@/lib/v3/build-document";
import { catalogPartById, colorSourceNote } from "@/lib/v3/catalog";
import {
  SIMILAR_LOOK_LABEL,
  searchCatalog,
  slotIdentityHelp,
  type MatchGap,
} from "@/lib/v3/slot-identity";
import type { Part } from "@/types/parts";
import { ModelGuesses } from "@/components/model-guesses";
import { catalogMatchesForGuess } from "@/lib/v3/model-guess";

const gapText: Partial<Record<MatchGap, string>> = {
  no_close_match: "No catalog part looks like this yet.",
  no_catalog_category: "The catalog has no parts of this kind yet.",
  all_excluded: "You excluded every close match in the review.",
  tied: "These look the same in the photo; it can't tell them apart.",
};

/**
 * An unconfirmed slot the photo shows: its photo evidence, the closest-looking catalog parts
 * (labelled as a similar look, never as this part), a search by model name and "keep unknown".
 * "Use this" only previews; the Build changes on Confirm, like any other choice.
 */
export function SlotIdentityPanel({
  document,
  slot,
  onUse,
  onKeepUnknown,
}: {
  document: BuildDocumentV3;
  slot: SlotId;
  onUse: (part: Part) => void;
  onKeepUnknown: () => void;
}) {
  const [query, setQuery] = useState("");
  const help = slotIdentityHelp(document, slot);
  if (!help) return null;
  const results = searchCatalog(slot, query);
  const guesses = (document.imageContext?.modelGuesses ?? []).filter(
    (guess) => guess.category === slot,
  );
  const guessed = new Set(
    guesses.flatMap((guess) => catalogMatchesForGuess(guess).map((part) => part.id)),
  );
  return (
    <section className="v3-identity" aria-label="Find this part">
      {help.evidence && <p className="v3-identity-evidence">{help.evidence}</p>}
      <ModelGuesses
        compact
        guesses={guesses}
        visibleText={(document.imageContext?.visibleText ?? []).filter(
          (item) => item.category === slot,
        )}
        shownCandidateIds={new Set(help.candidates.slice(0, 4).map((item) => item.partId))}
      />
      <span className="v3-kicker">CLOSEST LOOK IN THE CATALOG</span>
      {help.candidates.length ? (
        <ul className="v3-identity-list">
          {help.candidates.slice(0, 4).map((candidate) => {
            const part = catalogPartById(candidate.partId);
            return (
              <li key={candidate.partId} data-part-id={candidate.partId}>
                <div>
                  <strong>{candidate.displayName}</strong>
                  <small>
                    {SIMILAR_LOOK_LABEL}
                    {candidate.reviewChoice && " · you chose this in the review"}
                  </small>
                  {part && colorSourceNote(part) && (
                    <small className="v3-color-source">{colorSourceNote(part)}</small>
                  )}
                  {guessed.has(candidate.partId) && (
                    <span className="v3-guess-badge">Matches AI guess</span>
                  )}
                  {candidate.matchedSignals.length > 0 && (
                    <small className="v3-identity-signals">
                      {candidate.matchedSignals.slice(0, 2).join(" · ")}
                    </small>
                  )}
                </div>
                {part && (
                  <button type="button" className="v3-secondary" onClick={() => onUse(part)}>
                    Use this
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="v3-identity-empty">
          {(help.gap && gapText[help.gap]) ?? "No close match in the catalog."}
        </p>
      )}
      {help.gap === "tied" && help.candidates.length > 1 && (
        <p className="v3-identity-note">{gapText.tied}</p>
      )}
      {help.excludedCount > 0 && (
        <p className="v3-identity-note">
          {help.excludedCount} excluded in the review {help.excludedCount === 1 ? "is" : "are"}{" "}
          hidden.
        </p>
      )}
      <label className="v3-field v3-identity-search">
        Search by model name
        <span>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="e.g. RTX 5070, TITAN 360"
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
      </label>
      {query.trim() && (
        <ul className="v3-identity-list" aria-label="Search results">
          {results.length ? (
            results.map((part) => (
              <li key={part.id}>
                <div>
                  <strong>{part.displayName}</strong>
                </div>
                <button type="button" className="v3-secondary" onClick={() => onUse(part)}>
                  Use this
                </button>
              </li>
            ))
          ) : (
            <li className="v3-identity-empty">No catalog part matches “{query.trim()}”.</li>
          )}
        </ul>
      )}
      {help.kept ? (
        <p className="v3-identity-note" role="status">
          Kept unknown · not in the catalog. It stays out of prices and rule checks.
        </p>
      ) : (
        <button type="button" className="v3-text-button" onClick={onKeepUnknown}>
          Not in catalog · keep unknown
        </button>
      )}
    </section>
  );
}
