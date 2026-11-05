import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  selectedPart,
  slotLabel,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { confirmPartSelection } from "@/lib/v3/build-proposal";
import {
  replaceOption,
  replaceOptions,
  type CompatibilitySummary,
  type ReplaceOption,
} from "@/lib/v3/replace-options";
import { confirmWithLockOverride } from "@/lib/v3/visual-optimization";
import { priceCoverage, priceUnknown } from "@/lib/v3/catalog";
import { REFERENCE_MODEL_LABEL, referenceModelFor } from "@/lib/v3/reference-models";
import { keepSlotUnknown, slotIdentityHelp } from "@/lib/v3/slot-identity";
import { SlotIdentityPanel } from "@/components/slot-identity-panel";
import { catalogPartById } from "@/lib/v3/catalog";
import { externalLinkProps } from "@/lib/v3/external-links";

function totalText(total: { known: number; unknown: number }) {
  return `${total.known.toLocaleString()}${total.unknown ? ` + ${total.unknown} unknown` : ""}`;
}

function money(value: number) {
  return `${value < 0 ? "−" : "+"}$${Math.abs(value).toLocaleString()}`;
}

function compatText(summary: CompatibilitySummary) {
  return summary.label === "Incomplete"
    ? "Incomplete"
    : `${summary.label} · ${summary.findings} finding${summary.findings === 1 ? "" : "s"}`;
}

/**
 * Replace card shown beside the focused 3D part. Choosing an option only previews it; the Build
 * changes on Confirm, through the same proposal/confirm path as the rest of the Studio.
 */
export function PartReplaceCard({
  document,
  slot,
  link,
  onCommit,
  onClose,
}: {
  document: BuildDocumentV3;
  slot: SlotId;
  link: { href: string; label: string } | null;
  onCommit: (next: BuildDocumentV3) => void;
  onClose: () => void;
}) {
  const current = selectedPart(document, slot);
  const occupancy = slotOccupancy(document, slot);
  const { options, total } = useMemo(() => replaceOptions(document, slot), [document, slot]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [error, setError] = useState("");
  // Any catalog part can be previewed: one of the options, a similar look or a search result.
  const chosenPart = chosenId ? catalogPartById(chosenId) : undefined;
  const chosen: ReplaceOption | undefined =
    options.find((item) => item.part.id === chosenId) ??
    (chosenPart ? replaceOption(document, slot, chosenPart) : undefined);
  const identity = !current && slotIdentityHelp(document, slot);

  function confirm() {
    if (!chosen) return;
    try {
      onCommit(
        chosen.lockConflicts.length
          ? confirmWithLockOverride(
              document,
              chosen.proposal,
              chosen.lockConflicts.map((impact) => impact.priorityId),
            )
          : confirmPartSelection(document, chosen.proposal),
      );
      setChosenId(null);
      setOverride(false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The build changed. Choose again.");
      setChosenId(null);
    }
  }

  return (
    <section className="v3-replace-card" aria-label={`Replace ${slotLabel[slot]}`}>
      <header>
        <div>
          <span className="v3-kicker">{slotLabel[slot].toUpperCase()}</span>
          <strong>
            {current?.displayName ??
              (occupancy === "unresolved"
                ? (document.unresolved[slot] ?? "Identity unresolved")
                : "Empty slot")}
          </strong>
          {current && link && (
            <a href={link.href} {...externalLinkProps}>
              {link.label} ↗
            </a>
          )}
          {current && (
            <small className="v3-replace-model">
              {referenceModelFor(current.id) ? REFERENCE_MODEL_LABEL : "Illustrative geometry"}
            </small>
          )}
        </div>
        <button type="button" className="v3-replace-close" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      {!chosen && identity ? (
        <SlotIdentityPanel
          document={document}
          slot={slot}
          onUse={(part) => {
            setChosenId(part.id);
            setOverride(false);
            setError("");
          }}
          onKeepUnknown={() => onCommit(keepSlotUnknown(document, slot))}
        />
      ) : !chosen ? (
        <>
          <p className="v3-replace-hint">{current ? "Swap for" : "Add a part"}</p>
          <ul className="v3-replace-options">
            {options.map((option) => (
              <li key={option.part.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChosenId(option.part.id);
                    setOverride(false);
                    setError("");
                  }}
                >
                  <span>{option.part.displayName}</span>
                  <small>
                    {priceUnknown(option.part)
                      ? "price unknown"
                      : current
                        ? option.priceDelta === null
                          ? "price change unknown"
                          : money(option.priceDelta)
                        : `${option.part.price.toLocaleString()}`}{" "}
                    · {compatText(option.after)}
                    {option.lockConflicts.length > 0 && " · changes locked look"}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {total > options.length && (
            <p className="v3-replace-more">
              {total - options.length} more in the parts panel below.
            </p>
          )}
        </>
      ) : (
        <div className="v3-replace-preview">
          <span className="v3-kicker">PREVIEW · NOT APPLIED</span>
          <strong>{chosen.part.displayName}</strong>
          <dl>
            <dt>Known total</dt>
            <dd>
              {totalText(priceCoverage(document.build.parts))} → {totalText(chosen.totalAfter)}
            </dd>
            {chosen.part.priceSource && (
              <>
                <dt>Price source</dt>
                <dd>{chosen.part.priceSource.label}</dd>
              </>
            )}
            <dt>Compatibility</dt>
            <dd>
              {compatText(chosen.before)} → {compatText(chosen.after)}
            </dd>
            {chosen.traitImpacts.length > 0 && (
              <>
                <dt>Look</dt>
                <dd>
                  {chosen.traitImpacts
                    .map((impact) => `${impact.label} ${impact.outcome}`)
                    .join("; ")}
                </dd>
              </>
            )}
          </dl>
          {chosen.newFindings.length > 0 && (
            <ul className="v3-replace-findings">
              {chosen.newFindings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          )}
          {chosen.lockConflicts.length > 0 && (
            <label className="v3-replace-override">
              <input
                type="checkbox"
                checked={override}
                onChange={(event) => setOverride(event.target.checked)}
              />
              Change the locked look anyway (
              {chosen.lockConflicts.map((impact) => impact.label).join(", ")}). This unlocks it.
            </label>
          )}
          <div className="v3-replace-actions">
            <button
              type="button"
              className="v3-primary"
              disabled={chosen.lockConflicts.length > 0 && !override}
              onClick={confirm}
            >
              <Check size={15} /> {chosen.lockConflicts.length ? "Confirm and unlock" : "Confirm"}
            </button>
            <button type="button" className="v3-text-button" onClick={() => setChosenId(null)}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="v3-error" role="alert">
          {error}
        </p>
      )}
      <p className="v3-replace-foot">
        Seed or manufacturer store prices, not live offers; unknown prices aren't counted. Rule
        checks use catalog specs; physical fit isn't verified.
      </p>
    </section>
  );
}
