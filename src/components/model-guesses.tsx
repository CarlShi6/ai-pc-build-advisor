import { ExternalLink } from "lucide-react";
import {
  catalogMatchesForGuess,
  guessLabel,
  manufacturerSearch,
  type ModelGuess,
  type VisibleText,
} from "@/lib/v3/model-guess";
import { allowedExternalUrl, externalLinkProps } from "@/lib/v3/external-links";

const categoryLabels: Record<string, string> = {
  case: "Case",
  gpu: "GPU",
  cooler: "Cooler",
  motherboard: "Motherboard",
  memory: "Memory",
  fan: "Fans",
  other: "Elsewhere",
};

/**
 * Step B: the AI's model guesses and the text it read, each marked as a guess. A guess that names
 * a catalog part points at that option (highlighted, not chosen); otherwise it links to a search
 * of the maker's site. Nothing here selects a part, adds a price or changes the 3D.
 */
export function ModelGuesses({
  guesses,
  visibleText = [],
  shownCandidateIds,
  compact = false,
}: {
  guesses: ModelGuess[];
  visibleText?: VisibleText[];
  /** Catalog options on screen, to say whether a matching part is among them. */
  shownCandidateIds?: Set<string>;
  /** Studio: one slot's guesses, no section heading. */
  compact?: boolean;
}) {
  if (!guesses.length && !visibleText.length) return null;
  return (
    <section
      className={`v3-model-guesses ${compact ? "compact" : ""}`}
      aria-label="AI model guesses"
    >
      {!compact && <span className="v3-kicker">AI MODEL GUESSES</span>}
      {guesses.length > 0 && (
        <ul className="v3-guess-list">
          {guesses.map((guess) => {
            const matches = catalogMatchesForGuess(guess);
            const label = guessLabel(guess);
            const search = manufacturerSearch(guess);
            const shown = matches.filter((match) => shownCandidateIds?.has(match.id));
            return (
              <li key={`${guess.category}:${label}`} data-guess-category={guess.category}>
                <strong>
                  AI guess: {label} · {matches.length ? "in catalog" : "not in catalog"}
                </strong>
                <small>
                  {!compact && `${categoryLabels[guess.category]} · `}
                  {guess.basis === "visible-text" ? "from visible text" : "from its look"}
                  {guess.evidence && ` · ${guess.evidence}`}
                </small>
                {matches.length > 0 ? (
                  <small className="v3-guess-match">
                    {shown.length
                      ? "Marked “Matches AI guess” below. It is not chosen until you pick it."
                      : `Catalog has ${matches.map((match) => match.displayName).join(", ")}; search for it to use it.`}
                  </small>
                ) : (
                  allowedExternalUrl(search.url) && (
                    <a href={allowedExternalUrl(search.url)!} {...externalLinkProps}>
                      {search.label} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      {visibleText.length > 0 && (
        <div className="v3-visible-text">
          <span className="v3-kicker">VISIBLE TEXT · AI READ, MAY BE MISREAD</span>
          <ul aria-label="Visible text">
            {visibleText.map((item) => (
              <li key={`${item.category}:${item.text}`}>
                <q>{item.text}</q> <small>{item.location}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="v3-guess-note">
        Guesses only: they never pick a part, add a price or change the 3D model.
      </p>
    </section>
  );
}
